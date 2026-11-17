// Ember sprites: the rogue sparks that swarm the keeper. Three lesser kinds (ember, dart,
// brute) plus the Ember Matriarch, a boss every 4th wave that drifts after the keeper, sheds
// radial bursts of hostile embers and calls lesser sprites to her side.

import { ENEMIES, FIELD } from './config.js';

let nextId = 1;

export function spawnEnemy(kind, x, y, plan) {
  const base = ENEMIES[kind];
  const hp = Math.round(base.hp * (plan ? plan.hpScale : 1));
  return {
    id: nextId++,
    kind,
    x,
    y,
    hp,
    maxHp: hp,
    radius: base.radius,
    speed: base.speed * (plan ? plan.speedScale : 1) * (0.88 + Math.random() * 0.24),
    damage: base.damage,
    xp: base.xp,
    score: base.score,
    flash: 0,
    knockX: 0,
    knockY: 0,
    wobble: Math.random() * Math.PI * 2,
    burstTimer: 2.2 + Math.random() * 0.8,
    callTimer: 5.5,
    dead: false,
  };
}

/** A hostile ember orb from a matriarch burst: straight-line, short-lived, hurts on touch. */
export function spawnHostile(x, y, angle, speed) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 6,
    damage: 12,
    life: 3.4,
    dead: false,
  };
}

/**
 * Move every enemy one step toward the player, run boss behaviour, and shove neighbours apart
 * so the swarm reads as bodies, not a stack. `events` collects 'burst' and 'call' for sound.
 */
export function updateEnemies(state, dt, events) {
  const player = state.player;
  const enemies = state.enemies;
  for (const enemy of enemies) {
    enemy.wobble += dt * 3;
    if (enemy.flash > 0) enemy.flash -= dt;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const sway = enemy.kind === 'ember' ? Math.sin(enemy.wobble) * 14 : 0;
    const px = (-dy / dist) * sway;
    const py = (dx / dist) * sway;
    enemy.x += ((dx / dist) * enemy.speed + px + enemy.knockX) * dt;
    enemy.y += ((dy / dist) * enemy.speed + py + enemy.knockY) * dt;
    enemy.knockX *= Math.max(0, 1 - 9 * dt);
    enemy.knockY *= Math.max(0, 1 - 9 * dt);
    enemy.x = Math.max(-40, Math.min(FIELD.width + 40, enemy.x));
    enemy.y = Math.max(-40, Math.min(FIELD.height + 40, enemy.y));

    if (enemy.kind === 'matriarch') {
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0) {
        enemy.burstTimer = 2.6;
        const count = 14;
        const baseAngle = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i += 1) {
          state.hostiles.push(spawnHostile(enemy.x, enemy.y, baseAngle + (i / count) * Math.PI * 2, 118));
        }
        state.particles.ring(enemy.x, enemy.y, '#e4572e', enemy.radius + 66);
        events.burst = true;
      }
      enemy.callTimer -= dt;
      if (enemy.callTimer <= 0 && enemies.length < 26) {
        enemy.callTimer = 6.5;
        for (let i = 0; i < 3; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          enemies.push(spawnEnemy('ember', enemy.x + Math.cos(angle) * 52, enemy.y + Math.sin(angle) * 52, state.plan));
        }
        events.call = true;
      }
    }
  }
  // Light separation: overlapping sprites push each other apart.
  for (let i = 0; i < enemies.length; i += 1) {
    for (let j = i + 1; j < enemies.length; j += 1) {
      const a = enemies[i];
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius - 2;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
  }
}

/** Move hostile orbs; they die of old age or at the field's edge. */
export function updateHostiles(state, dt) {
  for (const orb of state.hostiles) {
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    orb.life -= dt;
    if (orb.life <= 0 || orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20) orb.dead = true;
  }
}
