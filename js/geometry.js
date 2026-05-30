// ═══════════════════════════════════════════════════════════════
//  3D GEOMETRY CREATION — Stars, planets, rings, orbits
//  Replaces all THREE.Sprite usage with real 3D meshes.
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import {
  generateStarTexture, generateRockyTexture, generateGasGiantTexture,
  generateIceWorldTexture, generateHabitableTexture, generateLavaTexture,
  generateAtmosphereTexture, generateGlowTexture,
} from './textures.js';
import { SOLAR_R_LY, EARTH_R_LY, JUPITER_R_LY, AU_TO_LY, MIN_ANGULAR } from './constants.js';
import { starColor } from './constants.js';

// ═══════════════════════════════════════════════════════════════
//  SHARED GLOW TEXTURE (reused for all stars)
// ═══════════════════════════════════════════════════════════════
const glowTex = generateGlowTexture();

// ═══════════════════════════════════════════════════════════════
//  STAR 3D BODY
// ═══════════════════════════════════════════════════════════════
export function createStarBody(sys) {
  const realRadius = sys.r * SOLAR_R_LY;
  const tex = generateStarTexture({ temperature: sys.T });

  // Main star sphere
  const geom = new THREE.SphereGeometry(1, 32, 32);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(sys.pos);
  mesh.userData = { isStar: true, systemName: sys.name };
  mesh.visible = true; // Always visible (scaled by LOD)

  // Glow halo
  const glowGeom = new THREE.SphereGeometry(1, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: starColor(sys.spec),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.35,
  });
  const glowMesh = new THREE.Mesh(glowGeom, glowMat);
  glowMesh.userData = { isGlow: true, systemName: sys.name };

  /**
   * LOD update: scale the star to maintain minimum angular size.
   */
  function setLOD(distance) {
    const minR = distance * MIN_ANGULAR;
    const renderR = Math.max(realRadius, minR);
    mesh.scale.setScalar(renderR);
    glowMesh.scale.setScalar(renderR * 2.5);
    // Note: position is set by rendering.js (floating origin)
  }

  return { mesh, glowMesh, setLOD, realRadius, system: sys };
}

// ═══════════════════════════════════════════════════════════════
//  PLANET 3D BODY
// ═══════════════════════════════════════════════════════════════
export function createPlanetBody(planet, star) {
  const realRadius = planet.r * EARTH_R_LY;
  const isGas = planet.type === 'gas';
  const isIce = planet.type === 'ice';
  const isHab = planet.type === 'rocky-hab' || planet.type === 'ocean' || planet.habitable;
  const isLava = planet.type === 'lava';

  // Generate appropriate texture
  let tex;
  if (isGas) {
    tex = generateGasGiantTexture({
      seed: planet.seed || 0,
      primaryHue: planet.tempZone === 'cold' ? 200 : 35,
    });
  } else if (isIce) {
    tex = generateIceWorldTexture({ seed: planet.seed || 0 });
  } else if (isHab) {
    tex = generateHabitableTexture({ seed: planet.seed || 0 });
  } else if (isLava) {
    tex = generateLavaTexture({ seed: planet.seed || 0 });
  } else {
    tex = generateRockyTexture({ seed: planet.seed || 0, colorBase: planet.color });
  }

  // Planet mesh
  const segments = isGas ? 48 : 32;
  const rings = isGas ? 24 : 24;
  const geom = new THREE.SphereGeometry(1, segments, rings);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: isGas ? 0.9 : 0.7,
    metalness: isGas ? 0 : 0.05,
  });
  const mesh = new THREE.Mesh(geom, mat);

  // Atmosphere (for habitable and some rocky planets)
  let atmosphereMesh = null;
  if (isHab || (planet.type === 'rocky' && planet.moon > 0)) {
    const atmoColor = isHab ? '#4488cc' : '#8899aa';
    const atmoTex = generateAtmosphereTexture({ color: atmoColor });
    const atmoGeom = new THREE.SphereGeometry(1.03, 48, 24);
    const atmoMat = new THREE.MeshBasicMaterial({
      map: atmoTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.3,
    });
    atmosphereMesh = new THREE.Mesh(atmoGeom, atmoMat);
  }

  /**
   * LOD update: scale planet, show/hide based on distance.
   */
  function setLOD(distance, systemPos) {
    const relX = systemPos.x;
    const relY = systemPos.y;
    const relZ = systemPos.z;
    const minR = distance * MIN_ANGULAR * 0.5;
    const renderR = Math.max(realRadius, Math.min(minR, planet.a * AU_TO_LY * 0.3));
    const scale = renderR;

    const visible = distance < 0.3;
    mesh.visible = visible;
    mesh.scale.setScalar(scale);
    if (atmosphereMesh) {
      atmosphereMesh.visible = visible && distance < 0.05;
      atmosphereMesh.scale.setScalar(scale * 1.03);
    }

    // Position will be set by rendering.js relative to system + orbit
    return { visible, scale };
  }

  return { mesh, atmosphereMesh, setLOD, realRadius, planet };
}

// ═══════════════════════════════════════════════════════════════
//  ORBIT RING
// ═══════════════════════════════════════════════════════════════
export function createOrbitRing(orbitA_ly) {
  if (orbitA_ly < 1e-9) return null;
  const orbitGeom = new THREE.TorusGeometry(orbitA_ly, orbitA_ly * 0.003, 8, 80);
  const orbitMat = new THREE.MeshBasicMaterial({
    color: 0x334455,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(orbitGeom, orbitMat);
  ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
  ring.visible = false;
  return ring;
}

// ═══════════════════════════════════════════════════════════════
//  SATURN-LIKE RING SYSTEM
// ═══════════════════════════════════════════════════════════════
export function createRingSystem(planetRadiusLy) {
  const innerR = planetRadiusLy * 1.4;
  const outerR = planetRadiusLy * 2.8;

  // Ring texture
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = 256;
  ringCanvas.height = 16;
  const rctx = ringCanvas.getContext('2d');
  const rGrad = rctx.createLinearGradient(0, 0, 256, 0);
  rGrad.addColorStop(0, 'rgba(180,160,140,0.0)');
  rGrad.addColorStop(0.1, 'rgba(200,180,150,0.7)');
  rGrad.addColorStop(0.25, 'rgba(220,200,160,0.9)');
  rGrad.addColorStop(0.4, 'rgba(160,140,120,0.4)');
  rGrad.addColorStop(0.5, 'rgba(200,180,150,0.8)');
  rGrad.addColorStop(0.7, 'rgba(140,120,100,0.5)');
  rGrad.addColorStop(0.85, 'rgba(180,160,130,0.3)');
  rGrad.addColorStop(1, 'rgba(100,80,60,0.0)');
  rctx.fillStyle = rGrad;
  rctx.fillRect(0, 0, 256, 16);
  const ringTex = new THREE.CanvasTexture(ringCanvas);

  const ringGeom = new THREE.RingGeometry(innerR, outerR, 64);
  // Rotate UVs for ring
  const pos = ringGeom.attributes.position;
  const uv = ringGeom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dist = Math.sqrt(x * x + y * y);
    uv.setXY(i, (dist - innerR) / (outerR - innerR), 0.5);
  }

  const ringMat = new THREE.MeshBasicMaterial({
    map: ringTex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.rotation.x = Math.PI / 2 + 0.45;
  ringMesh.visible = false;

  return ringMesh;
}
