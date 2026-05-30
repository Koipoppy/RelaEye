// ═══════════════════════════════════════════════════════════════
//  PROCEDURAL PLANET GENERATION
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { SOLAR_R_LY } from './constants.js';
import { STAR_CATALOG, SOLAR_PLANETS, TRAPPIST1_PLANETS } from './catalog.js';

// ═══════════════════════════════════════════════════════════════
//  DETERMINISTIC SEEDED RANDOM (for reproducible planets)
// ═══════════════════════════════════════════════════════════════
function seededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ═══════════════════════════════════════════════════════════════
//  PLANET CLASSIFICATION
// ═══════════════════════════════════════════════════════════════
function classifyZone(star, semiMajorAU) {
  const lum = Math.pow(star.m, 3.5);
  const habInner = 0.75 * Math.sqrt(lum);
  const habOuter = 1.75 * Math.sqrt(lum);
  const frostLine = 4.5 * Math.sqrt(lum);

  const veryHot = semiMajorAU < habInner * 0.5;
  const inHab = semiMajorAU >= habInner && semiMajorAU <= habOuter;
  const insideFrost = semiMajorAU < frostLine;

  return {
    zone: veryHot ? 'hot' : inHab ? 'habitable' : insideFrost ? 'warm' : 'cold',
    habitable: inHab,
    habInner,
    habOuter,
    frostLine,
  };
}

// ═══════════════════════════════════════════════════════════════
//  PLANET TYPE ASSIGNMENT (by zone)
// ═══════════════════════════════════════════════════════════════
function assignType(zone, rng) {
  const roll = rng();
  switch (zone) {
    case 'hot':
      return roll < 0.25 ? 'lava' : 'rocky';
    case 'habitable':
      return roll < 0.35 ? 'ocean' : 'rocky-hab';
    case 'warm':
      if (roll < 0.50) return 'rocky';
      if (roll < 0.85) return 'gas';
      return 'ice';
    case 'cold':
      if (roll < 0.35) return 'ice';
      if (roll < 0.75) return 'gas';
      return 'dwarf';
    default:
      return 'rocky';
  }
}

// ═══════════════════════════════════════════════════════════════
//  PLANET COLOR BY TYPE
// ═══════════════════════════════════════════════════════════════
function planetColor(type, rng) {
  const palettes = {
    'rocky':     ['#998877', '#887766', '#aa9988', '#776655', '#bb9977', '#8c7b6b'],
    'rocky-hab': ['#4488cc', '#55aa99', '#6699bb', '#3388aa'],
    'ocean':     ['#3366aa', '#2255aa', '#4477cc', '#335599'],
    'lava':      ['#442211', '#553322', '#331111', '#662211'],
    'gas':       ['#d4c8a8', '#e8d5a0', '#c8d8e8', '#ddccbb', '#bbccdd'],
    'ice':       ['#aaccee', '#99bbdd', '#bbddff', '#88aacc'],
    'dwarf':     ['#ccbbaa', '#bbaacc', '#aabbcc'],
  };
  const p = palettes[type] || palettes['rocky'];
  return p[Math.floor(rng() * p.length)];
}

// ═══════════════════════════════════════════════════════════════
//  GENERATE PLANETS FOR A STAR
// ═══════════════════════════════════════════════════════════════
export function generatePlanets(star, seed = 0) {
  const planets = [];
  const mass = star.m;
  const lum = Math.pow(mass, 3.5);
  const habInner = 0.75 * Math.sqrt(lum);
  const habOuter = 1.75 * Math.sqrt(lum);
  const frostLine = 4.5 * Math.sqrt(lum);

  // Deterministic RNG keyed to star name
  const nameHash = star.name.split('').reduce((a, c) => a + c.charCodeAt(0), seed);
  const rng = seededRandom(nameHash);

  // --- Inner rocky / hot planets ---
  const nRocky = 2 + Math.floor(rng() * 4);
  let lastA = 0.03 * Math.sqrt(lum);
  for (let i = 0; i < nRocky; i++) {
    lastA = lastA * (1.3 + rng() * 1.0);
    if (lastA > habOuter * 1.8) break;
    const cls = classifyZone(star, lastA);
    const type = assignType(cls.zone, rng);
    const r = type === 'lava'
      ? 0.3 + rng() * 1.5
      : type === 'rocky-hab' || type === 'ocean'
        ? 0.6 + rng() * 1.8
        : 0.3 + rng() * 2.2;
    planets.push({
      name: `${star.name} ${String.fromCharCode(98 + i)}`,
      a: lastA,
      e: type === 'rocky-hab' || type === 'ocean' ? rng() * 0.05 : rng() * 0.12,
      r: r,
      color: planetColor(type, rng),
      type,
      habitable: cls.habitable,
      moon: type === 'gas' ? Math.floor(rng() * 20) : Math.floor(rng() * 3),
      tempZone: cls.zone,
      seed: nameHash + i,
    });
  }

  // --- Gas giant / outer planets ---
  const nGas = rng() < 0.25 ? 0 : 1 + Math.floor(rng() * 3);
  lastA = Math.max(lastA * 1.5, habOuter * 1.2);
  for (let i = 0; i < nGas; i++) {
    lastA = lastA * (1.4 + rng() * 1.2);
    if (lastA > 40 * Math.sqrt(lum)) break;
    const cls = classifyZone(star, lastA);
    const type = assignType(cls.zone, rng);
    const r = type === 'gas'
      ? 3 + rng() * 12
      : type === 'ice'
        ? 1.5 + rng() * 5
        : 0.5 + rng() * 2;
    planets.push({
      name: `${star.name} ${String.fromCharCode(103 + i + nRocky)}`,
      a: lastA,
      e: rng() * 0.15,
      r: r,
      color: planetColor(type, rng),
      type,
      habitable: false,
      moon: type === 'gas' ? Math.floor(rng() * 30) : Math.floor(rng() * 5),
      ring: type === 'gas' && rng() < 0.3,
      tempZone: cls.zone,
      seed: nameHash + nRocky + i,
    });
  }

  return planets;
}

// ═══════════════════════════════════════════════════════════════
//  BUILD ALL SYSTEMS
// ═══════════════════════════════════════════════════════════════
export function buildAllSystems() {
  const systems = {};
  STAR_CATALOG.forEach((star, idx) => {
    let planets;
    if (star.planets === 'REAL' && star.name === 'Sol') {
      planets = SOLAR_PLANETS.map((p, i) => ({ ...p, seed: 1000 + i, tempZone: 'habitable' }));
    } else if (star.planets === 'REAL' && star.name === 'TRAPPIST-1') {
      planets = TRAPPIST1_PLANETS.map((p, i) => ({ ...p, seed: 2000 + i, tempZone: 'habitable' }));
    } else if (star.planets === 'PROCEDURAL') {
      planets = generatePlanets(star, idx * 100);
    } else {
      planets = [];
    }
    systems[star.name] = {
      ...star,
      planets,
      pos: new THREE.Vector3(...star.p),
      starR_ly: star.r * SOLAR_R_LY,
    };
  });
  return systems;
}

// Build once and export as the canonical systems object
export const SYSTEMS = buildAllSystems();
