import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { test } from "node:test";
import { MAX_SIZE } from "../BP/scripts/puddles.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const json = (p) => JSON.parse(read(p).toString("utf8"));

test("the puddle block has a size state, one model per size, translucent material, and no way to trip you up", () => {
  const b = json("BP/blocks/puddle.json")["minecraft:block"];
  assert.equal(b.description.identifier, "wx:puddle");
  assert.deepEqual(b.description.states["wx:size"], Array.from({ length: MAX_SIZE }, (_, i) => i + 1));
  assert.equal(b.description.menu_category.category, "none", "players should not be handed puddles in the creative menu");
  assert.equal(b.components["minecraft:material_instances"]["*"].render_method, "blend");
  assert.ok(b.components["minecraft:collision_box"].size[1] <= 0.5, "a puddle must be walked over, not climbed");
  assert.equal(b.components["minecraft:light_dampening"], 0);
  assert.equal(b.permutations.length, MAX_SIZE);
  b.permutations.forEach((perm, i) => {
    assert.match(perm.condition, new RegExp(`query\\.block_state\\('wx:size'\\) == ${i + 1}$`));
    assert.equal(perm.components["minecraft:geometry"], `geometry.wx_puddle_${i + 1}`);
  });
});

test("each model is a thin slab exactly as deep as its size, up to a quarter of a block", () => {
  const geos = json("RP/models/blocks/wx_puddle.geo.json")["minecraft:geometry"];
  assert.equal(geos.length, MAX_SIZE);
  geos.forEach((g, i) => {
    assert.equal(g.description.identifier, `geometry.wx_puddle_${i + 1}`);
    const cube = g.bones[0].cubes[0];
    assert.deepEqual(cube.size, [16, i + 1, 16]);
    assert.ok(cube.size[1] <= 4, "no deeper than four sixteenths");
    assert.deepEqual(cube.origin, [-8, 0, -8], "inside the block, on the ground");
  });
});

test("the texture is a 16 by 16 translucent image, registered, with a name in the language file", () => {
  const png = read("RP/textures/blocks/wx_puddle.png");
  assert.equal(png.readUInt32BE(16), 16);
  assert.equal(png.readUInt32BE(20), 16);
  assert.equal(png[25], 6, "RGBA");
  // Pull the pixels back out and check the alpha: a soft blob, clear at the corners, solid-ish in the middle.
  const idat = png.subarray(png.indexOf("IDAT") + 4, png.indexOf("IEND") - 8);
  const raw = inflateSync(idat);
  const alpha = (x, y) => raw[y * 65 + 1 + x * 4 + 3];
  assert.equal(alpha(0, 0), 0, "clear corners");
  assert.ok(alpha(8, 8) > 100 && alpha(8, 8) < 255, "translucent middle");
  assert.equal(json("RP/textures/terrain_texture.json").texture_data.wx_puddle.textures, "textures/blocks/wx_puddle");
  assert.match(read("RP/texts/en_US.lang").toString(), /tile\.wx:puddle\.name=Puddle/);
});

test("the puddle code places and resolves the same block the files define, and is started with the weather", () => {
  const src = read("BP/scripts/puddle-blocks.js").toString();
  assert.match(src, /const BLOCK = "wx:puddle"/);
  assert.match(src, /"wx:size": size/);
  const main = read("BP/scripts/main.js").toString();
  assert.match(main, /startPuddles\(currentLevels\)/);
  assert.match(read("BP/scripts/weather.js").toString(), /export const currentLevels/);
});

test("puddles are saved, so a restart never leaves puddles that never dry, and the list is capped", () => {
  const src = read("BP/scripts/puddle-blocks.js").toString();
  assert.match(src, /setDynamicProperty\(PROPERTY/);
  assert.match(src, /MAX_PUDDLES/);
  assert.match(src, /getDynamicProperty\(PROPERTY/);
});
