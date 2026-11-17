// Painting: the paper-cut night sky (gradient, stars, moon, mountain and rooftop silhouettes,
// paper lanterns drifting up), then gems, enemies, the keeper, seeds and particles. As the waves
// climb toward wave 8 the sky pales toward dawn; on victory the sun is up. Canvas only.

import { COLORS, FIELD, FINAL_WAVE, createRng } from './config.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = p(c1);
  const b = p(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const deco = createRng(20251115);
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({ x: deco() * FIELD.width, y: deco() * FIELD.height * 0.62, r: 0.6 + deco() * 1.3, tw: deco() * Math.PI * 2 });
  }
  const lanterns = [];
  for (let i = 0; i < 7; i += 1) {
    lanterns.push({
      x: 40 + deco() * (FIELD.width - 80),
      y: deco() * FIELD.height,
      speed: 5 + deco() * 8,
      sway: deco() * Math.PI * 2,
      size: 5 + deco() * 5,
    });
  }
  // Rooftop silhouette: a skyline of house tops along the bottom edge, drawn as one path.
  const roofs = [];
  {
    let x = -10;
    while (x < FIELD.width + 10) {
      const w = 46 + deco() * 70;
      const h = 26 + deco() * 34;
      roofs.push({ x, w, h, chimney: deco() < 0.5 });
      x += w + 2 + deco() * 10;
    }
  }

  function drawBackground(state, now) {
    const dawn = state.won ? 1 : Math.min(0.55, (Math.max(0, state.wave - 1) / FINAL_WAVE) * 0.55);
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, lerpColor(COLORS.nightTop, COLORS.dawnTop, dawn));
    sky.addColorStop(1, lerpColor(COLORS.nightBottom, COLORS.dawnBottom, dawn));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars fade as dawn comes.
    ctx.save();
    ctx.globalAlpha = 1 - dawn;
    for (const star of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(now * 1.7 + star.tw);
      ctx.globalAlpha = (1 - dawn) * twinkle;
      ctx.fillStyle = COLORS.cream;
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }
    ctx.restore();

    // Moon, sinking as the sun climbs on the opposite side.
    const moonX = FIELD.width - 120;
    const moonY = 74 + dawn * 60;
    ctx.save();
    ctx.globalAlpha = 1 - dawn * 0.9;
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lerpColor(COLORS.nightTop, COLORS.dawnTop, dawn);
    ctx.beginPath();
    ctx.arc(moonX + 10, moonY - 6, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (dawn > 0.25) {
      const sunY = FIELD.height - 60 - (dawn - 0.25) * 150;
      const glow = ctx.createRadialGradient(120, sunY, 4, 120, sunY, 130);
      glow.addColorStop(0, 'rgba(255, 179, 71, 0.85)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.fillStyle = COLORS.amberBright;
      ctx.beginPath();
      ctx.arc(120, sunY, 21, 0, Math.PI * 2);
      ctx.fill();
    }

    // Far mountains.
    ctx.fillStyle = COLORS.mountain;
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.lineTo(120, 356);
    ctx.lineTo(250, 424);
    ctx.lineTo(390, 342);
    ctx.lineTo(540, 428);
    ctx.lineTo(690, 360);
    ctx.lineTo(830, 430);
    ctx.lineTo(960, 372);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.closePath();
    ctx.fill();

    // Drifting paper lanterns, between the mountains and the rooftops.
    for (const lamp of lanterns) {
      const y = FIELD.height - ((now * lamp.speed + lamp.y * 3) % (FIELD.height + 80)) + 40;
      const x = lamp.x + Math.sin(now * 0.6 + lamp.sway) * 14;
      const flicker = 0.75 + 0.25 * Math.sin(now * 5 + lamp.sway * 3);
      const glow = ctx.createRadialGradient(x, y, 1, x, y, lamp.size * 3.2);
      glow.addColorStop(0, `rgba(255, 179, 71, ${0.5 * flicker})`);
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - lamp.size * 3.2, y - lamp.size * 3.2, lamp.size * 6.4, lamp.size * 6.4);
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath();
      ctx.ellipse(x, y, lamp.size * 0.72, lamp.size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.crimson;
      ctx.fillRect(x - lamp.size * 0.4, y - lamp.size - 2, lamp.size * 0.8, 3);
      ctx.fillRect(x - lamp.size * 0.4, y + lamp.size - 1, lamp.size * 0.8, 3);
    }

    // Rooftops of the sleeping town.
    for (const roof of roofs) {
      const top = FIELD.height - roof.h;
      ctx.fillStyle = COLORS.roofNear;
      ctx.fillRect(roof.x, top + 8, roof.w, roof.h);
      ctx.beginPath();
      ctx.moveTo(roof.x - 5, top + 10);
      ctx.lineTo(roof.x + roof.w / 2, top - 8);
      ctx.lineTo(roof.x + roof.w + 5, top + 10);
      ctx.closePath();
      ctx.fill();
      if (roof.chimney) ctx.fillRect(roof.x + roof.w * 0.68, top - 16, 7, 12);
      // One or two lamplit windows.
      ctx.fillStyle = 'rgba(255, 179, 71, 0.75)';
      if (roof.w > 56) ctx.fillRect(roof.x + roof.w * 0.24, top + 20, 6, 8);
      if (roof.w > 84) ctx.fillRect(roof.x + roof.w * 0.62, top + 24, 6, 8);
    }
  }

  function drawGem(gem, now) {
    const pulse = 1 + 0.18 * Math.sin(now * 6 + gem.x);
    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.rotate(Math.PI / 4);
    const s = 4.6 * pulse;
    ctx.fillStyle = COLORS.spark;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 233, 168, 0.25)';
    ctx.beginPath();
    ctx.arc(gem.x, gem.y, 9 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnemy(enemy, now) {
    const flicker = 1 + 0.1 * Math.sin(now * 9 + enemy.wobble * 2);
    const r = enemy.radius * flicker;
    // Outer glow.
    const glow = ctx.createRadialGradient(enemy.x, enemy.y, 1, enemy.x, enemy.y, r * 2.3);
    glow.addColorStop(0, 'rgba(228, 87, 46, 0.4)');
    glow.addColorStop(1, 'rgba(228, 87, 46, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(enemy.x - r * 2.3, enemy.y - r * 2.3, r * 4.6, r * 4.6);
    // Flame body: a teardrop leaning back from its motion, wider for the matriarch.
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const body = enemy.flash > 0 ? '#ffffff' : COLORS.crimson;
    const core = enemy.flash > 0 ? '#ffffff' : COLORS.emberCore;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.45);
    ctx.quadraticCurveTo(r * 1.05, -r * 0.2, r * 0.82, r * 0.55);
    ctx.quadraticCurveTo(r * 0.5, r * 1.05, 0, r * 1.05);
    ctx.quadraticCurveTo(-r * 0.5, r * 1.05, -r * 0.82, r * 0.55);
    ctx.quadraticCurveTo(-r * 1.05, -r * 0.2, 0, -r * 1.45);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.52, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.amberBright;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 0.26, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes: two dark slits that read at any size.
    ctx.fillStyle = '#2a0f08';
    const eyeY = r * 0.05;
    const eyeDx = r * 0.3;
    ctx.beginPath();
    ctx.ellipse(-eyeDx, eyeY, r * 0.09 + 1, r * 0.16 + 1, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeDx, eyeY, r * 0.09 + 1, r * 0.16 + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A thin health arc over anything tougher than a plain ember.
    if (enemy.maxHp >= 40 && enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      ctx.fillStyle = 'rgba(10, 15, 34, 0.7)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 13, w, 4);
      ctx.fillStyle = COLORS.crimson;
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 13, w * Math.max(0, enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawPlayer(player, now) {
    const blink = player.invuln > 0 && Math.floor(now * 14) % 2 === 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    // Lantern glow that follows the keeper everywhere.
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 74);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.34)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-74, -74, 148, 148);
    ctx.globalAlpha = blink ? 0.35 : 1;
    // Robe: a deep indigo triangle with a cream sash.
    ctx.fillStyle = '#232c52';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(11, 14);
    ctx.lineTo(-11, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(6, 6);
    ctx.stroke();
    // Head and night-watch cap.
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.arc(0, -11, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.crimson;
    ctx.fillRect(-7, -18, 14, 4);
    ctx.beginPath();
    ctx.arc(0, -18, 4, Math.PI, 0);
    ctx.fill();
    ctx.restore();
    // The lantern itself, held toward the aim.
    const lx = player.x + Math.cos(player.aimAngle) * 20;
    const ly = player.y + Math.sin(player.aimAngle) * 20;
    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 2);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    const lampGlow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26);
    lampGlow.addColorStop(0, 'rgba(255, 210, 122, 0.8)');
    lampGlow.addColorStop(1, 'rgba(255, 210, 122, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(lx - 26, ly - 26, 52, 52);
    ctx.fillStyle = COLORS.amberBright;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.crimson;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function draw(state, now) {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(state, now);
    for (const gem of state.gems) drawGem(gem, now);
    for (const orb of state.hostiles) {
      ctx.fillStyle = COLORS.crimson;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.amberBright;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const enemy of state.enemies) drawEnemy(enemy, now);
    // Light-seeds.
    for (const seed of state.projectiles) {
      const glow = ctx.createRadialGradient(seed.x, seed.y, 0.5, seed.x, seed.y, 11);
      glow.addColorStop(0, 'rgba(255, 233, 168, 0.9)');
      glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(seed.x - 11, seed.y - 11, 22, 22);
      ctx.fillStyle = COLORS.cream;
      ctx.beginPath();
      ctx.arc(seed.x, seed.y, seed.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!state.over) drawPlayer(state.player, now);
    // Particles and floating numbers.
    for (const p of state.particles.items) {
      const t = 1 - p.age / p.life;
      if (p.ring) {
        ctx.save();
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.maxRadius * (1 - t * t), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of state.particles.texts) {
      ctx.save();
      ctx.globalAlpha = 1 - t.age / t.life;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
    ctx.restore();
    // Vignette to seat the scene.
    const vignette = ctx.createRadialGradient(480, 270, 240, 480, 270, 620);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(4,6,16,0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  return { draw };
}
