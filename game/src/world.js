// The world: all mutable game state and the fixed-step simulation. Waves spawn at the field's
// edge, light-seeds and hostile orbs fly, sparks drop as XP, and clearing wave 8 breaks the dawn.
// main.js owns screens and sound; world.js reports what happened through `events` each step.

import { COLORS, FIELD, FINAL_WAVE, PLAYER, wavePlan, xpForLevel } from './config.js';
import { createPlayer } from './player.js';
import { createParticles } from './particles.js';
import { spawnEnemy, updateEnemies, updateHostiles } from './enemies.js';

export const PHASE_PLAY = 'play';
export const PHASE_BREATHER = 'breather'; // the quiet seconds between waves
export const PHASE_LEVELUP = 'levelup'; // paused while the keeper chooses an upgrade
export const PHASE_CLEAR = 'clear'; // the night is won (or the keeper has fallen)

const BREATHER_SECONDS = 3.0;

/** The upgrade pool: three distinct picks are offered at each level-up. */
export const UPGRADES = [
  {
    id: 'damage', name: 'Brighter Seeds', blurb: '+25% light-seed damage',
    apply: (s) => { s.damage = Math.round(s.damage * 1.25); },
  },
  {
    id: 'rate', name: 'Quick Hands', blurb: '+18% fire rate',
    apply: (s) => { s.fireInterval = Math.max(0.07, s.fireInterval * 0.85); },
  },
  {
    id: 'speed', name: 'Swift Boots', blurb: '+12% move speed',
    apply: (s) => { s.speed = Math.round(s.speed * 1.12); },
  },
  {
    id: 'magnet', name: 'Wider Glow', blurb: '+45 lantern magnet radius',
    apply: (s) => { s.magnet += 45; },
  },
  {
    id: 'vitality', name: 'Deep Breath', blurb: '+25 max health and heal 40',
    apply: (s, player) => { s.maxHp += 25; player.heal(40 + 25); },
  },
  {
    id: 'split', name: 'Twin Flame', blurb: '+1 light-seed per shot',
    apply: (s) => { s.projectiles += 1; },
  },
];

export function createWorld(rng) {
  const particles = createParticles();
  const player = createPlayer();
  const state = {
    player,
    particles,
    enemies: [],
    hostiles: [],
    projectiles: [],
    gems: [],
    wave: 0,
    plan: null,
    spawnQueue: [],
    spawnTimer: 0,
    phase: PHASE_BREATHER,
    breather: 1.2,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    choices: [],
    score: 0,
    kills: 0,
    time: 0,
    shake: 0,
    won: false,
    over: false,
    endless: false,
    banner: '',
    bannerTime: 0,
  };

  function queueWave(wave) {
    const plan = wavePlan(wave);
    state.plan = plan;
    const queue = [];
    if (plan.boss) queue.push('matriarch');
    for (let i = 0; i < plan.embers; i += 1) queue.push('ember');
    for (let i = 0; i < plan.darts; i += 1) queue.push('dart');
    for (let i = 0; i < plan.brutes; i += 1) queue.push('brute');
    // Shuffle so kinds arrive mixed, but a boss always walks in first.
    for (let i = queue.length - 1; i > 1; i -= 1) {
      const j = 1 + Math.floor(rng() * i);
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    state.spawnQueue = queue;
    state.spawnTimer = 0.4;
    state.banner = plan.boss ? `Wave ${wave} — the Ember Matriarch` : `Wave ${wave}`;
    state.bannerTime = 2.2;
  }

  function spawnFromQueue() {
    const kind = state.spawnQueue.shift();
    const side = Math.floor(rng() * 4);
    const m = 26;
    let x;
    let y;
    if (side === 0) { x = rng() * FIELD.width; y = -m; }
    else if (side === 1) { x = rng() * FIELD.width; y = FIELD.height + m; }
    else if (side === 2) { x = -m; y = rng() * FIELD.height; }
    else { x = FIELD.width + m; y = rng() * FIELD.height; }
    state.enemies.push(spawnEnemy(kind, x, y, state.plan));
  }

  function startNextWave() {
    state.wave += 1;
    queueWave(state.wave);
    state.phase = PHASE_PLAY;
  }

  function dropGem(x, y, value) {
    state.gems.push({ x, y, value, vx: (rng() - 0.5) * 60, vy: (rng() - 0.5) * 60, age: 0 });
  }

  function killEnemy(enemy, events) {
    enemy.dead = true;
    state.kills += 1;
    state.score += enemy.score;
    particles.burst(enemy.x, enemy.y, enemy.kind === 'matriarch' ? COLORS.crimson : COLORS.emberCore, enemy.kind === 'matriarch' ? 42 : 12, 130);
    particles.damageNumber(enemy.x, enemy.y - enemy.radius - 4, `+${enemy.score}`, COLORS.cream);
    dropGem(enemy.x, enemy.y, enemy.xp);
    events.enemyDown = true;
  }

  function gainXp(amount, events) {
    state.xp += amount;
    if (state.xp >= state.xpNext && state.phase !== PHASE_LEVELUP) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = xpForLevel(state.level);
      const pool = UPGRADES.slice();
      state.choices = [];
      for (let i = 0; i < 3; i += 1) {
        const index = Math.floor(rng() * pool.length);
        state.choices.push(pool.splice(index, 1)[0]);
      }
      state.phase = PHASE_LEVELUP;
      particles.sparkle(player.x, player.y, COLORS.amberBright, 26);
      events.levelUp = true;
    }
  }

  function fire(angle) {
    state.projectiles.push({
      x: player.x + Math.cos(angle) * (player.radius + 4),
      y: player.y + Math.sin(angle) * (player.radius + 4),
      vx: Math.cos(angle) * PLAYER.projectileSpeed,
      vy: Math.sin(angle) * PLAYER.projectileSpeed,
      damage: player.stats.damage,
      radius: PLAYER.projectileRadius,
      life: 0.95,
      dead: false,
    });
  }

  function step(dt, controls, events) {
    if (state.phase === PHASE_LEVELUP || state.phase === PHASE_CLEAR) {
      particles.update(dt);
      return;
    }
    state.time += dt;
    if (state.bannerTime > 0) state.bannerTime -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

    if (state.phase === PHASE_BREATHER) {
      state.breather -= dt;
      player.update(dt, controls.move, controls.aim, false, fire);
      particles.update(dt);
      if (state.breather <= 0) startNextWave();
      return;
    }

    // Spawning.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnFromQueue();
        state.spawnTimer = state.plan.spawnInterval;
      }
    }

    let fired = false;
    player.update(dt, controls.move, controls.aim, controls.firing, (angle) => {
      fire(angle);
      fired = true;
    });
    if (fired) events.shoot = true;

    const enemyEvents = {};
    updateEnemies(state, dt, enemyEvents);
    if (enemyEvents.burst) events.burst = true;
    updateHostiles(state, dt);

    // Light-seeds against enemies.
    for (const seed of state.projectiles) {
      seed.x += seed.vx * dt;
      seed.y += seed.vy * dt;
      seed.life -= dt;
      if (seed.life <= 0 || seed.x < -12 || seed.x > FIELD.width + 12 || seed.y < -12 || seed.y > FIELD.height + 12) {
        seed.dead = true;
        continue;
      }
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.x - seed.x;
        const dy = enemy.y - seed.y;
        const rr = enemy.radius + seed.radius;
        if (dx * dx + dy * dy < rr * rr) {
          seed.dead = true;
          enemy.hp -= seed.damage;
          enemy.flash = 0.09;
          const kb = enemy.kind === 'matriarch' ? 30 : 130;
          const dist = Math.hypot(dx, dy) || 1;
          enemy.knockX -= (dx / dist) * kb;
          enemy.knockY -= (dy / dist) * kb;
          particles.damageNumber(enemy.x, enemy.y - enemy.radius - 2, String(seed.damage), COLORS.spark);
          particles.burst(seed.x, seed.y, COLORS.amber, 3, 70);
          events.hit = true;
          if (enemy.hp <= 0) killEnemy(enemy, events);
          break;
        }
      }
    }

    // Enemy contact and hostile orbs against the keeper.
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const rr = enemy.radius + player.radius - 2;
      if (dx * dx + dy * dy < rr * rr && player.hurt(enemy.damage)) {
        state.shake = 7;
        particles.burst(player.x, player.y, COLORS.crimson, 10, 110);
        events.hurt = true;
      }
    }
    for (const orb of state.hostiles) {
      if (orb.dead) continue;
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const rr = orb.radius + player.radius;
      if (dx * dx + dy * dy < rr * rr) {
        orb.dead = true;
        if (player.hurt(orb.damage)) {
          state.shake = 7;
          particles.burst(player.x, player.y, COLORS.crimson, 10, 110);
          events.hurt = true;
        }
      }
    }

    // Sparks drift to the lantern when close, and feed XP when they arrive.
    for (const gem of state.gems) {
      gem.age += dt;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < player.stats.magnet) {
        const pull = 340 * (1 - dist / (player.stats.magnet * 1.6));
        gem.vx += (dx / dist) * pull * dt * 4;
        gem.vy += (dy / dist) * pull * dt * 4;
      }
      gem.vx *= Math.max(0, 1 - 3.2 * dt);
      gem.vy *= Math.max(0, 1 - 3.2 * dt);
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      if (dist < player.radius + 9) {
        gem.taken = true;
        particles.sparkle(player.x, player.y - 6, COLORS.spark, 3);
        gainXp(gem.value, events);
        events.pickup = true;
      }
    }

    state.projectiles = state.projectiles.filter((p) => !p.dead);
    state.hostiles = state.hostiles.filter((o) => !o.dead);
    state.enemies = state.enemies.filter((e) => !e.dead);
    state.gems = state.gems.filter((g) => !g.taken);
    particles.update(dt);

    if (player.hp <= 0) {
      state.over = true;
      state.phase = PHASE_CLEAR;
      particles.burst(player.x, player.y, COLORS.amber, 46, 190);
      events.gameOver = true;
      return;
    }

    // Wave cleared?
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      state.score += 50 + state.wave * 10;
      if (state.wave >= FINAL_WAVE && !state.won) {
        state.won = true;
        state.phase = PHASE_CLEAR;
        events.victory = true;
        return;
      }
      events.waveClear = true;
      state.phase = PHASE_BREATHER;
      state.breather = BREATHER_SECONDS;
    }
  }

  function applyChoice(index) {
    const choice = state.choices[index];
    if (!choice) return;
    choice.apply(player.stats, player);
    state.choices = [];
    state.phase = PHASE_PLAY;
    // A level-up can chain if banked XP already covers the next level.
    if (state.xp >= state.xpNext) {
      const events = {};
      gainXp(0, events);
    }
  }

  function continueEndless() {
    state.endless = true;
    state.phase = PHASE_BREATHER;
    state.breather = BREATHER_SECONDS;
  }

  function reset() {
    player.reset();
    particles.clear();
    state.enemies = [];
    state.hostiles = [];
    state.projectiles = [];
    state.gems = [];
    state.wave = 0;
    state.plan = null;
    state.spawnQueue = [];
    state.phase = PHASE_BREATHER;
    state.breather = 1.2;
    state.level = 1;
    state.xp = 0;
    state.xpNext = xpForLevel(1);
    state.choices = [];
    state.score = 0;
    state.kills = 0;
    state.time = 0;
    state.shake = 0;
    state.won = false;
    state.over = false;
    state.endless = false;
    state.banner = '';
    state.bannerTime = 0;
  }

  reset();
  return { state, step, applyChoice, continueEndless, reset };
}
