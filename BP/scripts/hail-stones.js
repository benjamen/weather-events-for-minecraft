// Weather Events, hail on the Minecraft side: fires the stones (tagged base-game snowballs, so no extra assets) from the
// sky above each player, and handles what they do when they land. The rules are in hail.js (pure, tested). This file is
// glue and has not been run in a game yet.
import { system, world } from "@minecraft/server";
import { fireAt } from "./kit/projectiles.js";
import { onProjectileHits } from "./kit/projectile-hooks.js";
import { breaksGlass, landingSound, stone, stoneDamage, stoneSpot, stonesPerSecond } from "./hail.js";

const TAG = "wx_hail";
const INTERVAL = 4; // ticks between volleys
const log = (msg) => console.warn(`[Weather] ${msg}`);
let levelNow = () => 0;

const damageOn = () => world.getDynamicProperty("wx:hail_damage") !== "off";
const glassOn = () => world.getDynamicProperty("wx:hail_glass") !== "off";

function volley() {
  const hail = levelNow();
  const rate = stonesPerSecond(hail);
  if (rate <= 0) return;
  const level = Math.max(1, Math.round(hail));
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    const expected = rate * (INTERVAL / 20);
    const n = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const probe = stoneSpot(player.location, 0, Math.random);
      let top;
      try {
        top = player.dimension.getTopmostBlock({ x: Math.floor(probe.target.x), z: Math.floor(probe.target.z) });
      } catch {
        continue;
      }
      if (!top) continue;
      const spot = stoneSpot(player.location, top.location.y, Math.random);
      fireAt(player.dimension, "minecraft:snowball", spot.start, spot.target, { speed: stone(level).speed, tag: TAG });
    }
  }
}

const helmetOf = (entity) => {
  try {
    return Boolean(entity.getComponent("minecraft:equippable")?.getEquipment("Head"));
  } catch {
    return false;
  }
};

// `level` is a function returning the hail channel's current level (a float on the 0 to 3 scale).
export function startHail(level) {
  levelNow = level;
  system.runInterval(volley, INTERVAL);
  onProjectileHits({
    "minecraft:snowball": {
      entity(projectile, hit) {
        if (!projectile.hasTag(TAG) || !damageOn()) return;
        const damage = stoneDamage(Math.max(1, Math.round(levelNow())), { helmet: helmetOf(hit) });
        if (damage > 0) hit.applyDamage(damage, { cause: "projectile" });
      },
      block(projectile, block, dimension) {
        if (!projectile.hasTag(TAG)) return;
        const l = Math.max(1, Math.round(levelNow()));
        const sound = landingSound(block.typeId, l);
        try {
          dimension.playSound(sound.id, block.location, { volume: sound.volume, pitch: sound.pitch + Math.random() * 0.2 });
        } catch {
          // unloaded
        }
        if (glassOn() && breaksGlass(block.typeId, l, Math.random)) block.setType("minecraft:air");
      },
    },
  }, log);
  log("hail ready");
}
