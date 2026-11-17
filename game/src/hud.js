// The heads-up display and the full-screen overlays: health and XP bars, wave / score / timer,
// the boss bar, the wave banner, and the title, pause, level-up, game-over and victory screens.
// Button and card rectangles are exported so main.js can route clicks to the same geometry.

import { COLORS, FIELD, FINAL_WAVE } from './config.js';

export const BTN_START = { x: 380, y: 396, w: 200, h: 52 };
export const BTN_RESTART = { x: 380, y: 404, w: 200, h: 50 };
export const BTN_CONTINUE = { x: 268, y: 404, w: 200, h: 50 };
export const BTN_AGAIN = { x: 492, y: 404, w: 200, h: 50 };
export const BTN_MUTE = { x: FIELD.width - 44, y: 10, w: 34, h: 30 };

const CARD_W = 216;
const CARD_H = 148;
const CARD_Y = 218;

export function cardRect(index) {
  const gap = 18;
  const total = CARD_W * 3 + gap * 2;
  return { x: (FIELD.width - total) / 2 + index * (CARD_W + gap), y: CARD_Y, w: CARD_W, h: CARD_H };
}

export function pointIn(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function bar(x, y, w, h, fraction, fill, back) {
  const ctx = bar.ctx;
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  bar.ctx = ctx;

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(10, 14, 30, ${alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  function button(rect, label, hot) {
    ctx.fillStyle = hot ? COLORS.amber : 'rgba(255, 179, 71, 0.16)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = hot ? '#1a2340' : COLORS.cream;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 7);
  }

  function dim(alpha) {
    ctx.fillStyle = `rgba(6, 8, 20, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(state, muted) {
    const player = state.player;
    // Health.
    ctx.textAlign = 'left';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText('KEEPER', 16, 24);
    bar(16, 30, 210, 13, player.hp / player.stats.maxHp, player.hp > 30 ? COLORS.amber : COLORS.crimson, 'rgba(10,14,30,0.72)');
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(`${Math.max(0, Math.ceil(player.hp))} / ${player.stats.maxHp}`, 232, 41);
    // XP and level.
    ctx.fillStyle = COLORS.cream;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(`LEVEL ${state.level}`, 16, 62);
    bar(16, 68, 210, 8, state.xp / state.xpNext, COLORS.spark || '#ffe9a8', 'rgba(10,14,30,0.72)');
    // Wave, score, timer across the top centre.
    ctx.textAlign = 'center';
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.fillStyle = COLORS.cream;
    const waveLabel = state.wave === 0 ? 'NIGHTFALL' : state.endless && state.wave > FINAL_WAVE ? `ENDLESS · WAVE ${state.wave}` : `WAVE ${state.wave} / ${FINAL_WAVE}`;
    ctx.fillText(waveLabel, FIELD.width / 2, 34);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.amberBright;
    ctx.fillText(`Score ${state.score}    ·    ${formatTime(state.time)}    ·    Embers left ${state.enemies.length + state.spawnQueue.length}`, FIELD.width / 2, 56);
    // Mute button.
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(BTN_MUTE.x, BTN_MUTE.y, BTN_MUTE.w, BTN_MUTE.h);
    ctx.fillStyle = COLORS.cream;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(muted ? '✕' : '♪', BTN_MUTE.x + BTN_MUTE.w / 2, BTN_MUTE.y + 21);
    // Boss bar.
    const boss = state.enemies.find((e) => e.kind === 'matriarch');
    if (boss) {
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillStyle = COLORS.crimson;
      ctx.textAlign = 'center';
      ctx.fillText('EMBER MATRIARCH', FIELD.width / 2, FIELD.height - 34);
      bar(FIELD.width / 2 - 190, FIELD.height - 28, 380, 10, boss.hp / boss.maxHp, COLORS.crimson, 'rgba(10,14,30,0.72)');
    }
    // Wave banner.
    if (state.bannerTime > 0 && state.banner) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.bannerTime);
      ctx.font = '800 30px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.cream;
      ctx.fillText(state.banner, FIELD.width / 2, 120);
      ctx.restore();
    }
    if (state.phase === 'breather' && state.wave > 0 && state.wave < FINAL_WAVE) {
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 243, 214, 0.85)';
      ctx.fillText(`Wave ${state.wave + 1} is coming…`, FIELD.width / 2, 148);
    }
  }

  function drawTitle(now) {
    dim(0.34);
    ctx.textAlign = 'center';
    // A big lantern mark over the title.
    const bob = Math.sin(now * 1.4) * 5;
    ctx.save();
    ctx.translate(FIELD.width / 2, 108 + bob);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 62);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.75)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-62, -62, 124, 124);
    ctx.fillStyle = COLORS.amber;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.crimson;
    ctx.fillRect(-11, -31, 22, 6);
    ctx.fillRect(-11, 25, 22, 6);
    ctx.restore();
    ctx.fillStyle = COLORS.cream;
    ctx.font = '800 64px Georgia, serif';
    ctx.fillText('LANTERNFALL', FIELD.width / 2, 226);
    ctx.font = '600 19px Georgia, serif';
    ctx.fillStyle = COLORS.amberBright;
    ctx.fillText('Night of the Falling Lanterns', FIELD.width / 2, 258);
    ctx.font = '400 16px system-ui, sans-serif';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText('You are the night-watch keeper. Rogue ember sprites are swarming the sleeping town —', FIELD.width / 2, 302);
    ctx.fillText('burn them back with light-seeds and hold the dark until dawn, at the end of wave 8.', FIELD.width / 2, 324);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.amberBright;
    ctx.fillText('WASD / arrows to move · mouse to aim · hold mouse or Space to fire · P pauses · M mutes', FIELD.width / 2, 358);
    button(BTN_START, 'Light the Lantern', false);
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 243, 214, 0.7)';
    ctx.fillText('Collect sparks to level up and choose how your lantern grows.', FIELD.width / 2, 486);
  }

  function drawPaused() {
    dim(0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.cream;
    ctx.font = '800 40px Georgia, serif';
    ctx.fillText('Paused', FIELD.width / 2, 250);
    ctx.font = '400 16px system-ui, sans-serif';
    ctx.fillText('Press P, Esc or Enter to keep watch.', FIELD.width / 2, 286);
  }

  function drawLevelUp(state) {
    dim(0.45);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.amberBright;
    ctx.font = '800 30px Georgia, serif';
    ctx.fillText('The lantern flares brighter…', FIELD.width / 2, 168);
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText('Choose one gift (click, or press 1 · 2 · 3)', FIELD.width / 2, 194);
    state.choices.forEach((choice, index) => {
      const rect = cardRect(index);
      panel(rect.x, rect.y, rect.w, rect.h, 0.92);
      ctx.fillStyle = COLORS.amber;
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText(String(index + 1), rect.x + rect.w / 2, rect.y + 36);
      ctx.fillStyle = COLORS.cream;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(choice.name, rect.x + rect.w / 2, rect.y + 70);
      ctx.font = '400 13.5px system-ui, sans-serif';
      ctx.fillStyle = COLORS.amberBright;
      // Blurbs are short by construction; one line each.
      ctx.fillText(choice.blurb, rect.x + rect.w / 2, rect.y + 102);
    });
  }

  function drawGameOver(state, best) {
    dim(0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.crimson;
    ctx.font = '800 46px Georgia, serif';
    ctx.fillText('The Lantern Goes Dark', FIELD.width / 2, 196);
    ctx.fillStyle = COLORS.cream;
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText(`The embers took the town on wave ${Math.max(1, state.wave)}.`, FIELD.width / 2, 240);
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = COLORS.amberBright;
    ctx.fillText(`Score ${state.score}`, FIELD.width / 2, 292);
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(`Waves survived ${Math.max(0, state.wave - (state.phase === 'clear' ? 1 : 0))} · Embers burned ${state.kills} · Time ${formatTime(state.time)} · Best ${best}`, FIELD.width / 2, 322);
    button(BTN_RESTART, 'Relight the Lantern', false);
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 243, 214, 0.7)';
    ctx.fillText('or press Enter', FIELD.width / 2, 482);
  }

  function drawVictory(state, best) {
    dim(0.38);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.amberBright;
    ctx.font = '800 48px Georgia, serif';
    ctx.fillText('Dawn Breaks', FIELD.width / 2, 190);
    ctx.fillStyle = COLORS.cream;
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText('You held the night. The town wakes under a paper-gold sky,', FIELD.width / 2, 232);
    ctx.fillText('and every window lights in thanks.', FIELD.width / 2, 256);
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = COLORS.amberBright;
    ctx.fillText(`Score ${state.score}`, FIELD.width / 2, 306);
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(`Embers burned ${state.kills} · Time ${formatTime(state.time)} · Best ${best}`, FIELD.width / 2, 336);
    button(BTN_CONTINUE, 'Keep Going (Endless)', false);
    button(BTN_AGAIN, 'New Night', false);
  }

  return { drawHud, drawTitle, drawPaused, drawLevelUp, drawGameOver, drawVictory };
}
