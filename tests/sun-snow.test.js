import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { daylight, glareFog, sunEffects } from "../BP/scripts/sun.js";
import { attemptsPerSecond, holdsSnow, maxLayers, meltSeconds, stepSnow } from "../BP/scripts/snow.js";

test("sun: nothing below a hot day, and shade, water or a roof cancel everything", () => {
  assert.equal(sunEffects(1).hunger, -1);
  assert.equal(sunEffects(3, { exposed: false }).burnEvery, Infinity);
  assert.equal(sunEffects(3, { inWater: true }).slowness, -1);
});

test("sun: the hotter the sun the worse it gets, and a helmet takes the burn away", () => {
  const hot = sunEffects(2), blister = sunEffects(3), hat = sunEffects(3, { helmet: true });
  assert.ok(hot.hunger >= 0 && hot.burnEvery === Infinity);
  assert.ok(blister.hunger >= hot.hunger && blister.slowness >= 0);
  assert.ok(blister.burnEvery >= 8 && blister.burnEvery < 30);
  assert.equal(hat.burnEvery, Infinity);
  assert.ok(hat.thirst < blister.thirst);
});

test("sun: haze only from a strong sun, and only by day", () => {
  assert.ok(Math.abs(glareFog(1).distance - 200) < 1);
  assert.ok(glareFog(3).distance < glareFog(2).distance);
  assert.ok(daylight(6000) && !daylight(13000) && daylight(24000 + 100));
});

test("snow: heavier snow piles deeper and faster, none with no snow", () => {
  assert.equal(attemptsPerSecond(0), 0);
  assert.ok(attemptsPerSecond(3) > attemptsPerSecond(1));
  assert.deepEqual([1, 2, 3].map(maxLayers), [1, 3, 6]);
});

test("snow: layers grow up to the cap while it snows, then melt away when it stops", () => {
  let pile = { layers: 1, clock: 0 };
  for (let i = 0; i < 200; i++) pile = stepSnow(pile, 1, { snow: 3 });
  assert.equal(pile.layers, 6);
  for (let i = 0; i < 2000 && pile; i++) pile = stepSnow(pile, 1, { snow: 0, sun: 0 });
  assert.equal(pile, null, "it all melts in the end");
  const slow = meltSeconds({ sun: 0, temperature: 0.1 }), fast = meltSeconds({ sun: 3, temperature: 0.9 });
  assert.ok(fast < slow / 3);
});

test("snow: the pile lasts about its melting time, and ground that cannot hold snow is refused", () => {
  let pile = { layers: 4, clock: 0 }, t = 0;
  while (pile) { pile = stepSnow(pile, 1, { snow: 0 }); t++; }
  assert.ok(Math.abs(t - (meltSeconds({}) * 4) / 7) < 20, `${t}`);
  assert.ok(holdsSnow("minecraft:grass_block") && holdsSnow("minecraft:stone"));
  for (const no of ["minecraft:water", "minecraft:ice", "minecraft:oak_leaves", "minecraft:glass", "minecraft:oak_slab"]) assert.ok(!holdsSnow(no), no);
});

test("sun and snow are started", () => {
  const main = readFileSync(new URL("../BP/scripts/main.js", import.meta.url), "utf8");
  assert.match(main, /startSun\(/);
  assert.match(main, /startSnowLayers\(/);
});
