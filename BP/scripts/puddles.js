// Weather Events: puddles. Rain leaves thin water on open ground: up to a quarter of a block deep, growing while it
// rains, shrinking when it stops, gone when the sun and wind have had their way. Pure rules, tested; puddles.js's
// Minecraft side (puddle-blocks.js) places and removes the blocks.
import { byLevel, clamp } from "./kit/intensity.js";

// A puddle block has a size from 1 to 4 sixteenths of a block deep. 0 means gone.
export const MAX_SIZE = 4;

// How many puddle attempts per player per second at a rain level (a float level interpolates).
export const attemptsPerSecond = (rain) => byLevel([0, 0.6, 2, 5], rain);

// The deepest a puddle can get in rain of this level: drizzle only dampens, a downpour floods the ground a quarter block.
export const maxSize = (rain) => Math.round(byLevel([0, 1, 3, 4], rain));

// Seconds a puddle lasts once the rain has stopped, by weather: sun dries them fast, wind helps, more so together.
export function dryingSeconds({ sun = 0, wind = 0, baseSeconds = 180 } = {}) {
  const sunFactor = byLevel([1, 0.65, 0.3, 0.12], sun);
  const windFactor = 1 - 0.12 * clamp(wind, 0, 3);
  return Math.max(10, baseSeconds * sunFactor * windFactor);
}

// How well ground holds water, from its block id: 1 stone and boards, 0.6 soil, 0.3 sand and gravel, 0 not at all
// (water, ice, leaves, glass, snow, carpets, anything that is not a solid top).
export function groundChance(typeId) {
  const id = typeId.replace("minecraft:", "");
  if (/water|ice|leaves|glass|snow|carpet|lava|slab|stairs|fence|wall|rail|farmland|powder|moss|vine|sponge/.test(id)) return 0;
  if (/stone|brick|cobble|planks|log|concrete$|terracotta|deepslate|basalt|blackstone|tuff|andesite|granite|diorite|quartz|prismarine|copper|obsidian|netherrack$/.test(id)) return 1;
  if (/dirt|grass_block|podzol|mycelium|mud|clay|coarse|path/.test(id)) return 0.6;
  if (/sand|gravel/.test(id)) return 0.3;
  return 0;
}

// A spot where a puddle may form: open air above, solid ground that holds water, open sky, and no puddle already.
export function puddleSpot({ above, ground, skyOpen, existing = false }) {
  return above === "minecraft:air" && skyOpen && !existing && groundChance(ground) > 0;
}

// Advance one puddle by `dt` seconds. `puddle` is { size, dry } (dry = seconds since it last rained on it). Returns the
// new puddle, or null when it is gone. Rain grows it by one sixteenth every `growEvery` seconds up to the rain's
// limit; with no rain it shrinks by one every `dryingSeconds / size` seconds, so the whole puddle lasts `dryingSeconds`.
export function stepPuddle(puddle, dt, { rain = 0, sun = 0, wind = 0, growEvery = 8 } = {}) {
  let { size, dry, grown = 0 } = puddle;
  if (rain > 0.2) {
    dry = 0;
    grown += dt;
    while (grown >= growEvery && size < maxSize(rain)) {
      size++;
      grown -= growEvery;
    }
    if (size >= maxSize(rain)) grown = 0;
    return { size, dry, grown };
  }
  dry += dt;
  const each = dryingSeconds({ sun, wind }) / MAX_SIZE;
  const lost = Math.floor(dry / each);
  if (lost > 0) {
    size -= lost;
    dry -= lost * each;
  }
  return size <= 0 ? null : { size, dry, grown: 0 };
}
