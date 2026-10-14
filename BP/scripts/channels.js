// Weather Events: the five weather channels (rain, wind, hail, snow, sun), each a float on the kit's 0 to 3 scale, and
// the rules for which combinations make sense. Pure: no Minecraft imports; tested in tests/channels.test.js.
import { clamp } from "./kit/intensity.js";

export const CHANNELS = ["rain", "wind", "hail", "snow", "sun"];
export const CLEAR = Object.freeze({ rain: 0, wind: 0, hail: 0, snow: 0, sun: 0 });

// Temperature as the base game rates biomes: below about 0.15 it snows instead of raining, above about 0.95 it is hot.
export const COLD = 0.15;
export const HOT = 0.95;

// Turn what was asked for into what can happen here. `temperature` is the biome's.
//  - In the cold, rain falls as snow and there is no hail; where it is warm there is no snow.
//  - Hail is a storm: it needs rain (hail with no rain brings level 1 rain with it).
//  - Sun and precipitation share the sky: blistering sun means a dry sky, a sun shower is at most light.
//  - Heat adds to sun in the hot biomes and takes it away in the cold.
export function resolve(asked, { temperature = 0.5 } = {}) {
  const out = { ...CLEAR, ...asked };
  for (const c of CHANNELS) out[c] = clamp(out[c], 0, 3);
  if (temperature <= COLD) {
    out.snow = Math.max(out.snow, out.rain);
    out.rain = 0;
    out.hail = 0;
  } else {
    out.snow = 0;
    if (out.hail > 0) out.rain = Math.max(out.rain, 1);
    out.hail = Math.min(out.hail, out.rain);
  }
  const wet = Math.max(out.rain, out.snow, out.hail);
  const skyCap = wet === 0 ? 3 : wet <= 1 ? 1 : 0;
  const biomeCap = temperature <= COLD ? 2 : 3;
  out.sun = Math.min(out.sun, skyCap, biomeCap);
  if (temperature >= HOT && wet === 0 && out.sun > 0) out.sun = Math.min(3, out.sun + 1);
  return out;
}

// A name for the weather, for the forecast item and the chat, from the whole levels in `levels`.
export function describeWeather(levels) {
  const l = Object.fromEntries(CHANNELS.map((c) => [c, Math.round(levels[c] ?? 0)]));
  if (l.snow >= 2 && l.wind >= 2) return "blizzard";
  if (l.hail >= 2) return "hailstorm";
  if (l.hail >= 1) return "hail shower";
  if (l.rain >= 3 && l.wind >= 3) return "storm";
  if (l.rain >= 2 && l.wind >= 3) return "gale with rain";
  if (l.rain >= 3) return "downpour";
  if (l.rain >= 1 && l.sun >= 1) return "sun shower";
  if (l.rain === 2) return "steady rain";
  if (l.rain === 1) return "drizzle";
  if (l.snow === 3) return "heavy snow";
  if (l.snow === 2) return "snow";
  if (l.snow === 1) return "flurries";
  if (l.sun >= 3 && l.wind >= 2) return "hot dry wind";
  if (l.sun >= 3) return "blistering sun";
  if (l.wind >= 3) return "gale";
  if (l.wind === 2) return "strong wind";
  if (l.sun === 2) return "bright sun";
  if (l.wind === 1) return "breeze";
  if (l.sun === 1) return "pale sun";
  return "still and overcast";
}
