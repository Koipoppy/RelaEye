// ═══════════════════════════════════════════════════════════════
//  INPUT HANDLING — Keyboard, Mouse, Pointer Lock
// ═══════════════════════════════════════════════════════════════

import { showMsg } from './hud.js';

/**
 * Initialize all input handlers.
 *
 * @param {HTMLCanvasElement} domElement - Renderer canvas
 * @returns {{ keys: Object, mouseX: number, mouseY: number, mouseLocked: boolean }}
 */
export function initInput(domElement) {
  // ── Keyboard ─────────────────────────────────────────────────
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

  // ── Mouse / Pointer Lock ──────────────────────────────────────
  const mouse = { x: 0.05, y: -0.05, locked: false };

  domElement.addEventListener('click', () => {
    try {
      const promise = domElement.requestPointerLock();
      if (promise) {
        promise.catch(() => {
          showMsg('⚠ Pointer lock denied — use A/D keys to steer, or try a different browser', 5000);
        });
      }
    } catch (e) {
      showMsg('⚠ Pointer lock not supported — use A/D keys to steer', 5000);
    }
  });

  domElement.addEventListener('dblclick', () => {
    try {
      const promise = domElement.requestPointerLock();
      if (promise) promise.catch(() => {});
    } catch (e) {}
  });

  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === domElement;
    if (!mouse.locked) {
      showMsg('🖱 Click screen to enable mouse look | A/D keys to steer', 0);
    } else {
      showMsg('', 0);
    }
  });

  document.addEventListener('pointerlockerror', () => {
    showMsg('⚠ Mouse control unavailable — try clicking the screen or use keyboard A/D to look around', 6000);
  });

  document.addEventListener('mousemove', e => {
    if (mouse.locked) {
      mouse.x += e.movementX * 0.002;
      mouse.y += e.movementY * 0.002;
      mouse.y = Math.max(-1.5, Math.min(1.5, mouse.y));
    }
  });

  // ── Keyboard shortcuts (H, Tab) ────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'h') {
      showMsg('W/S:Throttle | Mouse:Look | 1:Stop 2:0.5c 3:0.9c 4:0.99c 5:0.999c | F:Brake | R:Reset to Sol | Tab:System info', 8000);
    }
  });

  return { keys, mouse };
}
