// Weather Events: wind you can see and hear. Leaves and dust stream past on the wind, upwind of each player, and a
// howl plays when it blows hard. Pure rules, tested; wind-streams.js spawns them.
import { clamp } from "./kit/intensity.js";

// One leaf (or dust mote) for a player at `at` in `wind` (the object windAt returns). It starts upwind and a little to
// the side at a random height, and drifts downwind, faster in a gust.
export function leafSpot(at, wind, rand, { near = 5, far = 16 } = {}) {
  const back = near + rand() * (far - near), side = (rand() - 0.5) * 2 * far * 0.6;
  const speed = clamp(0.8 + wind.strength * 3.2 + wind.gust * 2, 0.5, 8);
  return {
    origin: { x: at.x - wind.x * back - wind.z * side, y: at.y + 0.5 + rand() * 5, z: at.z - wind.z * back + wind.x * side },
    dir: { x: wind.x, y: 0.15 + rand() * 0.2, z: wind.z },
    speed,
    lifetime: clamp((back + far) / speed, 2, 7),
  };
}

// How many to spawn this step: `perSecond` over `seconds`, with the fraction carried as a chance.
export function countFor(perSecond, seconds, rand) {
  const expected = perSecond * seconds;
  return Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
}

// The gap in seconds between howls (long when the wind is light, short in a gale); none below `min` strength.
export const howlGap = (strength) => (strength < 0.55 ? Infinity : clamp(14 - strength * 8, 4, 14));

// Snowflakes: where one starts for a player at `at`, within `radius` and high enough to fall a while, and how it moves (it
// sinks slowly and the wind carries it sideways).
export function flakeSpot(at, wind, rand, { radius = 12 } = {}) {
  const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
  return {
    origin: { x: at.x + Math.cos(a) * r, y: at.y + 6 + rand() * 6, z: at.z + Math.sin(a) * r },
    dir: { x: wind.x * wind.strength * 0.6, y: -1, z: wind.z * wind.strength * 0.6 },
    speed: 0.5 + wind.strength * 0.8 + rand() * 0.3,
    lifetime: 7 + rand() * 3,
  };
}

// Flakes per second near a player at a snow level (a float on the 0 to 3 scale): a flurry up to a blizzard.
export const flakesPerSecond = (snow) => Math.round(snow <= 0 ? 0 : snow * snow * 7 + snow * 6);
