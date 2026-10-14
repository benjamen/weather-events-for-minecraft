#!/usr/bin/env node
// Generates the puddle block: its definition, its models (one per depth), its texture, and the texture and language
// registrations. The depths come from MAX_SIZE in puddles.js, so the table and the art cannot disagree.
//   node scripts/gen-puddle.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { MAX_SIZE } from "../BP/scripts/puddles.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (p, data) => {
  mkdirSync(dirname(join(root, p)), { recursive: true });
  writeFileSync(join(root, p), data);
};
const json = (p, o) => out(p, JSON.stringify(o, null, 2) + "\n");
const sizes = Array.from({ length: MAX_SIZE }, (_, i) => i + 1);

// The block: one state, `wx:size`, 1 to MAX_SIZE sixteenths deep, with its own model per size. It can be walked
// through, a hit removes it, and it is drawn translucent. Format 1.21.80 keeps the long-standing component shapes.
json("BP/blocks/puddle.json", {
  format_version: "1.21.80",
  "minecraft:block": {
    description: { identifier: "wx:puddle", menu_category: { category: "none" }, states: { "wx:size": sizes } },
    components: {
      "minecraft:geometry": "geometry.wx_puddle_1",
      "minecraft:material_instances": { "*": { texture: "wx_puddle", render_method: "blend", ambient_occlusion: 0, face_dimming: false } },
      "minecraft:collision_box": { origin: [-8, 0, -8], size: [16, 0.5, 16] },
      "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 2, 16] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:map_color": "#3f76e4",
    },
    permutations: sizes.map((s) => ({ condition: `query.block_state('wx:size') == ${s}`, components: { "minecraft:geometry": `geometry.wx_puddle_${s}` } })),
  },
});

// The models: a thin slab `size` sixteenths tall, top face carrying the whole texture, sides carrying a strip of it.
json("RP/models/blocks/wx_puddle.geo.json", {
  format_version: "1.21.0",
  "minecraft:geometry": sizes.map((s) => ({
    description: { identifier: `geometry.wx_puddle_${s}`, texture_width: 16, texture_height: 16 },
    bones: [{
      name: "puddle", pivot: [0, 0, 0],
      cubes: [{
        origin: [-8, 0, -8], size: [16, s, 16],
        uv: {
          up: { uv: [0, 0], uv_size: [16, 16] }, down: { uv: [0, 0], uv_size: [16, 16] },
          north: { uv: [0, 0], uv_size: [16, s] }, south: { uv: [0, 0], uv_size: [16, s] },
          east: { uv: [0, 0], uv_size: [16, s] }, west: { uv: [0, 0], uv_size: [16, s] },
        },
      }],
    }],
  })),
});

json("RP/textures/terrain_texture.json", {
  resource_pack_name: "weather-events",
  texture_name: "atlas.terrain",
  padding: 8,
  num_mip_levels: 4,
  texture_data: { wx_puddle: { textures: "textures/blocks/wx_puddle" } },
});
out("RP/texts/en_US.lang", "tile.wx:puddle.name=Puddle\n");
json("RP/texts/languages.json", ["en_US"]);

// The texture: a soft round blob of water, 16 by 16, clear at the corners (so a lone puddle looks round), with a few
// lighter ripple rings. Deterministic: the same file every run.
const W = 16;
const px = Buffer.alloc(W * W * 4);
const noise = (x, y) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8;
    const r = Math.hypot(dx, dy);
    const edge = 6.6 + (noise(Math.round(Math.atan2(dy, dx) * 3), 1) - 0.5) * 2.2; // a wobbly shoreline
    const body = Math.min(1, Math.max(0, (edge - r) / 1.8)); // soft edge
    const ring = Math.max(0, 1 - Math.abs(((r * 1.1) % 3) - 1.5) * 2.2) * 0.35; // ripples
    const i = (y * W + x) * 4;
    px[i] = Math.round(58 + ring * 120);
    px[i + 1] = Math.round(112 + ring * 110);
    px[i + 2] = Math.round(222 + ring * 30);
    px[i + 3] = Math.round(body * (150 + ring * 70));
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(W, 0);
header.writeUInt32BE(W, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA
const raw = Buffer.alloc((W * 4 + 1) * W);
for (let y = 0; y < W; y++) {
  raw[y * (W * 4 + 1)] = 0;
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
out("RP/textures/blocks/wx_puddle.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(`puddle block written: ${MAX_SIZE} depths`);
