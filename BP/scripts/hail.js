// Weather Events: hail. Stones fall out of the sky near players: pea-sized and harmless at level 1 (a pitter-patter on
// every roof), marbles that sting at level 2, golf balls that hurt and break glass at level 3. A helmet takes most of
// the sting. Pure rules, tested; hail-stones.js fires them.
import { byLevel, clamp } from "./kit/intensity.js";

// Stones per second near each player (a float level interpolates).
export const stonesPerSecond = (hail) => byLevel([0, 2, 6, 14], hail);

// What a stone is at a whole level 1 to 3: its size name, the damage it does (in half hearts), how fast it falls, and the
// chance a stone that hits glass breaks it.
export function stone(level) {
  const l = clamp(Math.round(level), 1, 3);
  return [
    { name: "pea", damage: 0, speed: 0.9, glass: 0 },
    { name: "marble", damage: 1, speed: 1.1, glass: 0 },
    { name: "golf ball", damage: 3, speed: 1.3, glass: 0.35 },
  ][l - 1];
}

// The damage a stone does to something wearing a helmet or not: a helmet takes seven tenths, never below one when the
// stone does damage at all.
export function stoneDamage(level, { helmet = false } = {}) {
  const base = stone(level).damage;
  if (base === 0) return 0;
  return helmet ? Math.max(1, Math.round(base * 0.3)) : base;
}

// Where a stone starts and lands, for a player at `at`: a random spot within `radius`, the stone starting `height`
// blocks above the highest block there so it always falls from open sky onto whatever roof or ground is there.
export function stoneSpot(at, topY, rand, { radius = 14, height = 18 } = {}) {
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
  const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
  return { target: { x, y: topY + 1, z }, start: { x: x + (rand() - 0.5) * 3, y: topY + height + rand() * 6, z: z + (rand() - 0.5) * 3 } };
}

// The sound a stone makes landing on a block: what it is made of, quieter for small stones.
export function landingSound(blockId, level) {
  const id = blockId.replace("minecraft:", "");
  const volume = [0, 0.25, 0.4, 0.6][clamp(Math.round(level), 1, 3)];
  const pitch = 1.3 + (3 - clamp(Math.round(level), 1, 3)) * 0.12;
  if (/glass/.test(id)) return { id: "dig.glass", volume: volume * 1.2, pitch };
  if (/planks|log|wood|door|fence|stairs|slab_wood|oak|spruce|birch|jungle|acacia|cherry|bamboo|mangrove/.test(id)) return { id: "dig.wood", volume, pitch };
  if (/copper|iron|gold|chain|lantern|anvil|bell/.test(id)) return { id: "note.hat", volume: volume * 1.4, pitch: pitch + 0.4 };
  if (/leaves|grass|dirt|moss|vine|snow|wool|carpet/.test(id)) return { id: "dig.grass", volume: volume * 0.6, pitch };
  return { id: "dig.stone", volume, pitch };
}

// Does a stone that has hit `blockId` break it? Only glass, only the big stones.
export function breaksGlass(blockId, level, rand) {
  return /glass/.test(blockId) && rand() < stone(level).glass;
}
