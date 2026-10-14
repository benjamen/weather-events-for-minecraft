import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { needle, pressure, readout, severity } from "../BP/scripts/barometer.js";
import { flakeSpot, flakesPerSecond } from "../BP/scripts/streams.js";
import { makeForecast, outlook } from "../BP/scripts/forecast.js";

const file = (p) => new URL(`../${p}`, import.meta.url);
const json = (p) => JSON.parse(readFileSync(file(p), "utf8"));

test("barometer: reads the weather and what comes next, with seconds or minutes", () => {
  const o = { now: { name: "gale", levels: { wind: 3 } }, next: { name: "rain", levels: { rain: 2 } }, secondsLeft: 130 };
  assert.match(readout(o), /gale.*next: rain in 2 min/);
  assert.match(readout({ ...o, secondsLeft: 45 }), /in 45 s/);
  assert.match(readout(o, { rain: 0, wind: 3, hail: 0, snow: 0, sun: 0 }), /^\S.* \| next: rain/);
});

test("barometer: pressure falls before a worse front and rises before a calmer one", () => {
  const calm = { name: "still", levels: {} }, storm = { name: "storm", levels: { rain: 3, wind: 3, hail: 2 } };
  assert.ok(pressure({ now: calm, next: storm }) < 0.25);
  assert.ok(pressure({ now: storm, next: calm }) > 0.65);
  assert.equal(pressure({ now: calm, next: calm }) > 0.45, true);
  assert.equal(needle(0.1), "falling fast");
  assert.equal(needle(0.9), "rising");
  assert.ok(severity({ rain: 3 }) > severity({ rain: 1 }));
});

test("barometer: works on a real forecast", () => {
  const f = makeForecast(5, { temperature: 0.5 });
  for (const t of [0, 100, 1000, 5000]) assert.ok(readout(outlook(f, t)).includes("next:"));
});

test("barometer: the item, recipe, icon and name all exist and agree", () => {
  const item = json("BP/items/barometer.json")["minecraft:item"];
  assert.equal(item.description.identifier, "wx:barometer");
  const icon = item.components["minecraft:icon"];
  const tex = json("RP/textures/item_texture.json").texture_data[icon].textures;
  assert.ok(existsSync(file(`RP/${tex}.png`)));
  assert.equal(json("BP/recipes/barometer.json")["minecraft:recipe_shaped"].result.item, "wx:barometer");
  assert.match(readFileSync(file("RP/texts/en_US.lang"), "utf8"), /item\.wx:barometer\.name=Barometer/);
  assert.match(readFileSync(file("BP/scripts/main.js"), "utf8"), /startBarometer\(/);
});

test("flakes: more with heavier snow, none without, falling from above and drifting with the wind", () => {
  assert.equal(flakesPerSecond(0), 0);
  assert.ok(flakesPerSecond(3) > flakesPerSecond(1) * 3);
  let s = 5;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 100; i++) {
    const f = flakeSpot({ x: 0, y: 64, z: 0 }, { x: 1, z: 0, strength: 1 }, rand);
    assert.ok(f.origin.y >= 70 && f.origin.y <= 76 && Math.hypot(f.origin.x, f.origin.z) <= 12.001);
    assert.ok(f.dir.y < 0 && f.dir.x > 0);
  }
});

test("flake particle, texture and variables agree with the glue", () => {
  const particle = json("RP/particles/wx_flake.json").particle_effect;
  assert.ok(existsSync(file(`RP/${particle.description.basic_render_parameters.texture}.png`)));
  const glue = readFileSync(file("BP/scripts/wind-streams.js"), "utf8");
  for (const v of new Set([...JSON.stringify(particle).matchAll(/variable\.([a-z_]+)/g)].map((m) => m[1]))) assert.ok(glue.includes(`setFloat("${v}"`), v);
  assert.match(readFileSync(file("BP/scripts/main.js"), "utf8"), /startFlakes\(/);
});
