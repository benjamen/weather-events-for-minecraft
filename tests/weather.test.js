import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANNELS, CLEAR, describeWeather, resolve } from "../BP/scripts/channels.js";
import { FRONTS, frontAt, makeForecast, outlook } from "../BP/scripts/forecast.js";
import { MAX_SIZE, attemptsPerSecond, dryingSeconds, groundChance, maxSize, puddleSpot, stepPuddle } from "../BP/scripts/puddles.js";
import { inLee, pushPerSecond, upwindSamples, windAt, windEffects } from "../BP/scripts/wind.js";

test("combinations make sense: hail needs a storm, the sky is shared between sun and wet weather", () => {
  assert.deepEqual(resolve({}), CLEAR);
  const hail = resolve({ hail: 2 });
  assert.ok(hail.rain >= 1 && hail.hail <= hail.rain, "hail brings rain with it and cannot outdo it");
  assert.equal(resolve({ sun: 3, rain: 3 }).sun, 0, "no blistering sun in a downpour");
  assert.equal(resolve({ sun: 3, rain: 1 }).sun, 1, "a sun shower is light");
  assert.equal(resolve({ sun: 3 }).sun, 3);
  assert.deepEqual(resolve({ rain: 2, wind: 3 }), { ...CLEAR, rain: 2, wind: 3 }, "rain and wind combine freely");
  assert.equal(resolve({ rain: 9, wind: -4 }).rain, 3, "values are clamped to the scale");
  assert.equal(resolve({ wind: -4 }).wind, 0);
});

test("climate: in the cold rain falls as snow and there is no hail; where it is warm there is no snow; hot makes sun worse", () => {
  const cold = resolve({ rain: 3, hail: 2, wind: 1 }, { temperature: 0 });
  assert.equal(cold.rain, 0);
  assert.equal(cold.hail, 0);
  assert.equal(cold.snow, 3);
  assert.equal(resolve({ snow: 3 }, { temperature: 0.8 }).snow, 0);
  assert.equal(resolve({ sun: 3 }, { temperature: 0 }).sun, 2, "glare is milder in the cold");
  assert.equal(resolve({ sun: 1 }, { temperature: 1.2 }).sun, 2, "the desert makes it hotter");
  assert.equal(resolve({ sun: 1, rain: 3 }, { temperature: 1.2 }).sun, 0);
});

test("weather has names, and combinations get their own: gale, blizzard, storm, sun shower", () => {
  assert.equal(describeWeather(CLEAR), "still and overcast");
  assert.equal(describeWeather({ snow: 3, wind: 3 }), "blizzard");
  assert.equal(describeWeather({ rain: 3, wind: 3 }), "storm");
  assert.equal(describeWeather({ rain: 1, sun: 1 }), "sun shower");
  assert.equal(describeWeather({ wind: 3 }), "gale");
  assert.equal(describeWeather({ sun: 3 }), "blistering sun");
  assert.equal(describeWeather({ sun: 3, wind: 2 }), "hot dry wind");
  assert.equal(describeWeather({ rain: 1, hail: 2 }), "hailstorm");
  const names = new Set();
  for (const r of [0, 1, 2, 3]) for (const w of [0, 1, 2, 3]) for (const s of [0, 1, 2, 3]) names.add(describeWeather({ rain: r, wind: w, sun: s }));
  assert.ok(names.size >= 10, `only ${names.size} different names`);
});

test("forecast: seeded and repeatable, back to back, every front legal, and weather moves in believable steps", () => {
  const a = makeForecast(42), b = makeForecast(42), c = makeForecast(43);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((f) => f.name), c.map((f) => f.name));
  assert.equal(a[0].start, 0);
  for (let i = 1; i < a.length; i++) assert.equal(a[i].start, a[i - 1].end, "fronts must be back to back");
  for (const f of a) {
    assert.ok(f.name in FRONTS);
    assert.ok(f.end - f.start >= 60, "a front lasts at least a minute");
    for (const ch of CHANNELS) assert.ok(f.levels[ch] >= 0 && f.levels[ch] <= 3);
  }
  for (let i = 1; i < a.length; i++) assert.ok(a[i].name in FRONTS[a[i - 1].name].after, `${a[i - 1].name} cannot be followed by ${a[i].name}`);
});

test("forecast: the same rules hold across many seeds, and cold climates only snow, warm ones never do", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    for (const f of makeForecast(seed, { temperature: 0.8, count: 30 })) {
      seen.add(f.name);
      assert.equal(f.levels.snow, 0, `${f.name} snows in a warm climate`);
    }
    for (const f of makeForecast(seed, { temperature: 0, count: 30 })) {
      assert.equal(f.levels.rain, 0, `${f.name} rains in the cold`);
      assert.equal(f.levels.hail, 0);
    }
  }
  assert.ok(["storm", "scorcher", "gale", "hail", "downpour"].every((n) => seen.has(n)), `never saw: ${["storm", "scorcher", "gale", "hail", "downpour"].filter((n) => !seen.has(n))}`);
});

test("forecast: the barometer reads the current front, the next, and the time to the change; the forecast loops", () => {
  const f = makeForecast(7);
  const o = outlook(f, 5);
  assert.equal(o.now, f[0]);
  assert.equal(o.next, f[1]);
  assert.equal(o.secondsLeft, f[0].end - 5);
  assert.equal(frontAt(f, f.at(-1).end + 5), f[0], "it loops");
  assert.equal(frontAt(f, f[1].start), f[1]);
  assert.equal(outlook(f, f.at(-1).end - 1).next, f[0], "the last front is followed by the first");
});

test("puddles: more attempts and deeper water as the rain gets heavier, none without rain", () => {
  assert.equal(attemptsPerSecond(0), 0);
  assert.ok(attemptsPerSecond(1) < attemptsPerSecond(2) && attemptsPerSecond(2) < attemptsPerSecond(3));
  assert.equal(maxSize(0), 0);
  assert.equal(maxSize(3), MAX_SIZE, "a downpour makes a quarter-block puddle");
  assert.ok(maxSize(1) < maxSize(3));
  assert.equal(MAX_SIZE, 4, "four sixteenths: a quarter of a block");
});

test("puddles: sun and wind dry them, and together they dry them fastest", () => {
  const still = dryingSeconds(), sun = dryingSeconds({ sun: 3 }), wind = dryingSeconds({ wind: 3 }), both = dryingSeconds({ sun: 3, wind: 3 });
  assert.ok(sun < still && wind < still && both < sun && both < wind);
  assert.ok(dryingSeconds({ sun: 1 }) > dryingSeconds({ sun: 2 }));
  assert.ok(both >= 10, "never instant");
});

test("puddles: stone holds water, soil less, sand little, and glass, leaves, ice and water none", () => {
  assert.equal(groundChance("minecraft:stone"), 1);
  assert.equal(groundChance("minecraft:oak_planks"), 1);
  assert.equal(groundChance("minecraft:cobblestone"), 1);
  assert.equal(groundChance("minecraft:grass_block"), 0.6);
  assert.equal(groundChance("minecraft:sand"), 0.3);
  for (const id of ["minecraft:water", "minecraft:ice", "minecraft:oak_leaves", "minecraft:glass", "minecraft:snow_layer", "minecraft:white_carpet", "minecraft:stone_slab", "minecraft:oak_stairs", "minecraft:air", "minecraft:farmland"]) assert.equal(groundChance(id), 0, id);
  assert.ok(puddleSpot({ above: "minecraft:air", ground: "minecraft:stone", skyOpen: true }));
  assert.ok(!puddleSpot({ above: "minecraft:air", ground: "minecraft:stone", skyOpen: false }), "roofs keep the ground dry");
  assert.ok(!puddleSpot({ above: "minecraft:tall_grass", ground: "minecraft:stone", skyOpen: true }));
  assert.ok(!puddleSpot({ above: "minecraft:air", ground: "minecraft:stone", skyOpen: true, existing: true }));
});

test("puddles: they grow in rain up to the rain's limit, then shrink and vanish when it stops", () => {
  let p = { size: 1, dry: 0 };
  for (let i = 0; i < 100; i++) p = stepPuddle(p, 1, { rain: 3 });
  assert.equal(p.size, 4, "a downpour fills it to a quarter block");
  let light = { size: 1, dry: 0 };
  for (let i = 0; i < 100; i++) light = stepPuddle(light, 1, { rain: 1 });
  assert.equal(light.size, 1, "drizzle never gets past a film");
  let t = 0;
  let q = p;
  while (q && t < 1000) {
    q = stepPuddle(q, 1, { rain: 0 });
    t++;
  }
  assert.equal(q, null, "it dries up");
  assert.ok(Math.abs(t - dryingSeconds()) < 5, `a full puddle lasts about its drying time, not ${t}s`);
  let sunny = p, s = 0;
  while (sunny && s < 1000) {
    sunny = stepPuddle(sunny, 1, { rain: 0, sun: 3 });
    s++;
  }
  assert.ok(s < t / 3, "sun dries it far faster");
  const back = stepPuddle({ size: 2, dry: 50 }, 1, { rain: 2 });
  assert.equal(back.dry, 0, "rain resets the drying clock");
});

test("wind: repeatable, a unit direction, gusts that come and go, stronger when the level is higher", () => {
  const w = windAt(100, 5, 2);
  assert.deepEqual(w, windAt(100, 5, 2));
  assert.ok(Math.abs(Math.hypot(w.x, w.z) - 1) < 1e-9);
  let min = 9, max = 0;
  for (let t = 0; t < 600; t += 1) {
    const g = windAt(t, 5, 3).gust;
    min = Math.min(min, g);
    max = Math.max(max, g);
    assert.ok(g >= 0 && g <= 1);
  }
  assert.ok(max - min > 0.5, `no real gusts (${min}..${max})`);
  const mean = (level) => { let s = 0; for (let t = 0; t < 600; t++) s += windAt(t, 5, level).strength; return s / 600; };
  assert.equal(mean(0), 0);
  assert.ok(mean(1) < mean(2) && mean(2) < mean(3));
  assert.notDeepEqual(windAt(100, 5, 2), windAt(100, 6, 2), "another seed, another wind");
});

test("wind: the direction drifts slowly rather than jumping", () => {
  let prev = windAt(0, 3, 2);
  for (let t = 1; t < 1200; t++) {
    const now = windAt(t, 3, 2);
    const turn = Math.acos(Math.min(1, prev.x * now.x + prev.z * now.z));
    assert.ok(turn < 0.1, `turned ${turn} radians in a second at ${t}`);
    prev = now;
  }
});

test("wind: light wind never pushes; medium nudges in gusts; strong pushes steadily, hard in a gust", () => {
  const calm = { x: 1, z: 0, gust: 0 }, gust = { x: 1, z: 0, gust: 1 };
  assert.deepEqual(pushPerSecond(gust, 1), { x: 0, z: 0 });
  assert.equal(pushPerSecond(calm, 2).x, 0, "medium wind does nothing between gusts");
  assert.ok(pushPerSecond(gust, 2).x > 0, "but a gust moves you");
  assert.ok(pushPerSecond(calm, 3).x > 0, "strong wind always pushes");
  assert.ok(pushPerSecond(gust, 3).x > pushPerSecond(calm, 3).x * 2);
  assert.equal(pushPerSecond(gust, 3).z, 0, "downwind only");
  assert.ok(pushPerSecond({ x: 0, z: -1, gust: 1 }, 3).z < 0, "pushed the way it blows");
});

test("wind: crouching braces you, shelter and the lee stop it, jumping makes it worse, water slows it", () => {
  const w = { x: 1, z: 0, gust: 1 };
  const base = pushPerSecond(w, 3).x;
  assert.equal(pushPerSecond(w, 3, { sneaking: true }).x, base * 0.25);
  assert.deepEqual(pushPerSecond(w, 3, { sheltered: true }), { x: 0, z: 0 });
  assert.ok(pushPerSecond(w, 3, { airborne: true }).x > base);
  assert.ok(pushPerSecond(w, 3, { inWater: true }).x < base);
  const samples = upwindSamples({ x: 10.5, y: 64, z: 10.5 }, { x: 1, z: 0 });
  assert.equal(samples.length, 6);
  assert.ok(samples.every((s) => s.x < 10), "cover is looked for upwind, where the wind comes from");
  assert.ok(inLee([false, false, true]) && !inLee([false, false]));
});

test("wind: leaves and howl scale with the wind and stay in range", () => {
  assert.equal(windEffects({ strength: 0 }).particlesPerSecond, 0);
  const light = windEffects({ strength: 0.4 }), gale = windEffects({ strength: 1.5 });
  assert.ok(gale.particlesPerSecond > light.particlesPerSecond);
  assert.ok(gale.howlVolume > light.howlVolume && gale.howlVolume <= 1.2);
  assert.ok(gale.howlPitch > light.howlPitch);
});
