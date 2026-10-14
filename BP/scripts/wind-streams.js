// Weather Events, wind on the Minecraft side: spawns the `wx:leaf` particles upwind of each player and plays the
// howl. The rules are in streams.js and wind.js (pure, tested). Glue, not run in a game yet.
import { MolangVariableMap, system, world } from "@minecraft/server";
import { countFor, howlGap, leafSpot } from "./streams.js";
import { windEffects } from "./wind.js";

const INTERVAL = 4;
const lastHowl = new Map();
const log = (msg) => console.warn(`[Weather] ${msg}`);

// `wind` is a function returning the current wind object (windAt's answer, strength 0 when calm).
export function startWindStreams(wind) {
  system.runInterval(() => {
    const w = wind();
    const fx = windEffects(w);
    const now = system.currentTick;
    for (const player of world.getAllPlayers()) {
      if (player.dimension.id !== "minecraft:overworld") continue;
      const n = countFor(fx.particlesPerSecond, INTERVAL / 20, Math.random);
      for (let i = 0; i < n; i++) {
        const leaf = leafSpot(player.location, w, Math.random);
        const vars = new MolangVariableMap();
        vars.setFloat("dir_x", leaf.dir.x);
        vars.setFloat("dir_y", leaf.dir.y);
        vars.setFloat("dir_z", leaf.dir.z);
        vars.setFloat("speed", leaf.speed);
        vars.setFloat("life", leaf.lifetime);
        try {
          player.dimension.spawnParticle("wx:leaf", leaf.origin, vars);
        } catch {
          // unloaded chunk
        }
      }
      const gap = howlGap(w.strength) * 20;
      if (now - (lastHowl.get(player.id) ?? -1e9) >= gap) {
        lastHowl.set(player.id, now);
        try {
          player.playSound("wx.wind", { volume: fx.howlVolume, pitch: fx.howlPitch });
        } catch {
          // player gone
        }
      }
    }
  }, INTERVAL);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => lastHowl.delete(playerId));
  log("wind streams ready");
}
