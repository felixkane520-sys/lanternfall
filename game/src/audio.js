// All sound is synthesized with WebAudio: a soft pentatonic pluck that wanders like distant
// wind-chimes for ambience, and short shaped blips for shots, hits, pickups and stings.
// No audio files, nothing loads. The context is created lazily on the first user gesture.

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]; // C major pentatonic ladder

export function createAudio() {
  let ctx = null;
  let master = null;
  let ambientTimer = null;
  let muted = false;
  let pluckIndex = 3;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  }

  /** One soft plucked note: a triangle wave with a quick attack and a long, quiet decay. */
  function pluck(freq, when, volume, decay) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(gain).connect(master);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  }

  /** A short noise-free blip for percussive effects: pitch glides from `from` to `to`. */
  function blip(from, to, duration, volume, type) {
    if (!ctx) return;
    const when = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), when + duration);
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  /** The ambient loop: a pluck every ~0.9 s, stepping or leaping along the pentatonic ladder. */
  function scheduleAmbient() {
    if (!ctx) return;
    const step = [1, 1, -1, 2, -2, 1, -1, 0][Math.floor(Math.random() * 8)];
    pluckIndex = Math.max(0, Math.min(PENTATONIC.length - 1, pluckIndex + step));
    pluck(PENTATONIC[pluckIndex], ctx.currentTime, 0.055, 1.6);
    if (Math.random() < 0.3) pluck(PENTATONIC[pluckIndex] * 2, ctx.currentTime + 0.02, 0.02, 1.1);
    ambientTimer = window.setTimeout(scheduleAmbient, 820 + Math.random() * 260);
  }

  return {
    /** Call from a click or key press: wakes the context and starts the ambience once. */
    unlock() {
      if (!ensure()) return;
      if (ambientTimer === null) scheduleAmbient();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      blip(880, 520, 0.07, 0.05, 'square');
    },
    hit() {
      blip(300, 180, 0.05, 0.045, 'sawtooth');
    },
    enemyDown() {
      blip(420, 60, 0.16, 0.09, 'triangle');
    },
    pickup() {
      if (!ctx) return;
      pluck(1046.5, ctx.currentTime, 0.07, 0.35);
    },
    levelUp() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => pluck(freq, now + i * 0.07, 0.11, 0.7));
    },
    hurt() {
      blip(160, 55, 0.22, 0.16, 'sawtooth');
    },
    bossBurst() {
      blip(220, 90, 0.3, 0.1, 'sawtooth');
    },
    waveClear() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [392.0, 523.25, 659.25].forEach((freq, i) => pluck(freq, now + i * 0.09, 0.1, 0.8));
    },
    victory() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => pluck(freq, now + i * 0.11, 0.12, 1.1));
    },
    gameOver() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [392.0, 329.63, 261.63, 196.0].forEach((freq, i) => pluck(freq, now + i * 0.16, 0.11, 1.0));
    },
  };
}
