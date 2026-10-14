// Weather Events: snow that settles. Snowfall piles layers of snow on open ground near players, deeper in heavier snow, and
// when it stops the sun and mild weather melt it away a layer at a time. Pure rules, tested; snow-layers.js places them.
import { byLevel, clamp } from "./kit/intensity.js";

export const MAX_LAYERS = 7;

// Settling attempts per player per second at a snow level, and the deepest it gets in snow of this level.
export const attemptsPerSecond = (snow) => byLevel([0, 0.8, 2.5, 6], snow);
export const maxLayers = (snow) => Math.round(byLevel([0, 1, 3, 6], snow));

// Seconds for a full seven-layer pile to melt once it stops snowing: sun and warmth hasten it (temperature 0 frozen to 1 hot).
export function meltSeconds({ sun = 0, temperature = 0.1, base = 240 } = {}) {
  return Math.max(15, base * byLevel([1, 0.7, 0.4, 0.2], sun) * (1 - clamp(temperature - 0.1, 0, 0.8) * 0.8));
}

// Ground that can carry a snow layer: any solid top, but not liquid, ice, glass, leaves, slabs or things that are not whole.
export function holdsSnow(typeId) {
  const id = typeId.replace("minecraft:", "");
  return !/water|lava|ice|glass|leaves|slab|stairs|fence|wall|rail|carpet|vine|flower|torch|sapling|bed|door|trapdoor|snow|powder|air/.test(id);
}

// Advance one pile of `layers` by `dt` seconds. Snowing adds a layer every `growEvery` seconds up to the cap; otherwise it melts a layer every seventh of `meltSeconds` (the time a full pile takes). Returns the new { layers, clock }, or null when it has all melted.
export function stepSnow(pile, dt, { snow = 0, sun = 0, temperature = 0.1, growEvery = 15 } = {}) {
  const cap = maxLayers(snow);
  let { layers, clock = 0 } = pile;
  if (snow >= 0.5 && layers < cap) {
    clock += dt;
    if (clock >= growEvery) { layers += 1; clock = 0; }
  } else if (snow < 0.5) {
    clock += dt;
    const per = meltSeconds({ sun, temperature }) / MAX_LAYERS; // meltSeconds is for a full pile
    if (clock >= per) { layers -= 1; clock = 0; }
  } else {
    clock = 0;
  }
  return layers <= 0 ? null : { layers: Math.min(layers, MAX_LAYERS), clock };
}
