// ═══════════════════════════════════════════════════════════════
//  HUD — Heads-Up Display DOM updates
// ═══════════════════════════════════════════════════════════════
import { C_KMS, AU_TO_KM, AU_TO_LY } from './constants.js';
import { SYSTEMS } from './planet-gen.js';
import { getBeta, getGamma } from './physics.js';

// ═══════════════════════════════════════════════════════════════
//  FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════
export function fmtShipTime(yrs) {
  const d = Math.floor(yrs * 365.25);
  const h = Math.floor((yrs * 365.25 - d) * 24);
  const m = Math.floor(((yrs * 365.25 - d) * 24 - h) * 60);
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtEarthTime(yrs) {
  if (yrs < 1) return fmtShipTime(yrs);
  if (yrs < 1000) return `${yrs.toFixed(2)} yr`;
  if (yrs < 1e6) return `${(yrs / 1e3).toFixed(2)} kyr`;
  return `${(yrs / 1e6).toFixed(2)} Myr`;
}

export function fmtDist(ly) {
  if (ly < 0.001) return `${(ly / AU_TO_KM).toFixed(1)} km`;
  if (ly < 0.1) return `${(ly / AU_TO_LY).toFixed(2)} AU`;
  if (ly < 1000) return `${ly.toFixed(3)} ly`;
  return `${(ly / 1000).toFixed(1)} kly`;
}

// ═══════════════════════════════════════════════════════════════
//  MESSAGE DISPLAY
// ═══════════════════════════════════════════════════════════════
export function showMsg(m, d = 3000) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = m;
  el.style.opacity = '1';
  clearTimeout(el._t);
  if (d > 0) el._t = setTimeout(() => { el.style.opacity = '0'; }, d);
}

// ═══════════════════════════════════════════════════════════════
//  FULL HUD UPDATE
// ═══════════════════════════════════════════════════════════════
export function updateHUD(state) {
  const beta = getBeta(state);
  const gamma = getGamma(state);

  // Speed
  const spdEl = document.getElementById('spd');
  if (spdEl) {
    spdEl.textContent = `${beta.toFixed(4)} c`;
    spdEl.className = beta > 0.9 ? 'warn' : 'v';
  }
  const spdKmsEl = document.getElementById('spd-kms');
  if (spdKmsEl) spdKmsEl.textContent = `${(beta * C_KMS).toFixed(0)} km/s`;

  // Gamma
  const gamEl = document.getElementById('gam');
  if (gamEl) gamEl.textContent = gamma < 10000 ? `γ=${gamma.toFixed(3)}` : `γ=${gamma.toExponential(2)}`;

  // Throttle
  const thrEl = document.getElementById('thr');
  if (thrEl) thrEl.textContent = `${Math.abs(state.throttle * 100).toFixed(0)}% ${state.throttle >= 0 ? '▶' : '◄'}`;

  // Times
  const sTimeEl = document.getElementById('stime');
  if (sTimeEl) sTimeEl.textContent = fmtShipTime(state.shipTime);
  const eTimeEl = document.getElementById('etime');
  if (eTimeEl) eTimeEl.textContent = fmtEarthTime(state.earthTime);

  // Dilation ratio
  const dilEl = document.getElementById('dil');
  if (dilEl) {
    const ratio = state.shipTime > 0.001 ? state.earthTime / state.shipTime : 1;
    dilEl.textContent = `×${ratio.toFixed(3)}`;
  }

  // System info
  const ns = SYSTEMS[state.nearestSystem];
  if (ns) {
    const sysNameEl = document.getElementById('sys-name');
    if (sysNameEl) {
      sysNameEl.textContent = state.nearestDist < 0.01
        ? `📍 ${ns.name} SYSTEM`
        : state.nearestDist < 0.5
          ? `Approaching ${ns.name}`
          : `Near ${ns.name}`;
    }
    const sysDistEl = document.getElementById('sys-dist');
    if (sysDistEl) {
      sysDistEl.textContent = `${fmtDist(state.nearestDist)} | ${ns.spec} | ${ns.m.toFixed(1)} M☉ | ${ns.planets.length} planets`;
    }
  }

  // System mini-map
  updateSysView(state, ns);
}

// ═══════════════════════════════════════════════════════════════
//  SYSTEM MINI-MAP
// ═══════════════════════════════════════════════════════════════
function updateSysView(state, ns) {
  const sysView = document.getElementById('sys-view');
  if (!sysView) return;

  if (state.nearestDist < 0.3 && ns && ns.planets.length > 0) {
    sysView.style.opacity = '1';
    sysView.innerHTML = '';
    const maxA = Math.max(...ns.planets.map(p => p.a));
    ns.planets.forEach(p => {
      const r = (p.a / maxA) * 100;
      const angle = state.earthTime * 2 * Math.PI / (p.a ** 1.5);
      const lx = 120 + r * Math.cos(angle);
      const ly = 120 + r * Math.sin(angle);
      const dot = document.createElement('div');
      dot.className = 'planet-dot';
      if (p.habitable) dot.style.background = '#4f8';
      dot.style.left = lx + 'px';
      dot.style.top = ly + 'px';
      dot.title = p.name;
      sysView.appendChild(dot);
    });
    // Central star
    const starDot = document.createElement('div');
    starDot.className = 'dot';
    starDot.style.background = '#ff0';
    starDot.style.left = '120px';
    starDot.style.top = '120px';
    starDot.style.boxShadow = '0 0 8px #ff0';
    sysView.appendChild(starDot);
  } else {
    sysView.style.opacity = '0';
  }
}
