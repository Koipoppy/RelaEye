// ═══════════════════════════════════════════════════════════════
//  PHYSICAL CONSTANTS
// ═══════════════════════════════════════════════════════════════
export const C_KMS    = 299792.458;
export const LY_TO_KM = 9.461e12;
export const AU_TO_LY  = 1.5813e-5;
export const AU_TO_KM  = 1.496e8;
export const SOLAR_R_LY = 6.957e8 / LY_TO_KM;   // ~7.35e-8 ly
export const SOLAR_M_KG  = 1.989e30;
export const YR_TO_S  = 31556952;
export const G_SI     = 9.80665;
export const G_IN_LY  = G_SI * YR_TO_S * YR_TO_S / (LY_TO_KM * 1000); // ~1.032 ly/yr²
export const EARTH_R_LY   = 6371 / LY_TO_KM;     // ~6.73e-10 ly
export const JUPITER_R_LY = 69911 / LY_TO_KM;    // ~7.39e-9 ly
export const MIN_ANGULAR  = 0.0003;              // minimum angular size for visibility
export const TIME_SCALE   = 86400 * 5;            // 5 days per real second

// ═══════════════════════════════════════════════════════════════
//  SPECTRAL COLORS (for background stars)
// ═══════════════════════════════════════════════════════════════
export const SPEC_COLS = [
  [0.7, 0.8, 1.0],   // O/B — blue-white
  [0.9, 0.93, 1.0],  // A   — white
  [1.0, 1.0, 0.85],  // F   — yellow-white
  [1.0, 0.9, 0.55],  // G   — yellow
  [1.0, 0.7, 0.4],   // K   — orange
  [1.0, 0.5, 0.3],   // M   — red
];

export const SPEC_WEIGHTS = [0.02, 0.10, 0.12, 0.16, 0.25, 0.35];

// ═══════════════════════════════════════════════════════════════
//  STAR SPECTRUM TO RGB
// ═══════════════════════════════════════════════════════════════
export function starColor(spec) {
  const map = {
    'O':     '#aaccff', 'B':     '#c8d8ff', 'A':     '#ffffff',
    'F':     '#ffffdd', 'G':     '#ffea88', 'K':     '#ffcc66',
    'M':     '#ff9966', 'M2I':   '#ff7733', 'F7I':   '#ffffaa',
    'B8I':   '#ccddff', 'M4V':   '#ff8855', 'M8V':   '#ff6633',
    'A0V':   '#ffffff', 'A1V':   '#f8f8ff', 'F5V':   '#ffffdd',
    'G2V':   '#ffee88', 'G8V':   '#ffdd77', 'K2V':   '#ffbb55',
    'K5V':   '#ffaa44',
  };
  return map[spec] || '#ffffff';
}

// ═══════════════════════════════════════════════════════════════
//  RANDOM SPECTRAL COLOR (for background stars)
// ═══════════════════════════════════════════════════════════════
export function randSpecCol() {
  let r = Math.random(), a = 0;
  for (let i = 0; i < SPEC_WEIGHTS.length; i++) {
    a += SPEC_WEIGHTS[i];
    if (r <= a) return SPEC_COLS[i];
  }
  return SPEC_COLS[5];
}
