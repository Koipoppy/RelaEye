// ═══════════════════════════════════════════════════════════════
//  SCENE BUILDER — Create all Three.js scene objects
//  Single factory: createScene(scene, systems) → sceneData
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { createStarBody, createPlanetBody, createOrbitRing, createRingSystem } from './geometry.js';
import { generateGlowTexture } from './textures.js';
import { randSpecCol, AU_TO_LY, SOLAR_R_LY } from './constants.js';

const N_BG = 5000;
const N_TRAIL = 150;
const glowTex = generateGlowTexture();

// ═══════════════════════════════════════════════════════════════
//  BACKGROUND STARS (5000 points on large sphere)
// ═══════════════════════════════════════════════════════════════
function createBackgroundStars(scene) {
  const bgGeom = new THREE.BufferGeometry();
  const bgPos = new Float32Array(N_BG * 3);
  const bgBaseCol = new Float32Array(N_BG * 3);
  const bgCol = new Float32Array(N_BG * 3);
  const bgSz = new Float32Array(N_BG);

  for (let i = 0; i < N_BG; i++) {
    const th = Math.acos(2 * Math.random() - 1);
    const ph = Math.random() * Math.PI * 2;
    const rad = 600 + Math.random() * 400;
    bgPos[i * 3]     = rad * Math.sin(th) * Math.cos(ph);
    bgPos[i * 3 + 1] = rad * Math.sin(th) * Math.sin(ph);
    bgPos[i * 3 + 2] = rad * Math.cos(th);
    const c = randSpecCol();
    bgBaseCol[i * 3]     = c[0];
    bgBaseCol[i * 3 + 1] = c[1];
    bgBaseCol[i * 3 + 2] = c[2];
    bgCol[i * 3]     = c[0];
    bgCol[i * 3 + 1] = c[1];
    bgCol[i * 3 + 2] = c[2];
    bgSz[i] = 0.2 + Math.random() * 1.8;
  }
  bgGeom.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  bgGeom.setAttribute('color', new THREE.BufferAttribute(bgCol, 3));
  bgGeom.setAttribute('size', new THREE.BufferAttribute(bgSz, 1));

  const bgMat = new THREE.PointsMaterial({
    size: 1.0,
    map: glowTex,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  });
  const bgStars = new THREE.Points(bgGeom, bgMat);
  scene.add(bgStars);

  return { bgStars, bgBaseCol, bgSz };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN SCENE FACTORY
// ═══════════════════════════════════════════════════════════════
export function createScene(scene, systems) {
  // ── Background stars ──────────────────────────────────────────
  const bgData = createBackgroundStars(scene);

  // ── Star + planet 3D bodies ───────────────────────────────────
  const starBodies = [];

  Object.values(systems).forEach(sys => {
    const { mesh, glowMesh, setLOD } = createStarBody(sys);
    scene.add(mesh);
    scene.add(glowMesh);

    // Close-up star sphere
    const sphereGeom = new THREE.SphereGeometry(1, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: sys.spec ? (function (s) {
        const map = { 'O': '#aaccff', 'B': '#c8d8ff', 'A': '#ffffff', 'F': '#ffffdd', 'G': '#ffea88', 'K': '#ffcc66', 'M': '#ff9966' };
        for (const [key, val] of Object.entries(map)) { if (s.startsWith(key)) return val; }
        return '#ffffff';
      })(sys.spec) : '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const closeUpSphere = new THREE.Mesh(sphereGeom, sphereMat);
    closeUpSphere.position.copy(sys.pos);
    closeUpSphere.visible = false;
    closeUpSphere.userData = { systemName: sys.name, realRadius: sys.starR_ly };
    scene.add(closeUpSphere);

    // Planets
    const planetBodies = [];
    sys.planets.forEach(planet => {
      const orbitA_ly = planet.a * AU_TO_LY;
      const { mesh: pMesh, atmosphereMesh, setLOD: pSetLOD } = createPlanetBody(planet, sys);
      scene.add(pMesh);
      if (atmosphereMesh) scene.add(atmosphereMesh);

      // Orbit ring
      let orbitRing = null;
      if (orbitA_ly > 1e-9) {
        orbitRing = createOrbitRing(orbitA_ly);
        if (orbitRing) scene.add(orbitRing);
      }

      // Saturn-like rings
      let ringSystem = null;
      if (planet.ring) {
        const pRadiusLy = planet.r * (planet.type === 'gas' ? (69911 / 9.461e12) : (6371 / 9.461e12));
        ringSystem = createRingSystem(pRadiusLy);
        if (ringSystem) scene.add(ringSystem);
      }

      planetBodies.push({
        planet,
        mesh: pMesh,
        atmosphereMesh,
        orbitRing,
        ringSystem,
        setLOD: pSetLOD,
        a_ly: orbitA_ly,
      });
    });

    starBodies.push({
      system: sys,
      starMesh: mesh,
      glowMesh,
      closeUpSphere,
      setStarLOD: setLOD,
      planetBodies,
    });
  });

  // ── Grid at Sol ───────────────────────────────────────────────
  const gridHelper = new THREE.PolarGridHelper(2, 32, 20, 64, 0x224466, 0x112233);
  scene.add(gridHelper);

  // ── Engine trail ──────────────────────────────────────────────
  const trailGeom = new THREE.BufferGeometry();
  const trailPosArr = new Float32Array(N_TRAIL * 3);
  const trailColArr = new Float32Array(N_TRAIL * 3);
  trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPosArr, 3));
  trailGeom.setAttribute('color', new THREE.BufferAttribute(trailColArr, 3));
  const trailMat = new THREE.PointsMaterial({
    size: 0.04,
    map: glowTex,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const trailPts = new THREE.Points(trailGeom, trailMat);
  scene.add(trailPts);
  const trailHist = [];

  return {
    ...bgData,
    starBodies,
    gridHelper,
    trailPts,
    trailHist,
    trailPosArr,
    trailColArr,
    N_BG,
    N_TRAIL,
  };
}
