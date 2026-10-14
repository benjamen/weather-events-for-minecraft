// Weather Events, the Minecraft side: runs the forecast, eases the five channels toward it, drives the base game's rain
// and thunder, asks the shared fog mixer for the haze of each kind of weather, and shoves players about in strong
// wind. The rules are in channels.js, forecast.js and wind.js (pure, tested). This file is glue and has not been run
// in a game yet; see DESIGN.md for the first-run checklist.
import { WeatherType, system, world } from "@minecraft/server";
import { clearFog, setFog, startFogMixer } from "./kit/fog-mixer.js";
import { knock } from "./kit/effects.js";
import { approach, byLevel, levelOf } from "./kit/intensity.js";
import { skyExposed } from "./kit/shelter.js";
import { CHANNELS, CLEAR, describeWeather, resolve } from "./channels.js";
import { FRONTS, frontAt, makeForecast, outlook } from "./forecast.js";
import { inLee, pushPerSecond, upwindSamples, windAt } from "./wind.js";

export const PACK_ID = "weather-events-53dc2538";
const CLIMATES = { cold: 0, temperate: 0.5, hot: 1.2 };
const log = (msg) => console.warn(`[Weather] ${msg}`);

const state = {
  levels: { ...CLEAR }, // what is happening now, eased
  manual: undefined, // levels forced by /scriptevent wx:set, or undefined to follow the forecast
  forecast: undefined,
  shown: {}, // the whole levels last announced
  vanilla: "Clear",
};

const climate = () => CLIMATES[world.getDynamicProperty("wx:climate")] ?? CLIMATES.temperate;
const seed = () => {
  const s = world.getDynamicProperty("wx:seed");
  return typeof s === "number" ? s : 1;
};
const seconds = () => {
  try {
    return world.getAbsoluteTime() / 20;
  } catch {
    return system.currentTick / 20;
  }
};

function targets() {
  if (state.manual) return resolve(state.manual, { temperature: climate() });
  if (!state.forecast) state.forecast = makeForecast(seed(), { temperature: climate() });
  return frontAt(state.forecast, seconds()).levels;
}

// The base game has one rain and one thunder, on or off. Our levels decide when to switch them on; the fog and the
// rest carry the difference between a drizzle and a downpour.
function applyVanilla() {
  const l = state.levels;
  const want = l.hail >= 1.5 || (l.rain >= 2.5 && l.wind >= 2.5) ? "Thunder" : l.rain >= 1.5 || l.snow >= 1.5 || l.hail >= 0.5 ? "Rain" : "Clear";
  if (want === state.vanilla) return;
  state.vanilla = want;
  try {
    world.getDimension("overworld").setWeather(WeatherType[want], 24000);
  } catch (e) {
    log(`setWeather failed: ${e}`);
  }
}

// Haze of each kind of weather, in blocks of visibility, asked of the shared mixer so it combines with the night and
// with everything else. Level 0 asks for nothing.
const HAZE = {
  rain: { table: [200, 90, 48, 24], tint: "grey" },
  snow: { table: [200, 70, 30, 9], tint: "snow" },
  hail: { table: [200, 80, 40, 20], tint: "grey" },
};
function applyFog() {
  for (const [channel, { table, tint }] of Object.entries(HAZE)) {
    const level = state.levels[channel];
    if (level < 0.05) clearFog(`wx_${channel}`, "*");
    else setFog(`wx_${channel}`, "*", { distance: Math.exp(byLevel(table.map(Math.log), level)), tint });
  }
}

function applyWind(dt) {
  const level = state.levels.wind;
  if (level < 1.5) return;
  const wind = windAt(seconds(), seed(), level);
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    let sheltered = !skyExposed(player.dimension, player.location);
    if (!sheltered) {
      const flags = upwindSamples(player.location, wind).map((p) => {
        try {
          const b = player.dimension.getBlock(p);
          return Boolean(b) && !b.isAir && !b.isLiquid;
        } catch {
          return false;
        }
      });
      sheltered = inLee(flags);
    }
    const push = pushPerSecond(wind, level, { sneaking: player.isSneaking, sheltered, airborne: !player.isOnGround && !player.isInWater, inWater: player.isInWater });
    if (push.x || push.z) knock(player, { x: push.x * dt, z: push.z * dt }, 0);
  }
}

function announce() {
  const whole = Object.fromEntries(CHANNELS.map((c) => [c, levelOf(state.levels[c], state.shown[c])]));
  if (CHANNELS.every((c) => whole[c] === state.shown[c])) return;
  state.shown = whole;
  log(`weather is now ${describeWeather(whole)} ${JSON.stringify(whole)}`);
  try {
    system.sendScriptEvent("wx:changed", JSON.stringify(whole)); // other packs and games can listen for this
  } catch {
    // this game build has no script events between packs
  }
}

function tick() {
  const goal = targets();
  for (const c of CHANNELS) state.levels[c] = approach(state.levels[c], goal[c], 0.5, { up: 0.05, down: 0.04 });
  applyVanilla();
  applyFog();
  announce();
}

// The channels right now, for other parts of the pack (puddles read the rain, sun and wind from here).
export const currentLevels = () => state.levels;

export function startWeather() {
  startFogMixer({ packId: PACK_ID, log });
  system.runInterval(tick, 10);
  system.runInterval(() => applyWind(0.2), 4);
  // Testing aids, from chat: /scriptevent wx:set rain 2 wind 3, wx:front storm, wx:auto, wx:climate cold|temperate|hot,
  // wx:seed 12, wx:status
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (!id.startsWith("wx:") || id === "wx:changed") return;
    const say = (text) => sourceEntity?.sendMessage?.(`[Weather] ${text}`);
    const words = message.trim().split(/\s+/).filter(Boolean);
    if (id === "wx:set") {
      const asked = {};
      for (let i = 0; i + 1 < words.length; i += 2) if (CHANNELS.includes(words[i])) asked[words[i]] = Number(words[i + 1]);
      state.manual = asked;
      say(`forcing ${JSON.stringify(asked)}`);
    } else if (id === "wx:front") {
      const f = FRONTS[words[0]];
      if (!f) say(`fronts: ${Object.keys(FRONTS).join(", ")}`);
      else {
        state.manual = f.levels;
        say(`front ${words[0]}`);
      }
    } else if (id === "wx:auto") {
      state.manual = undefined;
      say("following the forecast");
    } else if (id === "wx:climate") {
      world.setDynamicProperty("wx:climate", words[0] in CLIMATES ? words[0] : "temperate");
      state.forecast = undefined;
      say(`climate ${words[0]}`);
    } else if (id === "wx:seed") {
      world.setDynamicProperty("wx:seed", Number(words[0]) || 1);
      state.forecast = undefined;
      say(`seed ${seed()}`);
    } else if (id === "wx:status") {
      if (!state.forecast) state.forecast = makeForecast(seed(), { temperature: climate() });
      const o = outlook(state.forecast, seconds());
      say(`${describeWeather(state.shown)} ${JSON.stringify(state.shown)}; forecast: ${o.now.name} for ${o.secondsLeft}s, then ${o.next.name}${state.manual ? " (forced)" : ""}`);
    }
  });
  log("started");
}
