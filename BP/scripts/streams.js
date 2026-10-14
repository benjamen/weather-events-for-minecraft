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
