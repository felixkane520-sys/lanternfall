// Lanternfall tuning: field size, palette, player/enemy baselines and the wave table.
// Everything numeric that shapes difficulty lives here so the other modules stay about behaviour.

export const FIELD = { width: 960, height: 540 };

/** Fixed simulation step, in seconds: the world advances in these and only these. */
export const STEP = 1 / 60;

/** The last wave of the night: clear it and dawn breaks (victory). Endless waves follow. */
export const FINAL_WAVE = 8;

export const COLORS = {
  nightTop: '#141c33',
  nightBottom: '#1a2340',
  dawnTop: '#3a4470',
  dawnBottom: '#8a5a44',
  amber: '#ffb347',
  amberBright: '#ffd27a',
  cream: '#fff3d6',
  crimson: '#e4572e',
  emberCore: '#ff7847',
  spark: '#ffe9a8',
  roofFar: '#10182e',
  roofNear: '#0a0f22',
  mountain: '#0d1428',
};

export const PLAYER = {
  radius: 13,
  speed: 235,
  maxHp: 100,
  fireInterval: 0.19, // seconds between light-seeds at level 1
  projectileSpeed: 540,
  projectileDamage: 12,
  projectileRadius: 4,
  magnetRadius: 74,
  contactInvuln: 0.55, // seconds of grace after a touch, so one swarm cannot melt the keeper
};

/** Enemy baselines by kind; per-wave scaling is applied on top in world.js. */
export const ENEMIES = {
  ember: { radius: 11, hp: 18, speed: 62, damage: 9, xp: 1, score: 10 },
  dart: { radius: 8, hp: 10, speed: 118, damage: 7, xp: 1, score: 15 },
  brute: { radius: 19, hp: 65, speed: 36, damage: 16, xp: 3, score: 30 },
  matriarch: { radius: 34, hp: 620, speed: 26, damage: 22, xp: 14, score: 300 },
};

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level) {
  return 6 + (level - 1) * 5;
}

/**
 * What a wave sends: how many of each kind, and how fast they trickle in.
 * Every 4th wave is a matriarch wave: one boss plus a light escort.
 */
export function wavePlan(wave) {
  const boss = wave % 4 === 0;
  const embers = boss ? 6 + wave : 7 + wave * 3;
  const darts = wave >= 2 ? Math.floor(wave * 1.6) : 0;
  const brutes = wave >= 3 ? Math.floor((wave - 2) * 1.2) : 0;
  return {
    boss,
    total: embers + darts + brutes + (boss ? 1 : 0),
    embers,
    darts,
    brutes,
    spawnInterval: Math.max(0.34, 1.05 - wave * 0.075),
    hpScale: 1 + (wave - 1) * 0.22,
    speedScale: 1 + Math.min(0.45, (wave - 1) * 0.05),
  };
}

/** A tiny seeded RNG (mulberry32) so screenshot scenes and tests can be reproduced. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
