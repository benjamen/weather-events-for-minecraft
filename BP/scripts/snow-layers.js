// Weather Events, snow on the ground: the Minecraft side of snow.js. Uses the base game's snow layer block (height 0 to 6
// for 1 to 7 layers). Piles are saved in a world property so a restart never leaves snow that never melts. Glue, not run
// in a game yet.
import { BlockPermutation, system, world } from "@minecraft/server";
import { attemptsPerSecond, holdsSnow, stepSnow } from "./snow.js";

const BLOCK = "minecraft:snow_layer";
const PROPERTY = "wx:snow";
const MAX_PILES = 500;
let piles = []; // { x, y, z, layers, clock }
let dirty = false;
let levelsNow = () => ({ snow: 0, sun: 0 });
let temperatureNow = () => 0.1;

const load = () => {
  try {
    piles = JSON.parse(world.getDynamicProperty(PROPERTY) ?? "[]");
  } catch {
    piles = [];
  }
};
const save = () => {
  if (!dirty) return;
  dirty = false;
  try {
    world.setDynamicProperty(PROPERTY, JSON.stringify(piles.slice(-MAX_PILES)));
  } catch {
    // too big: kept in memory
  }
};
const setLayers = (block, layers) => block.setPermutation(BlockPermutation.resolve(BLOCK, { height: layers - 1 }));

function settleNear(player) {
  const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 22;
  const x = Math.floor(player.location.x + Math.cos(a) * r), z = Math.floor(player.location.z + Math.sin(a) * r);
  try {
    const top = player.dimension.getTopmostBlock({ x, z });
    if (!top || !holdsSnow(top.typeId)) return;
    const above = player.dimension.getBlock({ x, y: top.location.y + 1, z });
    if (!above || above.typeId !== "minecraft:air" || piles.some((p) => p.x === x && p.y === above.location.y && p.z === z)) return;
    if (piles.length >= MAX_PILES) {
      const old = piles.shift();
      const b = player.dimension.getBlock(old);
      if (b?.typeId === BLOCK) b.setType("minecraft:air");
    }
    setLayers(above, 1);
    piles.push({ x, y: above.location.y, z, layers: 1, clock: 0 });
    dirty = true;
  } catch {
    // unloaded
  }
}

function second() {
  const w = levelsNow(), dim = world.getDimension("overworld");
  const attempts = attemptsPerSecond(w.snow);
  if (attempts > 0) {
    for (const p of world.getAllPlayers()) {
      if (p.dimension.id !== "minecraft:overworld") continue;
      const n = Math.floor(attempts) + (Math.random() < attempts % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) settleNear(p);
    }
  }
  const kept = [];
  for (const p of piles) {
    let block;
    try {
      block = dim.getBlock(p);
    } catch {
      block = undefined;
    }
    if (!block) { kept.push(p); continue; }
    if (block.typeId !== BLOCK) { dirty = true; continue; }
    const next = stepSnow(p, 1, { snow: w.snow, sun: w.sun, temperature: temperatureNow() });
    if (!next) { block.setType("minecraft:air"); dirty = true; continue; }
    if (next.layers !== p.layers) { setLayers(block, next.layers); dirty = true; }
    Object.assign(p, next);
    kept.push(p);
  }
  piles = kept;
  save();
}

// `levels` returns { snow, sun, ... } (floats on the 0 to 3 scale); `temperature` returns 0 (frozen) to 1 (hot).
export function startSnowLayers(levels, temperature = () => 0.1) {
  levelsNow = levels;
  temperatureNow = temperature;
  load();
  system.runInterval(second, 20);
  system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id === "wx:snowcount") sourceEntity?.sendMessage?.(`[Weather] ${piles.length} snow piles`);
    if (id === "wx:melt") {
      const dim = world.getDimension("overworld");
      for (const p of piles) {
        try {
          const b = dim.getBlock(p);
          if (b?.typeId === BLOCK) b.setType("minecraft:air");
        } catch {
          // unloaded
        }
      }
      piles = [];
      dirty = true;
      save();
    }
  });
}
