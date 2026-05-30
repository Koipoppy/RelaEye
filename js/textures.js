// ═══════════════════════════════════════════════════════════════
//  PROCEDURAL TEXTURE GENERATION via Canvas API
//  All functions return THREE.CanvasTexture
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//  NOISE PRIMITIVES (dependency-free)
// ═══════════════════════════════════════════════════════════════

/** 2D integer hash → 0..1 */
function hash(x, y) {
  let h = x * 374761393 + y * 668265263 + 1274126177;
  h = Math.imul((h ^ (h >> 13)), 1274126177);
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

/** Smooth value noise at arbitrary float coords */
function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy);
  const n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1);
  const n11 = hash(ix + 1, iy + 1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

/** Fractal / layered noise */
function fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
  let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
  for (let o = 0; o < octaves; o++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxVal += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxVal;
}

/** Seeded PRNG factory */
function seededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ═══════════════════════════════════════════════════════════════
//  COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function lerpColor(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ═══════════════════════════════════════════════════════════════
//  STAR SURFACE TEXTURE
// ═══════════════════════════════════════════════════════════════
export function generateStarTexture({ temperature = 5778, canvasSize = 256 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');

  // Star color from temperature (simplified blackbody)
  const tNorm = Math.max(0, Math.min(1, (temperature - 2500) / 10000));
  const r = Math.min(255, Math.round(255 * (0.7 + 0.3 * tNorm)));
  const g = Math.min(255, Math.round(255 * (0.4 + 0.6 * tNorm)));
  const b = Math.min(255, Math.round(255 * (0.2 + 0.8 * Math.max(0, 1 - Math.abs(tNorm - 0.5) * 2))));
  const tempColor = `rgb(${r},${g},${b})`;

  // Base radial gradient
  const half = c / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.03, 'rgba(255,255,248,0.95)');
  grad.addColorStop(0.15, tempColor.replace(')', ',0.8)').replace('rgb', 'rgba'));
  grad.addColorStop(0.4, tempColor.replace(')', ',0.35)').replace('rgb', 'rgba'));
  grad.addColorStop(0.7, tempColor.replace(')', ',0.08)').replace('rgb', 'rgba'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c, c);

  // Granulation — brightness variation via noise
  const imageData = ctx.getImageData(0, 0, c, c);
  const data = imageData.data;
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.85) {
        const n = fbm(x * 0.05, y * 0.05, 3, 0.5);
        const gran = 0.75 + 0.5 * n;
        const idx = (y * c + x) * 4;
        data[idx]     = Math.min(255, data[idx]     * gran);
        data[idx + 1] = Math.min(255, data[idx + 1] * gran);
        data[idx + 2] = Math.min(255, data[idx + 2] * gran);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
//  ROCKY PLANET TEXTURE (cratered surface)
// ═══════════════════════════════════════════════════════════════
export function generateRockyTexture({ seed = 0, colorBase = '#aa9988', canvasSize = 512 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(seed);
  const baseRgb = hexToRgb(colorBase);

  // Fill with base terrain color + noise variation
  const imageData = ctx.createImageData(c, c);
  const data = imageData.data;
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      const n = fbm(x * 0.01, y * 0.01, 3, 0.6);
      const variation = (n - 0.5) * 50;
      const idx = (y * c + x) * 4;
      data[idx]     = Math.max(0, Math.min(255, baseRgb[0] + variation));
      data[idx + 1] = Math.max(0, Math.min(255, baseRgb[1] + variation));
      data[idx + 2] = Math.max(0, Math.min(255, baseRgb[2] + variation));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Craters — power-law size distribution
  const nCraters = 25 + Math.floor(rng() * 35);
  for (let i = 0; i < nCraters; i++) {
    const cx = rng() * c;
    const cy = rng() * c;
    // Power-law: more small craters
    const size = 3 + Math.pow(rng(), 2.5) * 40;
    if (cx + size > c || cx - size < 0 || cy + size > c || cy - size < 0) continue;

    // Crater shadow (darkened side)
    ctx.beginPath();
    ctx.arc(cx + size * 0.12, cy + size * 0.12, size * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Crater interior (slightly lighter than base)
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
    const intLight = 0.1 + rng() * 0.3;
    ctx.fillStyle = `rgba(${Math.min(255, baseRgb[0] + 60)},${Math.min(255, baseRgb[1] + 50)},${Math.min(255, baseRgb[2] + 40)},${intLight + 0.2})`;
    ctx.fill();

    // Crater rim
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${Math.max(0, baseRgb[0] - 40)},${Math.max(0, baseRgb[1] - 30)},${Math.max(0, baseRgb[2] - 20)},0.6)`;
    ctx.lineWidth = size * 0.15;
    ctx.stroke();
  }

  // Surface roughness overlay
  const finalData = ctx.getImageData(0, 0, c, c);
  const fd = finalData.data;
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      const n = fbm(x * 0.04, y * 0.04, 2, 0.5);
      const v = (n - 0.5) * 20;
      const idx = (y * c + x) * 4;
      fd[idx]     = Math.max(0, Math.min(255, fd[idx] + v));
      fd[idx + 1] = Math.max(0, Math.min(255, fd[idx + 1] + v));
      fd[idx + 2] = Math.max(0, Math.min(255, fd[idx + 2] + v));
    }
  }
  ctx.putImageData(finalData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
//  GAS GIANT TEXTURE (horizontal bands + turbulence)
// ═══════════════════════════════════════════════════════════════
export function generateGasGiantTexture({ seed = 0, primaryHue = 40, canvasSize = 512 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(seed);

  const bandCount = 8 + Math.floor(rng() * 10);
  const imageData = ctx.createImageData(c, c);
  const data = imageData.data;

  for (let y = 0; y < c; y++) {
    const bandFrac = y / c;
    const bandIdx = Math.floor(bandFrac * bandCount);
    const bandN = noise2D(bandIdx * 7.3, seed * 0.1);

    const hueShift = bandN * 40 - 20;
    const sat = 0.35 + noise2D(bandIdx * 13.7, seed * 0.2) * 0.4;
    const light = 0.35 + noise2D(bandIdx * 11.1, seed * 0.3) * 0.45;

    for (let x = 0; x < c; x++) {
      const turbulence = fbm(x * 0.03, y * 0.04, 3, 0.5) * 0.2;
      const finalLight = Math.max(0, Math.min(1, light + turbulence));
      const h = (primaryHue + hueShift) % 360;
      const [r, g, b] = hslToRgb(h, sat, finalLight);

      const idx = (y * c + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Optional storm spot (Great Red Spot style, ~25% chance)
  if (rng() < 0.3) {
    const sx = c * (0.3 + rng() * 0.4);
    const sy = c * (0.35 + rng() * 0.3);
    const stormR = c * (0.06 + rng() * 0.1);

    // Storm oval
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(sx, sy, stormR, stormR * 0.55, rng() * Math.PI, 0, Math.PI * 2);
    const stormHue = rng() < 0.5 ? 0 : 15; // red or orange
    const stormGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, stormR);
    stormGrad.addColorStop(0, `hsla(${stormHue}, 70%, 55%, 0.9)`);
    stormGrad.addColorStop(0.5, `hsla(${stormHue}, 60%, 45%, 0.6)`);
    stormGrad.addColorStop(0.85, `hsla(${stormHue}, 50%, 40%, 0.3)`);
    stormGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = stormGrad;
    ctx.fill();
    ctx.restore();
  }

  return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
//  ICE WORLD TEXTURE (crystalline surface)
// ═══════════════════════════════════════════════════════════════
export function generateIceWorldTexture({ seed = 0, canvasSize = 512 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(seed);

  // Base: white to pale blue gradient via noise
  const imageData = ctx.createImageData(c, c);
  const data = imageData.data;
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      const n = fbm(x * 0.012, y * 0.012, 4, 0.55);
      // Polar darkening
      const polarFrac = Math.abs(y / c - 0.5) * 2; // 0 at eq, 1 at poles
      const polarDark = 1 - polarFrac * 0.15;

      const r = Math.min(255, 200 + n * 55);
      const g = Math.min(255, 210 + n * 45);
      const b = Math.min(255, 230 + n * 25);

      const idx = (y * c + x) * 4;
      data[idx]     = Math.min(255, r * polarDark);
      data[idx + 1] = Math.min(255, g * polarDark);
      data[idx + 2] = Math.min(255, b * polarDark);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Crystalline fracture lines
  const nLines = 15 + Math.floor(rng() * 20);
  for (let i = 0; i < nLines; i++) {
    const sx = rng() * c, sy = rng() * c;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    let cx = sx, cy = sy;
    const segments = 3 + Math.floor(rng() * 5);
    for (let j = 0; j < segments; j++) {
      cx += (rng() - 0.5) * c * 0.4;
      cy += (rng() - 0.5) * c * 0.4;
      ctx.lineTo(cx, cy);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.5 + rng() * 2;
    ctx.stroke();

    // Parallel faint companion line
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + 2);
    let cx2 = sx + 2, cy2 = sy + 2;
    const seg2 = 3 + Math.floor(rng() * 5);
    for (let j = 0; j < seg2; j++) {
      cx2 += (rng() - 0.5) * c * 0.35;
      cy2 += (rng() - 0.5) * c * 0.35;
      ctx.lineTo(cx2, cy2);
    }
    ctx.strokeStyle = 'rgba(180,210,255,0.2)';
    ctx.lineWidth = 0.3 + rng() * 1;
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
//  HABITABLE WORLD TEXTURE (oceans + continents)
// ═══════════════════════════════════════════════════════════════
export function generateHabitableTexture({ seed = 0, oceanRatio = 0.65, canvasSize = 512 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(seed);

  // Generate heightmap
  const heightMap = new Float32Array(c * c);
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      heightMap[y * c + x] = fbm(x * 0.008, y * 0.008, 5, 0.55);
    }
  }

  // Find ocean threshold
  const sorted = new Float32Array(heightMap);
  sorted.sort();
  const oceanThreshold = sorted[Math.floor(sorted.length * oceanRatio)];

  // Color palette
  const deepOcean    = [20, 40, 100];
  const shallowOcean = [40, 90, 160];
  const beach        = [200, 190, 140];
  const grassland    = [70, 140, 50];
  const forest       = [40, 100, 30];
  const highland     = [120, 100, 70];
  const mountain     = [160, 155, 140];
  const snow         = [235, 240, 245];

  const imageData = ctx.createImageData(c, c);
  const data = imageData.data;

  for (let y = 0; y < c; y++) {
    const polarFrac = Math.abs(y / c - 0.5) * 2; // 0 eq, 1 poles
    for (let x = 0; x < c; x++) {
      const h = heightMap[y * c + x];
      const idx = (y * c + x) * 4;
      let color;

      if (h < oceanThreshold) {
        // Ocean
        const depth = h / oceanThreshold;
        color = lerpColor(shallowOcean, deepOcean, Math.pow(depth, 0.6));
      } else {
        // Land
        const elevation = (h - oceanThreshold) / (1 - oceanThreshold);
        if (elevation < 0.05) {
          color = beach;
        } else if (elevation < 0.35) {
          color = lerpColor(grassland, forest, (elevation - 0.05) / 0.3);
        } else if (elevation < 0.65) {
          color = lerpColor(forest, highland, (elevation - 0.35) / 0.3);
        } else if (elevation < 0.85) {
          color = lerpColor(highland, mountain, (elevation - 0.65) / 0.2);
        } else {
          color = lerpColor(mountain, snow, (elevation - 0.85) / 0.15);
        }
      }

      // Ice caps at poles
      if (polarFrac > 0.82) {
        const iceAmount = (polarFrac - 0.82) / 0.18;
        color = lerpColor(color, snow, Math.pow(iceAmount, 1.5));
      }

      data[idx]     = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Cloud wisps
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 60; i++) {
    const cx = rng() * c, cy = rng() * c;
    const w = 20 + rng() * 120, h = 5 + rng() * 25;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
//  LAVA WORLD TEXTURE
// ═══════════════════════════════════════════════════════════════
export function generateLavaTexture({ seed = 0, canvasSize = 512 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(seed);

  // Dark rocky base
  const imageData = ctx.createImageData(c, c);
  const data = imageData.data;
  for (let y = 0; y < c; y++) {
    for (let x = 0; x < c; x++) {
      const n = fbm(x * 0.015, y * 0.015, 3, 0.6);
      const idx = (y * c + x) * 4;
      data[idx]     = 30 + n * 50;
      data[idx + 1] = 15 + n * 30;
      data[idx + 2] = 10 + n * 20;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Lava cracks
  const nCracks = 8 + Math.floor(rng() * 12);
  for (let i = 0; i < nCracks; i++) {
    ctx.beginPath();
    let lx = rng() * c, ly = rng() * c;
    ctx.moveTo(lx, ly);
    const segs = 5 + Math.floor(rng() * 10);
    for (let j = 0; j < segs; j++) {
      lx += (rng() - 0.5) * c * 0.3;
      ly += (rng() - 0.5) * c * 0.3;
      ctx.lineTo(lx, ly);
    }
    // Glow
    ctx.strokeStyle = 'rgba(255,120,20,0.8)';
    ctx.lineWidth = 2 + rng() * 3;
    ctx.stroke();
    // Bright center
    ctx.strokeStyle = 'rgba(255,220,100,0.9)';
    ctx.lineWidth = 0.5 + rng() * 1;
    ctx.stroke();
  }

  // Lava pools
  const nPools = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < nPools; i++) {
    const px = rng() * c, py = rng() * c;
    const pr = 8 + rng() * 30;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, 'rgba(255,240,150,0.9)');
    grad.addColorStop(0.3, 'rgba(255,150,30,0.7)');
    grad.addColorStop(0.7, 'rgba(200,60,10,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
//  ATMOSPHERE GLOW TEXTURE (limb brightening)
// ═══════════════════════════════════════════════════════════════
export function generateAtmosphereTexture({ color = '#4488ff', canvasSize = 128 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  const half = c / 2;

  const rgb = hexToRgb(color);
  const grad = ctx.createRadialGradient(half, half, half * 0.4, half, half, half);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.8, 'rgba(0,0,0,0)');
  grad.addColorStop(0.92, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)`);
  grad.addColorStop(0.97, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.7)`);
  grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c, c);

  return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
//  GLOW HALO TEXTURE (for star glow)
// ═══════════════════════════════════════════════════════════════
export function generateGlowTexture({ canvasSize = 128 } = {}) {
  const c = canvasSize;
  const canvas = document.createElement('canvas');
  canvas.width = c;
  canvas.height = c;
  const ctx = canvas.getContext('2d');
  const half = c / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.02, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.1, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.15)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.02)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c, c);

  return new THREE.CanvasTexture(canvas);
}
