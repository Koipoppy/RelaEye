// ═══════════════════════════════════════════════════════════════
//  PHYSICS ENGINE — Relativistic rocket equations, time dilation
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { G_IN_LY, YR_TO_S, TIME_SCALE } from './constants.js';
import { SYSTEMS } from './planet-gen.js';

// ═══════════════════════════════════════════════════════════════
//  GAME STATE FACTORY
// ═══════════════════════════════════════════════════════════════
export function createState() {
  return {
    pos: { x: 0, y: 0.0005, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0.05,
    pitch: -0.05,
    roll: 0,
    throttle: 0,
    earthTime: 0,
    shipTime: 0,
    nearestSystem: 'Sol',
    nearestDist: 0.0005,
  };
}

// ═══════════════════════════════════════════════════════════════
//  FORWARD DIRECTION FROM EULER ANGLES
// ═══════════════════════════════════════════════════════════════
export function getForward(state) {
  const euler = new THREE.Euler(state.pitch, state.yaw, state.roll, 'YXZ');
  const fwd = new THREE.Vector3(0, 0, -1);
  fwd.applyEuler(euler);
  return fwd;
}

// ═══════════════════════════════════════════════════════════════
//  VELOCITY MAGNITUDE HELPER
// ═══════════════════════════════════════════════════════════════
export function getBeta(state) {
  return Math.sqrt(state.vel.x ** 2 + state.vel.y ** 2 + state.vel.z ** 2);
}

export function getGamma(state) {
  const beta = getBeta(state);
  return beta < 0.999999 ? 1 / Math.sqrt(1 - beta * beta) : 1000;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PHYSICS UPDATE
// ═══════════════════════════════════════════════════════════════
export function updatePhysics(state, dtReal, keys, mouseX, mouseY, mouseLocked) {
  const dtGame = dtReal * TIME_SCALE / YR_TO_S;

  const velArr = [state.vel.x, state.vel.y, state.vel.z];
  const beta = Math.sqrt(velArr[0] ** 2 + velArr[1] ** 2 + velArr[2] ** 2);
  const gamma = beta < 0.999999 ? 1 / Math.sqrt(1 - beta * beta) : 1000;

  // ── Throttle ───────────────────────────────────────────────
  if (keys['w']) state.throttle = Math.min(1, state.throttle + dtReal * 0.7);
  if (keys['s']) state.throttle = Math.max(-0.3, state.throttle - dtReal * 0.7);
  if (keys[' ']) state.throttle *= Math.max(0, 1 - dtReal * 3);
  if (keys['f']) { state.throttle = 0; state.vel = { x: 0, y: 0, z: 0 }; }

  // ── Preset speeds ──────────────────────────────────────────
  if (keys['1']) { keys['1'] = false; setSpeedInstant(0, state); }
  if (keys['2']) { keys['2'] = false; setSpeedInstant(0.5, state); }
  if (keys['3']) { keys['3'] = false; setSpeedInstant(0.9, state); }
  if (keys['4']) { keys['4'] = false; setSpeedInstant(0.99, state); }
  if (keys['5']) { keys['5'] = false; setSpeedInstant(0.999, state); }
  if (keys['r']) { keys['r'] = false; state.pos = { x: 0, y: 0.0005, z: 0 }; state.vel = { x: 0, y: 0, z: 0 }; state.throttle = 0; }

  // ── Steering ───────────────────────────────────────────────
  if (keys['a']) state.yaw += 0.7 * dtReal;
  if (keys['d']) state.yaw -= 0.7 * dtReal;
  if (keys['q']) state.roll -= 1.0 * dtReal;
  if (keys['e']) state.roll += 1.0 * dtReal;
  if (mouseLocked) { state.yaw = -mouseX; state.pitch = -mouseY; }

  // ── Apply proper acceleration (relativistic rocket) ─────────
  const accelMag = state.throttle * G_IN_LY;
  const fwd = getForward(state);
  if (Math.abs(accelMag) > 1e-9 && gamma < 5000) {
    const aProp = fwd.clone().multiplyScalar(accelMag);
    const vel3 = new THREE.Vector3(state.vel.x, state.vel.y, state.vel.z);
    if (beta > 0.001) {
      const vHat = vel3.clone().normalize();
      const aPar = vHat.dot(aProp);
      const aPerp = aProp.clone().addScaledVector(vHat, -aPar);
      state.vel.x += vHat.x * aPar / (gamma ** 3) * dtGame + aPerp.x / gamma * dtGame;
      state.vel.y += vHat.y * aPar / (gamma ** 3) * dtGame + aPerp.y / gamma * dtGame;
      state.vel.z += vHat.z * aPar / (gamma ** 3) * dtGame + aPerp.z / gamma * dtGame;
    } else {
      state.vel.x += aProp.x * dtGame;
      state.vel.y += aProp.y * dtGame;
      state.vel.z += aProp.z * dtGame;
    }
  }

  // ── Clamp velocity ─────────────────────────────────────────
  const b2 = state.vel.x ** 2 + state.vel.y ** 2 + state.vel.z ** 2;
  if (b2 > 0.999999 ** 2) {
    const s = 0.999999 / Math.sqrt(b2);
    state.vel.x *= s; state.vel.y *= s; state.vel.z *= s;
  }

  // ── Update position ────────────────────────────────────────
  state.pos.x += state.vel.x * dtGame;
  state.pos.y += state.vel.y * dtGame;
  state.pos.z += state.vel.z * dtGame;

  // ── Update times ───────────────────────────────────────────
  const finalBeta = Math.sqrt(state.vel.x ** 2 + state.vel.y ** 2 + state.vel.z ** 2);
  const finalGamma = finalBeta < 0.999999 ? 1 / Math.sqrt(1 - finalBeta * finalBeta) : 1000;
  state.earthTime += dtGame;
  state.shipTime += dtGame / finalGamma;

  // ── Find nearest system ────────────────────────────────────
  let minD = Infinity, minName = '';
  Object.values(SYSTEMS).forEach(sys => {
    const dx = state.pos.x - sys.p[0];
    const dy = state.pos.y - sys.p[1];
    const dz = state.pos.z - sys.p[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < minD) { minD = d; minName = sys.name; }
  });
  state.nearestSystem = minName;
  state.nearestDist = minD;

  return { beta, gamma, dtGame };
}

// ═══════════════════════════════════════════════════════════════
//  INSTANT SPEED SETTER (presets 1-5)
// ═══════════════════════════════════════════════════════════════
export function setSpeedInstant(targetBeta, state) {
  const fwd = getForward(state);
  state.vel.x = fwd.x * targetBeta;
  state.vel.y = fwd.y * targetBeta;
  state.vel.z = fwd.z * targetBeta;
  state.throttle = 0;
}
