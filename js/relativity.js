// ═══════════════════════════════════════════════════════════════
//  RELATIVISTIC RENDERING UTILITIES
//  Pure math functions — no state, no DOM, no side effects.
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';

/**
 * Relativistic aberration: transform a galactic direction vector
 * into the ship's rest frame.
 *
 * @param {THREE.Vector3} nGal   - Normalized direction in galactic frame
 * @param {THREE.Vector3} betaVec - Velocity vector (units of c)
 * @param {number} gamma - Lorentz factor
 * @returns {THREE.Vector3} Aberrated direction in ship frame (normalized)
 */
export function aberration(nGal, betaVec, gamma) {
  const beta = betaVec.length();
  if (beta < 0.0001) return nGal.clone();

  const betaHat = betaVec.clone().normalize();
  const cosT = nGal.dot(betaHat);
  const denom = gamma * (1 - beta * cosT);

  return nGal.clone()
    .addScaledVector(betaHat, (gamma - 1) * cosT)
    .addScaledVector(betaVec, -gamma)
    .multiplyScalar(1 / denom)
    .normalize();
}

/**
 * Relativistic Doppler factor: f_obs / f_src.
 *
 * @param {number} thetaPrime - Angle from velocity vector in ship frame (radians)
 * @param {number} beta - Speed as fraction of c
 * @param {number} gamma - Lorentz factor
 * @returns {number} Doppler factor D
 */
export function dopplerFactor(thetaPrime, beta, gamma) {
  return 1.0 / Math.max(0.001, gamma * (1 - beta * Math.cos(thetaPrime)));
}

/**
 * Apply Doppler shift to RGB color channels.
 * Blue-shifted: blue intensifies, red diminishes.
 * Red-shifted:  red intensifies, blue diminishes.
 *
 * @param {number} r - Red   [0, 1]
 * @param {number} g - Green [0, 1]
 * @param {number} b - Blue  [0, 1]
 * @param {number} D - Doppler factor (>1 blueshift, <1 redshift)
 * @returns {[number, number, number]} Shifted [r, g, b]
 */
export function applyDoppler(r, g, b, D) {
  if (D > 1) {
    // Blue-shifted
    const t = Math.min((D - 1) / 3, 1);
    r *= (1 - t * 0.7);
    b = Math.min(1, b + t * (1 - b) * 2);
    g = g * (1 - t * 0.3) + t * 0.15 * (1 - g);
  } else if (D < 1) {
    // Red-shifted
    const t = Math.min((1 - D) / 0.8, 1);
    r = Math.min(1, r + t * (1 - r) * 1.5);
    b *= (1 - t * 0.85);
    g *= (1 - t * 0.5);
  }
  return [r, g, b];
}

/**
 * Relativistic beaming (headlight effect): brightness amplification
 * in the forward direction.
 *
 * @param {number} D - Doppler factor
 * @returns {number} Brightness multiplier
 */
export function beaming(D) {
  return Math.min(3, Math.pow(Math.abs(D), 3.5));
}
