// ═══════════════════════════════════════════════════════════════
//  RENDERING — Per-frame scene update
//  Floating origin, relativistic effects, LOD, planet orbits
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { aberration, dopplerFactor, applyDoppler, beaming } from './relativity.js';
import { MIN_ANGULAR, SOLAR_R_LY, AU_TO_LY, EARTH_R_LY } from './constants.js';

// ═══════════════════════════════════════════════════════════════
//  FULL SCENE UPDATE (every other frame)
// ═══════════════════════════════════════════════════════════════
export function updateScene(state, sceneData) {
  const cx = state.pos.x, cy = state.pos.y, cz = state.pos.z;
  const vel3 = new THREE.Vector3(state.vel.x, state.vel.y, state.vel.z);
  const beta = vel3.length();
  const gamma = beta < 0.999999 ? 1 / Math.sqrt(1 - beta * beta) : 1000;
  const betaHat = beta > 0.0001 ? vel3.clone().normalize() : new THREE.Vector3(0, 0, 0.0001);

  // ── Background stars: Doppler + aberration ────────────────────
  updateBackgroundStars(sceneData, cx, cy, cz, vel3, beta, gamma, betaHat);

  // ── Star bodies + planets ─────────────────────────────────────
  updateStarBodies(sceneData.starBodies, cx, cy, cz, vel3, beta, gamma, betaHat, state);

  // ── Grid ──────────────────────────────────────────────────────
  sceneData.gridHelper.position.set(-cx, -cy, -cz);

  // ── Engine trail ──────────────────────────────────────────────
  updateTrail(sceneData, cx, cy, cz, state);

  // ── Reset camera position (floating origin) ───────────────────
  // camera.position is set by main.js
}

// ═══════════════════════════════════════════════════════════════
//  BACKGROUND STARS RELATIVISTIC UPDATE
// ═══════════════════════════════════════════════════════════════
function updateBackgroundStars(sceneData, cx, cy, cz, vel3, beta, gamma, betaHat) {
  const { bgStars, bgBaseCol, bgSz, N_BG } = sceneData;
  const bPosArr = bgStars.geometry.attributes.position.array;
  const bColArr = bgStars.geometry.attributes.color.array;

  for (let i = 0; i < N_BG; i++) {
    const dx = bPosArr[i * 3] - cx;
    const dy = bPosArr[i * 3 + 1] - cy;
    const dz = bPosArr[i * 3 + 2] - cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.001) continue;

    const nGal = new THREE.Vector3(dx / dist, dy / dist, dz / dist);
    const nShip = aberration(nGal, vel3, gamma);
    const cosTp = Math.max(-1, Math.min(1, nShip.dot(betaHat)));
    const D = dopplerFactor(Math.acos(cosTp), beta, gamma);
    const [r, g, b] = applyDoppler(bgBaseCol[i * 3], bgBaseCol[i * 3 + 1], bgBaseCol[i * 3 + 2], D);
    const bm = beaming(D);
    bColArr[i * 3]     = Math.min(1, r * bm);
    bColArr[i * 3 + 1] = Math.min(1, g * bm);
    bColArr[i * 3 + 2] = Math.min(1, b * bm);
    bgSz[i] = 0.2 + bm * 1.6;
  }
  bgStars.geometry.attributes.color.needsUpdate = true;
  bgStars.geometry.attributes.size.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════
//  STAR BODIES + PLANETS UPDATE
// ═══════════════════════════════════════════════════════════════
function updateStarBodies(starBodies, cx, cy, cz, vel3, beta, gamma, betaHat, state) {
  starBodies.forEach(body => {
    const sys = body.system;
    const dx = sys.p[0] - cx;
    const dy = sys.p[1] - cy;
    const dz = sys.p[2] - cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // ── Star mesh ───────────────────────────────────────────
    body.starMesh.position.set(dx, dy, dz);
    body.glowMesh.position.set(dx, dy, dz);
    body.setStarLOD(dist);

    // Relativistic color shift on star
    const nGal = dist > 0.001
      ? new THREE.Vector3(dx / dist, dy / dist, dz / dist)
      : new THREE.Vector3(0, 0, 1);
    const nShip = aberration(nGal, vel3, gamma);
    const cosTp = Math.max(-1, Math.min(1, nShip.dot(betaHat)));
    const D = dopplerFactor(Math.acos(cosTp), beta, gamma);
    const bm = beaming(D);

    if (body.starMesh.material.color) {
      const baseCol = new THREE.Color(body.starMesh.material.map ? 0xffffff : body.starMesh.material.color.getHex());
      if (body.starMesh.material.map) {
        // With texture, modulate via a tint
        const [rr, gg, bb] = applyDoppler(1, 1, 1, D);
        body.starMesh.material.color.setRGB(
          Math.min(1, rr * bm),
          Math.min(1, gg * bm),
          Math.min(1, bb * bm)
        );
      }
    }

    // Doppler tint on glow
    const [gr, gg, gb] = applyDoppler(1, 0.9, 0.7, D);
    body.glowMesh.material.color.setRGB(
      Math.min(1, gr * bm),
      Math.min(1, gg * bm),
      Math.min(1, gb * bm)
    );

    // ── Close-up star sphere ─────────────────────────────────
    body.closeUpSphere.position.set(dx, dy, dz);
    const realR = sys.starR_ly;
    const visR = Math.max(realR, dist * MIN_ANGULAR);
    body.closeUpSphere.scale.setScalar(visR);
    body.closeUpSphere.visible = dist < 0.2;
    body.closeUpSphere.material.opacity = Math.min(1, Math.max(0, (0.2 - dist) / 0.2));

    // ── Planets ──────────────────────────────────────────────
    const showDetail = dist < 0.3;
    body.planetBodies.forEach(pb => {
      // Planet position on orbit
      const angle = state.earthTime * 2 * Math.PI / Math.pow(pb.planet.a, 1.5);
      const a_ly = pb.a_ly;
      const px = dx + a_ly * Math.cos(angle);
      const pz = dz + a_ly * Math.sin(angle);
      const py = dy;
      pb.mesh.position.set(px, py, pz);
      if (pb.atmosphereMesh) {
        pb.atmosphereMesh.position.set(px, py, pz);
      }

      // LOD
      pb.setLOD(dist, { x: dx, y: dy, z: dz });

      // ── Relativistic Doppler on planet ─────────────────────
      if (beta > 0.01 && pb.mesh.visible) {
        const pDist = Math.sqrt(px * px + py * py + pz * pz);
        if (pDist > 0.0001) {
          const pNGal = new THREE.Vector3(px / pDist, py / pDist, pz / pDist);
          const pNShip = aberration(pNGal, vel3, gamma);
          const pCosTp = Math.max(-1, Math.min(1, pNShip.dot(betaHat)));
          const pD = dopplerFactor(Math.acos(pCosTp), beta, gamma);
          const pBm = beaming(pD);
          const [pr, pg, pb] = applyDoppler(1, 1, 1, pD);
          pb.mesh.material.color.setRGB(
            Math.min(1, pr * pBm),
            Math.min(1, pg * pBm),
            Math.min(1, pb * pBm)
          );
          if (pb.atmosphereMesh) {
            pb.atmosphereMesh.material.color.setRGB(
              Math.min(1, pr * pBm * 0.5),
              Math.min(1, pg * pBm * 0.5),
              Math.min(1, pb * pBm * 0.5)
            );
          }
        }
      }

      // Orbit ring
      if (pb.orbitRing) {
        pb.orbitRing.position.set(dx, dy, dz);
        pb.orbitRing.visible = showDetail && a_ly > realR * 2;
      }

      // Ring system
      if (pb.ringSystem) {
        pb.ringSystem.position.set(px, py, pz);
        pb.ringSystem.visible = showDetail && dist < 0.05;
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
//  ENGINE TRAIL UPDATE
// ═══════════════════════════════════════════════════════════════
function updateTrail(sceneData, cx, cy, cz, state) {
  const beta = Math.sqrt(state.vel.x ** 2 + state.vel.y ** 2 + state.vel.z ** 2);
  const { trailHist, trailPosArr, trailColArr, trailPts, N_TRAIL } = sceneData;

  if (beta > 0.01 && Math.abs(state.throttle) > 0.05) {
    const euler = new THREE.Euler(state.pitch, state.yaw, state.roll, 'YXZ');
    const fwd = new THREE.Vector3(0, 0, -1);
    fwd.applyEuler(euler);
    trailHist.push({
      px: cx - fwd.x * 0.1 + (Math.random() - 0.5) * 0.03,
      py: cy - fwd.y * 0.1 + (Math.random() - 0.5) * 0.03,
      pz: cz - fwd.z * 0.1 + (Math.random() - 0.5) * 0.03,
      life: 1,
    });
  }

  for (let i = trailHist.length - 1; i >= 0; i--) {
    trailHist[i].life -= 0.02;
    if (trailHist[i].life <= 0) trailHist.splice(i, 1);
  }
  while (trailHist.length > N_TRAIL) trailHist.shift();

  for (let i = 0; i < N_TRAIL; i++) {
    if (i < trailHist.length) {
      const t = trailHist[i];
      trailPosArr[i * 3]     = t.px - cx;
      trailPosArr[i * 3 + 1] = t.py - cy;
      trailPosArr[i * 3 + 2] = t.pz - cz;
      trailColArr[i * 3]     = 0.3 * t.life;
      trailColArr[i * 3 + 1] = 0.5 * t.life;
      trailColArr[i * 3 + 2] = 1 * t.life;
    } else {
      trailPosArr[i * 3] = 0;
      trailPosArr[i * 3 + 1] = 0;
      trailPosArr[i * 3 + 2] = 0;
      trailColArr[i * 3] = 0;
      trailColArr[i * 3 + 1] = 0;
      trailColArr[i * 3 + 2] = 0;
    }
  }
  trailPts.geometry.attributes.position.needsUpdate = true;
  trailPts.geometry.attributes.color.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════
//  LIGHTWEIGHT OFF-FRAME UPDATE
// ═══════════════════════════════════════════════════════════════
export function updateFloatingOriginOnly(state, sceneData) {
  const cx = state.pos.x, cy = state.pos.y, cz = state.pos.z;

  sceneData.starBodies.forEach(body => {
    const sys = body.system;
    const dx = sys.p[0] - cx, dy = sys.p[1] - cy, dz = sys.p[2] - cz;
    body.starMesh.position.set(dx, dy, dz);
    body.glowMesh.position.set(dx, dy, dz);
    body.closeUpSphere.position.set(dx, dy, dz);

    body.planetBodies.forEach(pb => {
      const angle = state.earthTime * 2 * Math.PI / Math.pow(pb.planet.a, 1.5);
      const a_ly = pb.a_ly;
      pb.mesh.position.set(dx + a_ly * Math.cos(angle), dy, dz + a_ly * Math.sin(angle));
      if (pb.atmosphereMesh) {
        pb.atmosphereMesh.position.copy(pb.mesh.position);
      }
      if (pb.orbitRing) pb.orbitRing.position.set(dx, dy, dz);
    });
  });

  sceneData.gridHelper.position.set(-cx, -cy, -cz);
}
