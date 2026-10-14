// Weather Events, puddles on the ground: the Minecraft side of puddles.js. In rain, puddles form on open ground near
// each player, grow to the rain's limit, and when the rain stops they shrink and dry up, faster in sun and wind.
// Every puddle is a `wx:puddle` block (1 to 4 sixteenths deep) standing in the air block above the ground. Which puddles
// exist and how dry they are is saved in a world property, so a restart never leaves puddles that never dry. The rules
// are pure and tested; this file is glue and has not been run in a game yet.
import { BlockPermutation, system, world } from "@minecraft/server";
import { attemptsPerSecond, groundChance, puddleSpot, stepPuddle } from "./puddles.js";

const BLOCK = "wx:puddle";
const PROPERTY = "wx:puddles";
const MAX_PUDDLES = 300;
const RADIUS = [5, 28]; // how far from a player puddles form
const log = (msg) => console.warn(`[Weather] ${msg}`);

let puddles = []; // { x, y, z, size, dry, grown }
let dirty = false;
let levelsNow = () => ({ rain: 0, sun: 0, wind: 0 });

const overworld = () => world.getDimension("overworld");
const key = (p) => `${p.x},${p.y},${p.z}`;

function load() {
  try {
    puddles = JSON.parse(world.getDynamicProperty(PROPERTY) ?? "[]");
  } catch {
    puddles = [];
  }
}

function save() {
  if (!dirty) return;
  dirty = false;
  try {
    world.setDynamicProperty(PROPERTY, JSON.stringify(puddles.slice(-MAX_PUDDLES)));
  } catch {
    // too big: the in-memory list still dries them this session
  }
}

function setSize(block, size) {
  block.setPermutation(BlockPermutation.resolve(BLOCK, { "wx:size": size }));
}

function remove(dim, p) {
  try {
    const block = dim.getBlock(p);
    if (block?.typeId === BLOCK) block.setType("minecraft:air");
  } catch {
    // unloaded: it will be tidied when the chunk comes back and the step finds it
  }
}

// Try to start a puddle at a random spot near a player.
function spawnNear(player) {
  const dim = player.dimension;
  const a = Math.random() * Math.PI * 2;
  const r = RADIUS[0] + Math.random() * (RADIUS[1] - RADIUS[0]);
  const x = Math.floor(player.location.x + Math.cos(a) * r), z = Math.floor(player.location.z + Math.sin(a) * r);
  try {
    const top = dim.getTopmostBlock({ x, z });
    if (!top) return;
    if (Math.random() > groundChance(top.typeId)) return;
    const above = dim.getBlock({ x, y: top.location.y + 1, z });
    if (!above) return;
    const existing = puddles.some((p) => p.x === x && p.y === above.location.y && p.z === z);
    if (!puddleSpot({ above: above.typeId, ground: top.typeId, skyOpen: true, existing })) return;
    if (puddles.length >= MAX_PUDDLES) {
      const old = puddles.shift();
      remove(dim, old);
    }
    setSize(above, 1);
    puddles.push({ x, y: above.location.y, z, size: 1, dry: 0, grown: 0 });
    dirty = true;
  } catch {
    // unloaded
  }
}

function second() {
  const weather = levelsNow();
  const dim = overworld();
  // New puddles, only while it rains.
  const attempts = attemptsPerSecond(weather.rain);
  if (attempts > 0) {
    for (const player of world.getAllPlayers()) {
      if (player.dimension.id !== "minecraft:overworld") continue;
      const n = Math.floor(attempts) + (Math.random() < attempts % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) spawnNear(player);
    }
  }
  // Every existing puddle grows, shrinks or dries.
  const kept = [];
  for (const p of puddles) {
    let block;
    try {
      block = dim.getBlock(p);
    } catch {
      block = undefined;
    }
    if (!block) {
      kept.push(p); // unloaded: leave it until the chunk is back
      continue;
    }
    if (block.typeId !== BLOCK) {
      dirty = true; // something replaced it
      continue;
    }
    const ground = dim.getBlock({ x: p.x, y: p.y - 1, z: p.z });
    if (!ground || groundChance(ground.typeId) === 0) {
      block.setType("minecraft:air"); // the ground under it is gone
      dirty = true;
      continue;
    }
    const next = stepPuddle(p, 1, weather);
    if (!next) {
      block.setType("minecraft:air");
      dirty = true;
      continue;
    }
    if (next.size !== p.size) {
      setSize(block, next.size);
      dirty = true;
    }
    Object.assign(p, next);
    kept.push(p);
  }
  puddles = kept;
  save();
}

// Walking through a puddle splashes.
function splashes() {
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== "minecraft:overworld" || !player.isOnGround) continue;
    const v = player.getVelocity();
    if (Math.hypot(v.x, v.z) < 0.06) continue;
    const feet = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
    try {
      if (player.dimension.getBlock(feet)?.typeId !== BLOCK) continue;
      player.dimension.spawnParticle("minecraft:water_splash_particle", { x: player.location.x, y: player.location.y + 0.1, z: player.location.z });
      player.dimension.playSound("random.splash", player.location, { volume: 0.15, pitch: 1.5 + Math.random() * 0.4 });
    } catch {
      // gone
    }
  }
}

// `levels` is a function returning the current { rain, sun, wind } (floats on the 0 to 3 scale).
export function startPuddles(levels) {
  levelsNow = levels;
  load();
  system.runInterval(second, 20);
  system.runInterval(splashes, 8);
  system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
    if (id === "wx:puddles") sourceEntity?.sendMessage?.(`[Weather] ${puddles.length} puddles`);
    if (id === "wx:dry") {
      const dim = overworld();
      for (const p of puddles) remove(dim, p);
      puddles = [];
      dirty = true;
      save();
      sourceEntity?.sendMessage?.("[Weather] every puddle dried up");
    }
  });
  log(`puddles: ${puddles.length} remembered`);
}
