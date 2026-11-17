// Keyboard and mouse state: held movement keys, the aim point in field coordinates, whether the
// fire button is down, and a queue of one-shot actions (confirm, pause, mute, upgrade picks)
// that main.js drains once per frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_PICK_1 = 8;
export const ACTION_PICK_2 = 16;
export const ACTION_PICK_3 = 32;

const PICK_ACTIONS = [ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3];

export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 480, y: 200, down: false, inside: false };
  let actions = 0;
  const clickHandlers = [];

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Digit1') actions |= ACTION_PICK_1;
    if (event.code === 'Digit2') actions |= ACTION_PICK_2;
    if (event.code === 'Digit3') actions |= ACTION_PICK_3;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const point = toField(event);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.inside = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = toField(event);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
    for (const handler of clickHandlers) handler(point.x, point.y);
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.inside = false;
  });

  return {
    mouse,
    /** Movement as a unit vector from WASD / arrow keys. */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = Math.SQRT1_2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** Firing when the mouse is held or Space is down. */
    firing() {
      return mouse.down || held.has('Space');
    },
    /** Drain the one-shot action bits gathered since the last frame. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Register a click handler (upgrade cards, buttons); fires on canvas mousedown. */
    onClick(handler) {
      clickHandlers.push(handler);
    },
    pickActions: PICK_ACTIONS,
  };
}
