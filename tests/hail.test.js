import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { breaksGlass, landingSound, stone, stoneDamage, stoneSpot, stonesPerSecond } from "../BP/scripts/hail.js";

test("hail: more stones as the level rises, none with no hail", () => {
  assert.equal(stonesPerSecond(0), 0);
  assert.ok(stonesPerSecond(1) < stonesPerSecond(2) && stonesPerSecond(2) < stonesPerSecond(3));
  assert.ok(stonesPerSecond(1.5) > stonesPerSecond(1) && stonesPerSecond(1.5) < stonesPerSecond(2));
});

test("hail: pea-sized stones are harmless, marbles sting, golf balls hurt and fall fastest", () => {
  assert.equal(stone(1).damage, 0);
  assert.ok(stone(2).damage > 0 && stone(3).damage > stone(2).damage);
  assert.ok(stone(1).speed < stone(2).speed && stone(2).speed < stone(3).speed);
  assert.equal(stone(1).glass + stone(2).glass, 0, "only the big stones break glass");
  assert.ok(stone(3).glass > 0 && stone(3).glass < 1);
  assert.equal(stone(9).name, "golf ball", "levels clamp");
  assert.equal(stone(0).name, "pea");
});

test("hail: a helmet takes most of the sting but a real stone always does something", () => {
  assert.equal(stoneDamage(1), 0);
  assert.equal(stoneDamage(1, { helmet: true }), 0, "a pea is harmless even bare-headed");
  assert.equal(stoneDamage(3), stone(3).damage);
  assert.ok(stoneDamage(3, { helmet: true }) < stoneDamage(3));
  assert.ok(stoneDamage(2, { helmet: true }) >= 1);
});

test("hail: stones start high above the highest block, land near the player, and never inside the player's own spot only", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const s = stoneSpot({ x: 100, y: 64, z: -40 }, 70, rand);
    assert.ok(Math.hypot(s.target.x - 100, s.target.z + 40) <= 14.001, "lands within the radius");
    assert.equal(s.target.y, 71, "aimed at the top of whatever is there");
    assert.ok(s.start.y >= 70 + 18 && s.start.y <= 70 + 24.001, "starts well above it, in open sky");
    assert.ok(Math.abs(s.start.x - s.target.x) <= 1.5 && Math.abs(s.start.z - s.target.z) <= 1.5, "and falls nearly straight down");
  }
});

test("hail: stones sound like what they land on, glass loudest, and bigger stones louder", () => {
  assert.equal(landingSound("minecraft:oak_planks", 2).id, "dig.wood");
  assert.equal(landingSound("minecraft:glass_pane", 2).id, "dig.glass");
  assert.equal(landingSound("minecraft:copper_block", 2).id, "note.hat");
  assert.equal(landingSound("minecraft:stone_bricks", 2).id, "dig.stone");
  assert.equal(landingSound("minecraft:grass_block", 2).id, "dig.grass");
  assert.ok(landingSound("minecraft:stone", 3).volume > landingSound("minecraft:stone", 1).volume);
  assert.ok(landingSound("minecraft:glass", 2).volume > landingSound("minecraft:stone", 2).volume);
  assert.ok(landingSound("minecraft:stone", 1).pitch > landingSound("minecraft:stone", 3).pitch, "small stones tick higher");
});

test("hail: only big stones break glass, sometimes, and nothing else", () => {
  const always = () => 0, never = () => 0.99;
  assert.ok(breaksGlass("minecraft:glass_pane", 3, always));
  assert.ok(!breaksGlass("minecraft:glass_pane", 3, never));
  assert.ok(!breaksGlass("minecraft:glass_pane", 2, always), "marbles do not");
  assert.ok(!breaksGlass("minecraft:stone", 3, always));
});

test("hail: stones are tagged snowballs so other snowballs are left alone, damage and glass have off switches, and it is started", () => {
  const src = readFileSync(new URL("../BP/scripts/hail-stones.js", import.meta.url), "utf8");
  assert.match(src, /tag: TAG/);
  assert.equal([...src.matchAll(/hasTag\(TAG\)/g)].length, 2, "both hit hooks check the tag");
  assert.match(src, /wx:hail_damage/);
  assert.match(src, /wx:hail_glass/);
  assert.match(readFileSync(new URL("../BP/scripts/main.js", import.meta.url), "utf8"), /startHail\(/);
});
