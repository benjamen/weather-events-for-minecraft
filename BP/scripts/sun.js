// Weather Events: sun intensity. Level 1 is a bright day, 2 is hot, 3 is blistering: out in it without a hat or shade you
// get hungry, then slow, then burnt. Water, shade, roofs and a helmet all protect. Pure rules, tested; sun-effects.js applies.
import { byLevel, clamp } from "./kit/intensity.js";

// What the sun does to a player at a sun level (a float). `exposed` is true under open sky in daylight; `helmet` is any
// helmet; `inWater` cools you. Returns { hunger, slowness, burnEvery, thirst }: effect amplifiers (-1 for none), seconds
// between sunburn damage (Infinity for none), and 0 to 1 of how parched the action bar should say you are.
export function sunEffects(sun, { exposed = true, helmet = false, inWater = false } = {}) {
  const none = { hunger: -1, slowness: -1, burnEvery: Infinity, thirst: 0 };
  if (!exposed || inWater || sun < 1.5) return none;
  const heat = clamp((sun - 1.5) / 1.5, 0, 1) * (helmet ? 0.5 : 1); // 0 to 1
  return {
    hunger: heat > 0.2 ? Math.round(heat * 2) : -1,
    slowness: heat > 0.6 ? 0 : -1,
    burnEvery: helmet || sun < 2.5 ? Infinity : Math.max(8, 30 - (sun - 2.5) * 44),
    thirst: heat,
  };
}

// The warm haze a strong sun puts over the distance: seeing distance in blocks (200 means none) and the fog tint.
export const glareFog = (sun) => ({ distance: Math.exp(byLevel([Math.log(200), Math.log(200), Math.log(150), Math.log(70)], sun)), tint: "dust" });

// Is it bright enough outside for the sun to matter? Daytime ticks only: 0 (6am) to 12000 (6pm).
export const daylight = (tick) => ((tick % 24000) + 24000) % 24000 < 12000;
