// Weather Events: the cold. Out in wet, windy or misty weather, away from light and shelter, a player grows chilled;
// near a fire or a lamp, or under a roof, they warm again. Chill runs 0 to 100; past `slow` it slows you, past `hurt` it
// does a little harm. Pure: no Minecraft imports; the glue is chill-effects.js. Tested in tests/chill.test.js.
export const CHILL = { perSecond: 1.6, warmPerSecond: 4, slow: 45, hurt: 85, warmLight: 10, max: 100 };

// How cold the air is from the weather levels (0 to 3 each): rain and wind and mist together, snow coldest. 0 to 1.
export function coldness({ rain = 0, wind = 0, mist = 0, snow = 0, hail = 0 } = {}) {
  const c = rain * 0.12 + wind * 0.12 + mist * 0.1 + snow * 0.25 + hail * 0.1;
  return Math.min(1, c);
}

// One second of chill. `ctx`: { levels, exposed (open to the sky), light (block light where you stand, 0 to 15) }.
export function chillStep(chill, { levels, exposed, light }, c = CHILL) {
  const warm = light >= c.warmLight || !exposed;
  if (warm) return Math.max(0, chill - c.warmPerSecond * (light >= c.warmLight ? 1.5 : 1));
  const cold = coldness(levels);
  if (cold <= 0.15) return Math.max(0, chill - 1);
  return Math.min(c.max, chill + c.perSecond * cold * 2);
}

// What the chill does: { slow (amplifier, or -1), hurt (true/false), tint (fog distance in blocks, or 0) }.
export function chillEffects(chill, c = CHILL) {
  return {
    slow: chill >= c.slow ? (chill >= c.hurt ? 1 : 0) : -1,
    hurt: chill >= c.hurt,
    tint: chill >= c.slow ? Math.round(80 - (chill - c.slow) * 0.8) : 0,
  };
}
