// Weather Events: the cold, in the game (rules in chill.js). Every second per player: how exposed and how lit they are,
// the chill that follows, and what it does: a frost-white edge to the fog (through the shared fog mixer), slowness, and
// at the worst a little harm. `/scriptevent wx:chill off` switches it off for a world; `on` back on (on by default).
import { system, world } from "@minecraft/server";
import { clearFog, setFog } from "./kit/fog-mixer.js";
import { skyExposed } from "./kit/shelter.js";
import { chillEffects, chillStep } from "./chill.js";
import { currentLevels } from "./weather.js";

const chill = new Map(); // player id -> 0..100
const on = () => world.getDynamicProperty("wx:chill") !== "off";

function lightAt(p) {
  let best = 0;
  for (const dy of [0, 1]) {
    try {
      best = Math.max(best, p.dimension.getBlock({ x: Math.floor(p.location.x), y: Math.floor(p.location.y) + dy, z: Math.floor(p.location.z) })?.getLightLevel() ?? 0);
    } catch {
      // unloaded
    }
  }
  return best;
}

export function startChill() {
  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id === "wx:chill") world.setDynamicProperty("wx:chill", message.trim() === "off" ? "off" : "on");
  });
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (!on()) {
        chill.delete(p.id);
        clearFog("chill", p.id);
        continue;
      }
      const now = chillStep(chill.get(p.id) ?? 0, { levels: currentLevels(), exposed: skyExposed(p.dimension, p.location), light: lightAt(p) });
      chill.set(p.id, now);
      const fx = chillEffects(now);
      if (fx.tint) setFog("chill", p.id, { distance: fx.tint, tint: "snow" });
      try {
        if (fx.slow >= 0) p.addEffect("slowness", 40, { amplifier: fx.slow, showParticles: false });
        if (fx.hurt && Math.random() < 0.2) p.applyDamage(1);
        if (fx.slow >= 0 && Math.random() < 0.1) p.onScreenDisplay.setActionBar("§bYou are cold. Get under a roof, or near a fire.");
      } catch {
        // a player in a scene or leaving
      }
    }
  }, 20);
}
