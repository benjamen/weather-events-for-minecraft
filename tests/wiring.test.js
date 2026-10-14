import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fogDefinitions } from "../BP/scripts/kit/fog.js";
import { FRONTS } from "../BP/scripts/forecast.js";

const read = (p) => readFileSync(new URL(`../BP/scripts/${p}`, import.meta.url), "utf8");

test("weather asks the shared fog mixer rather than pushing fog itself, and main starts it", () => {
  const src = read("weather.js");
  assert.match(src, /startFogMixer\(/);
  assert.match(src, /setFog\(`wx_/);
  assert.doesNotMatch(src, /fog @s/, "only the kit's mixer may run the fog command");
  assert.match(read("main.js"), /startWeather\(\)/);
});

test("the pack id comes from this pack's manifest, so the fog mixers of several packs can elect one owner", () => {
  const bp = JSON.parse(readFileSync(new URL("../BP/manifest.json", import.meta.url), "utf8"));
  assert.ok(read("weather.js").includes(`"weather-events-${bp.header.uuid.slice(0, 8)}"`));
});

test("every tint the weather asks for is in the fog ladder, and the ladder is in the resource pack", () => {
  const tints = [...read("weather.js").matchAll(/tint: "(\w+)"/g)].map((m) => m[1]);
  assert.ok(tints.length >= 3);
  const defs = fogDefinitions();
  for (const t of tints) assert.ok(defs.some((d) => d.id.includes(`fog_${t}_`)), `no fog tint called ${t}`);
  for (const d of defs) assert.ok(existsSync(new URL(`../RP/fogs/${d.file}`, import.meta.url)), `${d.file} is missing: run npm run sync-kit`);
});

test("the testing front names are real forecast fronts", () => {
  assert.ok("storm" in FRONTS && "blizzard" in FRONTS && "scorcher" in FRONTS);
});
