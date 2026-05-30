// ═══════════════════════════════════════════════════════════════
//  MAIN — Orchestrator: init, game loop, resize
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { createState, updatePhysics, getBeta } from './physics.js';
import { initInput } from './input.js';
import { SYSTEMS } from './planet-gen.js';
import { createScene } from './scene-builder.js';
import { updateScene, updateFloatingOriginOnly } from './rendering.js';
import { updateHUD, showMsg } from './hud.js';

// ═══════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════
function init() {
  // ── Renderer ──────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // ── Scene & Camera ────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    1e-8,
    20000
  );
  camera.position.set(0, 0, 0);

  // ── Ambient light (for planet MeshStandardMaterial) ────────────
  const ambientLight = new THREE.AmbientLight(0x111122, 0.3);
  scene.add(ambientLight);

  // ── Directional light (simulated distant starlight) ────────────
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 10, 10);
  scene.add(dirLight);

  // ── Scene objects ─────────────────────────────────────────────
  const sceneData = createScene(scene, SYSTEMS);

  // ── Input ─────────────────────────────────────────────────────
  const input = initInput(renderer.domElement);

  // ── Game state ────────────────────────────────────────────────
  const state = createState();

  // ── Resize handler ────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Tab key: system info popup ────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ns = SYSTEMS[state.nearestSystem];
      if (ns && state.nearestDist < 2) {
        const plist = ns.planets.map(p =>
          `${p.name} (${p.type}${p.habitable ? ' 🌍' : ''}) a=${p.a.toFixed(2)}AU r=${p.r.toFixed(1)}R⊕`
        ).join('\n');
        showMsg(`${ns.name} System\n${plist}`, 10000);
      }
    }
  });

  // ── Start loop ────────────────────────────────────────────────
  let lastT = performance.now();
  let frameN = 0;
  let hudT = 0;

  function loop(ts) {
    requestAnimationFrame(loop);
    let dt = (ts - lastT) / 1000;
    if (dt <= 0) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    lastT = ts;
    frameN++;

    // Physics
    const { beta } = updatePhysics(state, dt, input.keys, input.mouse.x, input.mouse.y, input.mouse.locked);

    // Scene update: full relativistic update every frame
    updateScene(state, sceneData);
    camera.position.set(0, 0, 0);
    camera.quaternion.setFromEuler(new THREE.Euler(state.pitch, state.yaw, state.roll, 'YXZ'));

    // HUD (throttled)
    hudT += dt;
    if (hudT > 0.12) {
      hudT = 0;
      updateHUD(state);
    }

    // Contextual messages
    if (beta > 0.5 && beta < 0.51 && frameN % 300 < 2) {
      showMsg('Stars shifting color — Doppler effect visible', 4000);
    }
    if (beta > 0.9 && beta < 0.91 && frameN % 300 < 2) {
      showMsg('⚠ Starfield compressing forward — Relativistic aberration', 5000);
    }

    renderer.render(scene, camera);
  }

  // Initial message
  showMsg('🚀 REAL-SCALE UNIVERSE | Click to fly | W/S throttle | Fly toward a star to see its planets', 0);
  lastT = performance.now();
  requestAnimationFrame(loop);

  console.log('%c🌌 Relativistic Space Explorer %c| Modular 3D Edition | 13 star systems • procedural planets',
    'font-size:16px;color:#0ff;', 'color:#aaa;');
  console.log('%cStars rendered as 3D spheres • Planets with procedural textures • Real-scale universe',
    'color:#ff0;');
}

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════

// Signal that the module loaded successfully (for the error-detection script in game.html)
window._gameLoaded = true;

init();
