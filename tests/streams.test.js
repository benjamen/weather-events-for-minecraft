import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { countFor, howlGap, leafSpot } from "../BP/scripts/streams.js";
import { windAt, windEffects } from "../BP/scripts/wind.js";

const seq = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test("streams: leaves start upwind of the player and blow downwind", () => {
  const rand = seq(3);
  for (let i = 0; i < 200; i++) {
    const wind = windAt(i * 7, 5, 3);
    const l = leafSpot({ x: 0, y: 64, z: 0 }, wind, rand);
    const along = (l.origin.x) * wind.x + (l.origin.z) * wind.z; // position along the wind
    assert.ok(along < 0, "upwind");
    assert.ok(Math.hypot(l.dir.x, l.dir.z) > 0.99 && l.dir.y > 0);
    assert.ok(l.origin.y >= 64.5 && l.origin.y <= 69.5);
    assert.ok(l.lifetime >= 2 && l.lifetime <= 7 && l.speed >= 0.5 && l.speed <= 8);
  }
});

test("streams: a stronger wind or gust blows leaves faster", () => {
  const calm = leafSpot({ x: 0, y: 0, z: 0 }, { x: 1, z: 0, gust: 0, strength: 0.3 }, () => 0.5);
  const gale = leafSpot({ x: 0, y: 0, z: 0 }, { x: 1, z: 0, gust: 1, strength: 1.4 }, () => 0.5);
  assert.ok(gale.speed > calm.speed * 2);
});

test("streams: counts average out to the rate, none when calm", () => {
  const rand = seq(11);
  let total = 0;
  for (let i = 0; i < 4000; i++) total += countFor(9, 0.2, rand);
  assert.ok(Math.abs(total / 4000 - 1.8) < 0.1);
  assert.equal(countFor(0, 0.2, rand), 0);
  assert.equal(windEffects({ strength: 0 }).particlesPerSecond, 0);
});

test("streams: howls come faster in stronger wind and not at all in a breeze", () => {
  assert.equal(howlGap(0.3), Infinity);
  assert.ok(howlGap(1.4) < howlGap(0.7));
  assert.ok(howlGap(1.6) >= 4);
});

test("streams: the particle, texture and sound exist and agree with the glue", () => {
  const rp = (p) => new URL(`../RP/${p}`, import.meta.url);
  const particle = JSON.parse(readFileSync(rp("particles/wx_leaf.json"), "utf8")).particle_effect;
  assert.equal(particle.description.identifier, "wx:leaf");
  assert.ok(existsSync(rp(`${particle.description.basic_render_parameters.texture}.png`)));
  const defs = JSON.parse(readFileSync(rp("sounds/sound_definitions.json"), "utf8")).sound_definitions;
  for (const f of defs["wx.wind"].sounds) assert.ok(existsSync(rp(`${f.name}.ogg`)));
  const glue = readFileSync(new URL("../BP/scripts/wind-streams.js", import.meta.url), "utf8");
  const used = [...JSON.stringify(particle).matchAll(/variable\.([a-z_]+)/g)].map((m) => m[1]).filter((v) => v !== "particle_age");
  for (const v of new Set(used)) assert.ok(glue.includes(`setFloat("${v}"`), `${v} is set by the glue`);
  assert.match(readFileSync(new URL("../BP/scripts/main.js", import.meta.url), "utf8"), /startWindStreams\(/);
});
