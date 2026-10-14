// Weather Events: a forecast, a seeded run of weather "fronts" (spells of weather that last a few minutes), so weather
// has a story instead of changing at random. Pure; the same seed gives the same forecast. Tested.
import { resolve } from "./channels.js";

// Spell templates. `after` lists which spells can follow, with weights, so a blizzard does not turn into a heatwave.
export const FRONTS = {
  still: { levels: { sun: 1 }, minutes: [2, 5], after: { breezy: 3, bright: 3, overcast: 2, still: 1 } },
  breezy: { levels: { wind: 1, sun: 2 }, minutes: [2, 5], after: { bright: 3, still: 2, overcast: 2, windy: 1 } },
  bright: { levels: { sun: 2 }, minutes: [3, 6], after: { scorcher: 2, breezy: 3, overcast: 2, still: 1 } },
  scorcher: { levels: { sun: 3 }, minutes: [2, 4], after: { bright: 3, breezy: 2, overcast: 1 } },
  overcast: { levels: {}, minutes: [1, 3], after: { drizzle: 4, snowing: 1, windy: 2, still: 2 } },
  windy: { levels: { wind: 2 }, minutes: [2, 4], after: { gale: 1, rain: 2, breezy: 3, overcast: 1 } },
  gale: { levels: { wind: 3 }, minutes: [1, 3], after: { storm: 2, windy: 3, breezy: 1 } },
  drizzle: { levels: { rain: 1 }, minutes: [2, 5], after: { rain: 3, still: 2, bright: 1, overcast: 1 } },
  rain: { levels: { rain: 2, wind: 1 }, minutes: [3, 6], after: { downpour: 2, drizzle: 3, still: 1, windy: 1 } },
  downpour: { levels: { rain: 3, wind: 2 }, minutes: [2, 4], after: { storm: 2, rain: 3, hail: 1 } },
  storm: { levels: { rain: 3, wind: 3, hail: 1 }, minutes: [2, 4], after: { downpour: 3, rain: 2, hail: 1 } },
  hail: { levels: { rain: 1, hail: 2 }, minutes: [1, 2], after: { rain: 3, drizzle: 2, storm: 1 } },
  snowing: { levels: { snow: 2 }, minutes: [3, 6], after: { blizzard: 2, flurries: 3, still: 1 } },
  flurries: { levels: { snow: 1 }, minutes: [2, 4], after: { snowing: 3, still: 2, bright: 1 } },
  blizzard: { levels: { snow: 3, wind: 3 }, minutes: [2, 4], after: { snowing: 3, flurries: 2 } },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A forecast of `count` fronts from time 0 (seconds). Returns [{ name, start, end, levels }], levels already resolved
// for the climate (`temperature`). `cold` climates only draw from the snow and dry spells.
export function makeForecast(seed, { count = 24, temperature = 0.5, first = "still" } = {}) {
  const rand = rng(seed);
  const cold = temperature <= 0.15;
  const allowed = (name) => (cold ? !["drizzle", "rain", "downpour", "storm", "hail", "scorcher"].includes(name) : !["snowing", "flurries", "blizzard"].includes(name));
  const out = [];
  let name = allowed(first) ? first : cold ? "flurries" : "still";
  let t = 0;
  for (let i = 0; i < count; i++) {
    const f = FRONTS[name];
    const len = Math.round((f.minutes[0] + rand() * (f.minutes[1] - f.minutes[0])) * 60);
    out.push({ name, start: t, end: t + len, levels: resolve(f.levels, { temperature }) });
    t += len;
    let options = Object.entries(f.after).filter(([n]) => allowed(n));
    if (cold && !options.length) options = [["flurries", 1]];
    if (!cold && name === "overcast" && !options.length) options = [["still", 1]];
    const total = options.reduce((s, [, w]) => s + w, 0);
    let pick = rand() * total;
    name = (options.find(([, w]) => (pick -= w) < 0) ?? options.at(-1))[0];
  }
  return out;
}

// The front running at `t` seconds. A forecast that has run out loops from its start.
export function frontAt(forecast, t) {
  const total = forecast.at(-1).end;
  const x = ((t % total) + total) % total;
  return forecast.find((f) => x >= f.start && x < f.end) ?? forecast.at(-1);
}

// What the barometer says: the front now, the next one, and how long until it changes (seconds).
export function outlook(forecast, t) {
  const now = frontAt(forecast, t);
  const total = forecast.at(-1).end;
  const x = ((t % total) + total) % total;
  const next = forecast[(forecast.indexOf(now) + 1) % forecast.length];
  return { now, next, secondsLeft: Math.max(0, Math.round(now.end - x)) };
}
