// Boot and the one loop. The world advances in fixed 1/60 s steps; screens (title, play, paused,
// level-up, game over, victory) sit on top of it. Sound is routed from the world's per-step
// events so the simulation itself stays silent and deterministic.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end (with &seed=N) stages that scene from a
// fresh world with a simple autopilot, paints it twice and sets window.__shotReady.

import { STEP, createRng } from './config.js';
import { createWorld, PHASE_CLEAR, PHASE_LEVELUP } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE } from './input.js';
import { createRenderer } from './render.js';
import { createHud, BTN_AGAIN, BTN_CONTINUE, BTN_MUTE, BTN_RESTART, BTN_START, cardRect, pointIn } from './hud.js';
import { createAudio } from './audio.js';

const MAX_FRAME = 0.25;
const BEST_KEY = 'lanternfall-best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** A simple autopilot for screenshot scenes: kite away from the nearest sprite, aim at it, fire. */
function botControls(state) {
  const player = state.player;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = enemy;
    }
  }
  let moveX = 0;
  let moveY = 0;
  if (nearest) {
    const away = Math.atan2(player.y - nearest.y, player.x - nearest.x);
    moveX = Math.cos(away);
    moveY = Math.sin(away);
    // Drift back toward the middle so the keeper stays in frame.
    moveX += (480 - player.x) / 260;
    moveY += (270 - player.y) / 160;
    const len = Math.hypot(moveX, moveY) || 1;
    moveX /= len;
    moveY /= len;
  }
  return {
    move: { x: moveX, y: moveY },
    aim: nearest ? { x: nearest.x, y: nearest.y } : { x: player.x + 40, y: player.y - 40 },
    firing: nearest !== null && nearestDist < 340,
  };
}

function stageShot(name) {
  const world = createWorld(createRng(seed));
  const state = world.state;
  const events = {};
  let screen = 'title';
  if (name === 'play') {
    // Play forward until the field is genuinely busy — a wave underway, sprites closing in —
    // rather than snapping whatever a fixed clock happens to land on.
    const steps = Math.floor(120 / STEP);
    for (let i = 0; i < steps; i += 1) {
      if (state.phase === PHASE_LEVELUP) world.applyChoice(0);
      world.step(STEP, botControls(state), events);
      if (state.phase === PHASE_CLEAR) break;
      if (state.wave >= 2 && state.enemies.length >= 9 && state.projectiles.length >= 2) break;
    }
    screen = state.phase === PHASE_CLEAR ? (state.won ? 'victory' : 'over') : 'play';
  } else if (name === 'end') {
    // The keeper fights properly for a while, then is overwhelmed: a real loss, with a score.
    const still = { move: { x: 0, y: 0 }, aim: { x: 480, y: 120 }, firing: false };
    const steps = Math.floor(240 / STEP);
    for (let i = 0; i < steps; i += 1) {
      if (state.phase === PHASE_LEVELUP) world.applyChoice(1);
      world.step(STEP, i < Math.floor(55 / STEP) ? botControls(state) : still, events);
      if (state.phase === PHASE_CLEAR) break;
    }
    screen = 'over';
  } else {
    for (let i = 0; i < 90; i += 1) world.step(STEP, { move: { x: 0, y: 0 }, aim: { x: 560, y: 200 }, firing: false }, events);
    screen = 'title';
  }
  let painted = 0;
  function paint() {
    const now = performance.now() / 1000;
    renderer.draw(state, now);
    if (screen === 'title') hud.drawTitle(now);
    else if (screen === 'over') hud.drawGameOver(state, state.score);
    else if (screen === 'victory') hud.drawVictory(state, state.score);
    else hud.drawHud(state, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const world = createWorld(createRng(seed));
  const state = world.state;
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startNight() {
    world.reset();
    accumulator = 0;
    screen = 'play';
    announce('The night begins. Survive eight waves until dawn.');
  }

  function finishScreen() {
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
    if (state.won) {
      screen = 'victory';
      audio.victory();
      announce(`Dawn breaks. Score ${state.score}.`);
    } else {
      screen = 'over';
      audio.gameOver();
      announce(`Game over. Score ${state.score}. Best ${best}.`);
    }
  }

  input.onClick((x, y) => {
    audio.unlock();
    const point = { x, y };
    if (screen === 'title' && pointIn(point, BTN_START)) startNight();
    else if (screen === 'over' && pointIn(point, BTN_RESTART)) startNight();
    else if (screen === 'victory' && pointIn(point, BTN_CONTINUE)) {
      world.continueEndless();
      screen = 'play';
    } else if (screen === 'victory' && pointIn(point, BTN_AGAIN)) startNight();
    else if (screen === 'levelup') {
      for (let i = 0; i < state.choices.length; i += 1) {
        if (pointIn(point, cardRect(i))) {
          world.applyChoice(i);
          screen = 'play';
          break;
        }
      }
    } else if ((screen === 'play' || screen === 'paused') && pointIn(point, BTN_MUTE)) {
      audio.toggleMute();
    }
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions !== 0) audio.unlock();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === 'levelup') {
      const picks = input.pickActions;
      for (let i = 0; i < picks.length; i += 1) {
        if (actions & picks[i] && state.choices[i]) {
          world.applyChoice(i);
          screen = 'play';
          return;
        }
      }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title' || screen === 'over') startNight();
      else if (screen === 'victory') {
        world.continueEndless();
        screen = 'play';
      } else if (screen === 'paused') screen = 'play';
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        announce('Paused.');
      } else if (screen === 'paused') screen = 'play';
    }
  }

  function playSounds(events) {
    if (events.shoot) audio.shoot();
    if (events.hit) audio.hit();
    if (events.enemyDown) audio.enemyDown();
    if (events.pickup) audio.pickup();
    if (events.levelUp) audio.levelUp();
    if (events.hurt) audio.hurt();
    if (events.burst) audio.bossBurst();
    if (events.waveClear) audio.waveClear();
  }

  function frame(nowMs) {
    requestAnimationFrame(frame);
    const now = nowMs / 1000;
    handleActions();
    if (screen === 'play') {
      accumulator += Math.min(nowMs / 1000 - last / 1000, MAX_FRAME);
      const events = {};
      while (accumulator >= STEP && screen === 'play') {
        const controls = {
          move: input.direction(),
          aim: { x: input.mouse.x, y: input.mouse.y },
          firing: input.firing(),
        };
        world.step(STEP, controls, events);
        accumulator -= STEP;
        if (state.phase === PHASE_LEVELUP) {
          screen = 'levelup';
          announce('Level up. Choose one gift.');
        } else if (state.phase === PHASE_CLEAR) {
          finishScreen();
        }
      }
      playSounds(events);
    }
    last = nowMs;
    renderer.draw(state, now);
    if (screen === 'title') hud.drawTitle(now);
    else if (screen === 'paused') {
      hud.drawHud(state, audio.muted);
      hud.drawPaused();
    } else if (screen === 'levelup') {
      hud.drawHud(state, audio.muted);
      hud.drawLevelUp(state);
    } else if (screen === 'over') hud.drawGameOver(state, best);
    else if (screen === 'victory') hud.drawVictory(state, best);
    else hud.drawHud(state, audio.muted);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Lanternfall. Press Enter or light the lantern to start.');
  requestAnimationFrame(frame);
}

if (shot) stageShot(shot);
else runGame();
