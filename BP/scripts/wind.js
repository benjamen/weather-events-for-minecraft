// Weather Events: wind. A wind that drifts round the compass, comes in gusts, and at the top of the scale shoves
// players downwind. Pure rules, tested; wind-push.js in the Minecraft side applies them.
import { byLevel, clamp } from "./kit/intensity.js";

// A smooth repeating noise in [-1, 1] built from three sine waves with seeded phases: no state, same answer for the
// same time, so every player and every pack sees the same wind.
function noise(t, seed, scale) {
  const p = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280 * Math.PI * 2;
  return (Math.sin(t / scale + p(1)) * 0.55 + Math.sin(t / (scale * 0.37) + p(2)) * 0.3 + Math.sin(t / (scale * 0.13) + p(3)) * 0.15);
}

// The wind at `t` seconds: a unit direction it blows toward, the gust now (0 calm to 1 full gust), and its strength
// (0 to about 1.6). `level` is the wind channel's level (a float).
export function windAt(t, seed, level) {
  const angle = noise(t, seed, 240) * Math.PI * 1.1 + (seed % 628) / 100; // drifts over minutes
  const gust = clamp((noise(t, seed + 7, 9) + 0.55) / 1.4, 0, 1) ** 2; // sharp surges every ten seconds or so
  const base = byLevel([0, 0.3, 0.65, 1], level);
  const gustiness = byLevel([0, 0.3, 0.45, 0.6], level);
  return { x: Math.cos(angle), z: Math.sin(angle), gust, strength: base * (1 + gust * gustiness) };
}

// The horizontal shove, per second, on a player. Light wind only moves leaves; medium nudges you in gusts; strong
// wind pushes steadily and hard in gusts. Crouching braces you, shelter stops it, the air catches you, water slows it.
export function pushPerSecond(wind, level, { sneaking = false, sheltered = false, airborne = false, inWater = false } = {}) {
  if (sheltered || level < 1.5) return { x: 0, z: 0 };
  let force = level < 2.5 ? Math.max(0, wind.gust - 0.45) * 0.6 : 0.5 + wind.gust * 1.2;
  if (sneaking) force *= 0.25;
  if (airborne) force *= 1.6;
  if (inWater) force *= 0.3;
  return { x: wind.x * force, z: wind.z * force };
}

// Positions to test for cover upwind of a player: the blocks a step, two and three blocks into the wind, at feet and
// head height. If any is solid the player is in the lee.
export function upwindSamples(pos, wind) {
  const out = [];
  for (const d of [1, 2, 3]) for (const h of [0, 1]) out.push({ x: Math.floor(pos.x - wind.x * d), y: Math.floor(pos.y) + h, z: Math.floor(pos.z - wind.z * d) });
  return out;
}

export const inLee = (solidFlags) => solidFlags.some(Boolean);

// How the wind looks and sounds: leaf and dust particles per second, and the howl's volume and pitch.
export function windEffects(wind) {
  return {
    particlesPerSecond: Math.round(byLevel([0, 3, 9, 20], clamp(wind.strength * 1.6, 0, 3))),
    howlVolume: clamp(wind.strength * 0.7, 0, 1.2),
    howlPitch: 0.7 + clamp(wind.strength, 0, 1.6) * 0.3,
  };
}
