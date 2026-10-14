import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANNELS, describeWeather, resolve } from "../BP/scripts/channels.js";
import { FRONTS, makeForecast } from "../BP/scripts/forecast.js";

test("mist: a sixth channel, clear by default", () => {
  assert.ok(CHANNELS.includes("mist"));
  assert.equal(resolve({}).mist, 0);
  assert.equal(resolve({ mist: 2 }, { temperature: 0.5 }).mist, 2);
});

test("mist: wind blows it away, hail and a strong sun clear it, and thick mist hides the sun", () => {
  assert.equal(resolve({ mist: 3, wind: 3 }).mist, 0);
  assert.equal(resolve({ mist: 3, wind: 2 }).mist, 1);
  assert.equal(resolve({ mist: 2, rain: 1, hail: 1 }).mist, 0);
  assert.equal(resolve({ mist: 3, sun: 3 }).mist, 0, "blistering sun burns it off");
  assert.equal(resolve({ mist: 3, sun: 2 }).sun, 0);
  assert.equal(resolve({ mist: 2, sun: 3 }).mist, 0);
  assert.ok(resolve({ mist: 1, sun: 2 }, { temperature: 0.5 }).sun <= 2);
});

test("mist: named, and the mist fronts follow each other sensibly in any climate", () => {
  assert.equal(describeWeather({ mist: 1 }), "mist");
  assert.equal(describeWeather({ mist: 2 }), "fog");
  assert.equal(describeWeather({ mist: 3 }), "dense fog");
  for (const name of ["mist", "fog", "thickfog"]) assert.ok(FRONTS[name], name);
  for (const t of [0.0, 0.5, 1.2]) {
    const f = makeForecast(11, { temperature: t, count: 80 });
    assert.ok(f.every((x) => CHANNELS.every((c) => x.levels[c] >= 0 && x.levels[c] <= 3)));
    if (t > 0.15) assert.ok(f.some((x) => x.levels.mist > 0), `a forecast at ${t} has some mist`);
  }
});
