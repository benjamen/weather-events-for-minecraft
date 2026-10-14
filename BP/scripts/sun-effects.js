// Weather Events, the sun on the Minecraft side: heat haze through the fog mixer, and hunger, slowness and sunburn on
// players left out in a strong sun without a hat. Rules are in sun.js (pure, tested). Glue, not run in a game yet.
import { system, world } from "@minecraft/server";
import { clearFog, setFog } from "./kit/fog-mixer.js";
import { skyExposed } from "./kit/shelter.js";
import { daylight, glareFog, sunEffects } from "./sun.js";

const lastBurn = new Map();
const helmetOn = (p) => {
  try {
    return Boolean(p.getComponent("minecraft:equippable")?.getEquipment("Head"));
  } catch {
    return false;
  }
};

// `sun` is a function returning the sun channel's level (a float on the 0 to 3 scale).
export function startSun(sun) {
  system.runInterval(() => {
    const level = sun();
    const day = daylight(world.getTimeOfDay());
    const haze = level >= 1.5 && day ? glareFog(level) : undefined;
    for (const p of world.getAllPlayers()) {
      if (p.dimension.id !== "minecraft:overworld") continue;
      if (haze) setFog("wx_sun", p.id, haze);
      else clearFog("wx_sun", p.id);
      const fx = sunEffects(level, { exposed: day && skyExposed(p.dimension, p.location), helmet: helmetOn(p), inWater: p.isInWater });
      try {
        if (fx.hunger >= 0) p.addEffect("hunger", 60, { amplifier: fx.hunger, showParticles: false });
        if (fx.slowness >= 0) p.addEffect("slowness", 60, { amplifier: fx.slowness, showParticles: false });
        if (fx.thirst > 0.4 && Math.random() < 0.15) p.onScreenDisplay.setActionBar(fx.burnEvery < Infinity ? "§cThe sun is burning you - find shade" : "§6The heat is draining you");
        if (fx.burnEvery < Infinity && system.currentTick - (lastBurn.get(p.id) ?? 0) >= fx.burnEvery * 20) {
          lastBurn.set(p.id, system.currentTick);
          p.applyDamage(1, { cause: "fire" });
        }
      } catch {
        // player left
      }
    }
  }, 20);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => lastBurn.delete(playerId));
}
