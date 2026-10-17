import assert from "node:assert/strict";
import { test } from "node:test";
import { CHILL, chillEffects, chillStep, coldness } from "../BP/scripts/chill.js";

test("the cold builds in wet, windy, misty weather out in the open, and a roof or a light warms you", () => {
  const storm = { rain: 3, wind: 3 };
  let c = 0;
  for (let i = 0; i < 60; i++) c = chillStep(c, { levels: storm, exposed: true, light: 2 });
  assert.ok(c >= CHILL.slow, "a minute in a storm with no light chills you");
  const roofed = chillStep(c, { levels: storm, exposed: false, light: 2 });
  assert.ok(roofed < c, "a roof warms you");
  const fire = chillStep(c, { levels: storm, exposed: true, light: 14 });
  assert.ok(fire < roofed, "a fire warms you faster");
  assert.equal(chillStep(10, { levels: {}, exposed: true, light: 0 }), 9, "fair weather lets it ease off");
  assert.ok(coldness({ snow: 3 }) > coldness({ rain: 1 }));
});

test("chill slows you, then hurts a little, and tints the view", () => {
  assert.deepEqual(chillEffects(0), { slow: -1, hurt: false, tint: 0 });
  assert.equal(chillEffects(CHILL.slow).slow, 0);
  const worst = chillEffects(CHILL.max);
  assert.equal(worst.slow, 1);
  assert.ok(worst.hurt);
  assert.ok(worst.tint > 0 && worst.tint < 80);
});
