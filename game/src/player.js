// The lantern keeper: position, health, aim and the light-seed gun. Upgrades land on `stats`
// (damage, fire rate, speed, magnet, projectile count); world.js reads them when spawning seeds.

import { FIELD, PLAYER } from './config.js';

export function createPlayer() {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2 + 60,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    invuln: 0,
    cooldown: 0,
    aimAngle: -Math.PI / 2,
    moving: false,
    stats: null,
    reset,
  };

  function freshStats() {
    return {
      maxHp: PLAYER.maxHp,
      damage: PLAYER.projectileDamage,
      fireInterval: PLAYER.fireInterval,
      speed: PLAYER.speed,
      magnet: PLAYER.magnetRadius,
      projectiles: 1,
    };
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2 + 60;
    player.hp = PLAYER.maxHp;
    player.invuln = 0;
    player.cooldown = 0;
    player.aimAngle = -Math.PI / 2;
    player.moving = false;
    player.stats = freshStats();
  }

  /**
   * Advance one step: move with the input vector, face the aim point, and call `fire(angle)`
   * for every light-seed that leaves the lantern this step (spread when upgraded past one).
   */
  player.update = function update(dt, move, aim, firing, fire) {
    const stats = player.stats;
    player.x += move.x * stats.speed * dt;
    player.y += move.y * stats.speed * dt;
    player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y));
    player.moving = move.x !== 0 || move.y !== 0;
    player.aimAngle = Math.atan2(aim.y - player.y, aim.x - player.x);
    if (player.invuln > 0) player.invuln -= dt;
    if (player.cooldown > 0) player.cooldown -= dt;
    if (firing && player.cooldown <= 0) {
      player.cooldown = stats.fireInterval;
      const count = stats.projectiles;
      for (let i = 0; i < count; i += 1) {
        const offset = count === 1 ? 0 : (i - (count - 1) / 2) * 0.11;
        fire(player.aimAngle + offset);
      }
    }
  };

  /** Take a hit unless the post-hit grace is still running; returns true when it lands. */
  player.hurt = function hurt(amount) {
    if (player.invuln > 0 || player.hp <= 0) return false;
    player.hp -= amount;
    player.invuln = PLAYER.contactInvuln;
    return true;
  };

  player.heal = function heal(amount) {
    player.hp = Math.min(player.stats.maxHp, player.hp + amount);
  };

  reset();
  return player;
}
