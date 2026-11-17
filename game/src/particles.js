// Transient visual feedback: ember bursts when a sprite dies, sparkles on pickups, the ring of a
// boss burst, and floating damage numbers. One pooled list, updated and drawn by the world loop;
// nothing here changes gameplay.

const MAX_PARTICLES = 420;

export function createParticles() {
  const items = [];
  const texts = [];

  function add(item) {
    if (items.length < MAX_PARTICLES) items.push(item);
  }

  return {
    items,
    texts,
    /** A puff of embers where an enemy burned out. */
    burst(x, y, color, count, speed) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const v = (0.25 + Math.random() * 0.75) * speed;
        add({
          x, y,
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v - 18,
          life: 0.45 + Math.random() * 0.4,
          age: 0,
          size: 1.6 + Math.random() * 2.6,
          color,
          drag: 2.2,
          gravity: 60,
        });
      }
    },
    /** Gentle rising sparkles, for XP pickups and level-ups. */
    sparkle(x, y, color, count) {
      for (let i = 0; i < count; i += 1) {
        add({
          x: x + (Math.random() - 0.5) * 18,
          y: y + (Math.random() - 0.5) * 18,
          vx: (Math.random() - 0.5) * 26,
          vy: -30 - Math.random() * 42,
          life: 0.5 + Math.random() * 0.45,
          age: 0,
          size: 1.4 + Math.random() * 1.8,
          color,
          drag: 0.6,
          gravity: -24,
        });
      }
    },
    /** A quick expanding ring (boss bursts, wave starts). */
    ring(x, y, color, maxRadius) {
      add({ x, y, vx: 0, vy: 0, life: 0.38, age: 0, size: 0, color, drag: 0, gravity: 0, ring: true, maxRadius });
    },
    /** A floating damage (or healing) number. */
    damageNumber(x, y, text, color) {
      texts.push({ x: x + (Math.random() - 0.5) * 10, y, text, color, age: 0, life: 0.75 });
      if (texts.length > 40) texts.shift();
    },
    update(dt) {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const p = items[i];
        p.age += dt;
        if (p.age >= p.life) {
          items.splice(i, 1);
          continue;
        }
        const dragK = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragK;
        p.vy = p.vy * dragK + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.age += dt;
        t.y -= 34 * dt;
        if (t.age >= t.life) texts.splice(i, 1);
      }
    },
    clear() {
      items.length = 0;
      texts.length = 0;
    },
  };
}
