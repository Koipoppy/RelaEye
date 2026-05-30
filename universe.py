"""
Celestial Objects & Star Catalog
=================================
Real nearby star systems, exotic objects (black holes, neutron stars),
and a Universe container that the simulator queries.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import math

from physics import (
    SOLAR_MASS, LY_TO_M, G_IN_LY, schwarzschild_radius_ly,
    gravitational_time_dilation, format_distance,
)


# ── Spectral Types & Colours ────────────────────────────────────────────────

SPEC_INFO = {
    'O': {'color': 'blue',        'mass': (16, 150),  'temp': (30_000, 50_000)},
    'B': {'color': 'blue-white',  'mass': (2.1, 16),   'temp': (10_000, 30_000)},
    'A': {'color': 'white',       'mass': (1.4, 2.1),  'temp': (7_500, 10_000)},
    'F': {'color': 'yellow-white','mass': (1.04, 1.4), 'temp': (6_000, 7_500)},
    'G': {'color': 'yellow',      'mass': (0.8, 1.04), 'temp': (5_200, 6_000)},
    'K': {'color': 'orange',      'mass': (0.45, 0.8), 'temp': (3_700, 5_200)},
    'M': {'color': 'red',         'mass': (0.08, 0.45),'temp': (2_400, 3_700)},
}


# ── Celestial Body Classes ──────────────────────────────────────────────────

@dataclass
class Star:
    """A main-sequence (or giant) star."""
    name: str
    spectral_type: str     # e.g. "G2V"
    mass_kg: float         # kg
    radius_m: float        # m
    luminosity_w: float    # W
    temperature_k: float   # K
    age_gyr: float = 5.0   # billions of years

    @property
    def mass_solar(self) -> float:
        return self.mass_kg / SOLAR_MASS

    @property
    def schwarzschild_r_ly(self) -> float:
        return schwarzschild_radius_ly(self.mass_kg)

    @property
    def color_name(self) -> str:
        letter = self.spectral_type[0]
        return SPEC_INFO.get(letter, {}).get('color', 'unknown')


@dataclass
class Planet:
    """A planet (or large moon) orbiting a star."""
    name: str
    parent_star: str
    orbital_radius_au: float   # semi-major axis, AU
    mass_kg: float
    radius_m: float
    planet_type: str           # "rocky", "gas_giant", "ice_giant", "dwarf"
    habitable: bool = False


@dataclass
class BlackHole:
    """A stellar-mass or supermassive black hole."""
    name: str
    mass_kg: float
    spin: float = 0.0          # dimensionless, [0, 1)

    @property
    def mass_solar(self) -> float:
        return self.mass_kg / SOLAR_MASS

    @property
    def schwarzschild_r_ly(self) -> float:
        return schwarzschild_radius_ly(self.mass_kg)

    @property
    def schwarzschild_r_km(self) -> float:
        return self.schwarzschild_r_ly * LY_TO_M / 1000.0

    @property
    def innermost_stable_circular_orbit_r_km(self) -> float:
        """ISCO for a non-spinning BH = 3 rₛ."""
        return 3.0 * self.schwarzschild_r_km


@dataclass
class NeutronStar:
    """A neutron star / pulsar."""
    name: str
    mass_kg: float             # typically 1.4–2.1 M☉
    radius_km: float = 12.0    # typical ~10-15 km
    rotation_hz: float = 0.0   # pulsar rotation frequency

    @property
    def mass_solar(self) -> float:
        return self.mass_kg / SOLAR_MASS


@dataclass
class StarSystem:
    """A star system with a 3-D position in the galaxy."""
    name: str
    x_ly: float               # Galactic Cartesian coords, origin = Sol
    y_ly: float
    z_ly: float
    stars: List[Star] = field(default_factory=list)
    planets: List[Planet] = field(default_factory=list)
    exotic_objects: List = field(default_factory=list)  # BlackHole | NeutronStar

    @property
    def distance_from_sol(self) -> float:
        return math.sqrt(self.x_ly ** 2 + self.y_ly ** 2 + self.z_ly ** 2)

    @property
    def primary_star(self) -> Optional[Star]:
        return self.stars[0] if self.stars else None

    @property
    def total_mass_kg(self) -> float:
        m = sum(s.mass_kg for s in self.stars)
        for obj in self.exotic_objects:
            m += obj.mass_kg
        return m

    def time_dilation_at(self, r_ly: float) -> float:
        """Gravitational time dilation at distance *r_ly* from system centre."""
        return gravitational_time_dilation(self.total_mass_kg, r_ly)

    def summary(self) -> str:
        parts = [f"{self.name}  ({format_distance(self.distance_from_sol)} from Earth)"]
        for s in self.stars:
            parts.append(f"  ★ {s.spectral_type} star  ({s.mass_solar:.1f} M☉, "
                         f"{s.temperature_k:.0f} K)")
        for p in self.planets:
            hab = " 🌍 habitable" if p.habitable else ""
            parts.append(f"  🪐 {p.name}: {p.planet_type} @ {p.orbital_radius_au:.2f} AU{hab}")
        for obj in self.exotic_objects:
            if isinstance(obj, BlackHole):
                parts.append(f"  🕳  {obj.name}: {obj.mass_solar:.1f} M☉ BH"
                             f" (rₛ = {obj.schwarzschild_r_km:.1f} km)")
            elif isinstance(obj, NeutronStar):
                parts.append(f"  ⚡ {obj.name}: {obj.mass_solar:.2f} M☉ neutron star")
        return '\n'.join(parts)


# ── Nearby Star Catalog ─────────────────────────────────────────────────────
# Positions are approximate; distances are real.

def _m_from_solar(m_solar: float) -> float:
    return m_solar * SOLAR_MASS


def build_catalog() -> Dict[str, StarSystem]:
    """Build a catalog of real nearby star systems + some exotic objects."""
    systems: Dict[str, StarSystem] = {}

    # ── Sol System ──
    sol = StarSystem(
        name="Sol",
        x_ly=0.0, y_ly=0.0, z_ly=0.0,
        stars=[Star("Sol", "G2V", _m_from_solar(1.0), 6.957e8, 3.828e26, 5778, 4.6)],
        planets=[
            Planet("Earth",   "Sol", 1.00, 5.972e24, 6371e3, "rocky", True),
            Planet("Mars",    "Sol", 1.52, 6.417e23, 3390e3, "rocky", False),
            Planet("Jupiter", "Sol", 5.20, 1.898e27, 69911e3, "gas_giant", False),
            Planet("Saturn",  "Sol", 9.54, 5.683e26, 58232e3, "gas_giant", False),
        ],
    )
    systems["Sol"] = sol

    # ── Alpha Centauri (4.37 ly) ──
    # Triple system: α Cen A, B, Proxima
    alpha_cen = StarSystem(
        name="Alpha Centauri",
        x_ly=-1.64, y_ly=-3.96, z_ly=0.37,
        stars=[
            Star("Rigil Kentaurus", "G2V",  _m_from_solar(1.10), 1.223*6.957e8, 1.519*3.828e26, 5790, 5.3),
            Star("Toliman",         "K1V",  _m_from_solar(0.907),0.863*6.957e8, 0.500*3.828e26, 5260, 5.3),
        ],
        planets=[
            Planet("Proxima b", "Alpha Centauri", 0.0485, 1.07*5.972e24, 1.08*6371e3,
                   "rocky", True),
        ],
    )
    systems["Alpha Centauri"] = alpha_cen

    # ── Barnard's Star (5.96 ly) ──
    barnard = StarSystem(
        name="Barnard's Star",
        x_ly=-0.02, y_ly=5.93, z_ly=0.25,
        stars=[Star("Barnard's Star", "M4V", _m_from_solar(0.144), 0.196*6.957e8,
                     0.00346*3.828e26, 3134, 10.0)],
        planets=[Planet("Barnard b", "Barnard's Star", 0.404, 3.23*5.972e24,
                         1.04*6371e3, "rocky", False)],
    )
    systems["Barnard's Star"] = barnard

    # ── Sirius (8.6 ly) ──
    sirius = StarSystem(
        name="Sirius",
        x_ly=-1.61, y_ly=8.33, z_ly=-1.16,
        stars=[
            Star("Sirius A", "A1V",  _m_from_solar(2.06), 1.711*6.957e8, 25.4*3.828e26, 9940, 0.24),
            Star("Sirius B", "DA2",  _m_from_solar(1.02), 0.0084*6.957e8, 0.056*3.828e26, 25200, 0.23),
        ],
    )
    systems["Sirius"] = sirius

    # ── Epsilon Eridani (10.5 ly) ──
    eps_eri = StarSystem(
        name="Epsilon Eridani",
        x_ly=6.24, y_ly=-8.34, z_ly=-0.87,
        stars=[Star("Ran", "K2V", _m_from_solar(0.82), 0.735*6.957e8, 0.34*3.828e26, 5084, 0.6)],
        planets=[Planet("AEgir", "Epsilon Eridani", 3.48, 1.55*5.972e24*317.8,
                         1.2*69911e3, "gas_giant", False)],
    )
    systems["Epsilon Eridani"] = eps_eri

    # ── Tau Ceti (11.9 ly) ──
    tau_ceti = StarSystem(
        name="Tau Ceti",
        x_ly=7.88, y_ly=-8.96, z_ly=0.45,
        stars=[Star("Tau Ceti", "G8V", _m_from_solar(0.78), 0.793*6.957e8,
                     0.488*3.828e26, 5344, 5.8)],
        planets=[
            Planet("Tau Ceti e", "Tau Ceti", 0.538, 3.93*5.972e24, 1.64*6371e3,
                   "rocky", True),
            Planet("Tau Ceti f", "Tau Ceti", 1.334, 3.93*5.972e24, 1.81*6371e3,
                   "rocky", True),
        ],
    )
    systems["Tau Ceti"] = tau_ceti

    # ── 61 Cygni (11.4 ly) ──
    cyg61 = StarSystem(
        name="61 Cygni",
        x_ly=9.25, y_ly=-6.72, z_ly=0.76,
        stars=[
            Star("61 Cyg A", "K5V", _m_from_solar(0.70), 0.665*6.957e8, 0.153*3.828e26, 4526, 6.0),
            Star("61 Cyg B", "K7V", _m_from_solar(0.63), 0.595*6.957e8, 0.085*3.828e26, 4077, 6.0),
        ],
    )
    systems["61 Cygni"] = cyg61

    # ── Procyon (11.5 ly) ──
    procyon = StarSystem(
        name="Procyon",
        x_ly=-4.79, y_ly=10.45, z_ly=-1.03,
        stars=[
            Star("Procyon A", "F5IV-V", _m_from_solar(1.50), 2.048*6.957e8, 6.93*3.828e26, 6530, 1.87),
            Star("Procyon B", "DQZ",    _m_from_solar(0.60), 0.012*6.957e8,  0.0005*3.828e26, 7740, 1.87),
        ],
    )
    systems["Procyon"] = procyon

    # ── Vega (25.0 ly) ──
    vega = StarSystem(
        name="Vega",
        x_ly=9.19, y_ly=22.69, z_ly=4.53,
        stars=[Star("Vega", "A0V", _m_from_solar(2.14), 2.362*6.957e8, 40.12*3.828e26, 9602, 0.46)],
        planets=[],
    )
    systems["Vega"] = vega

    # ── Betelgeuse (≈548 ly) — distant red supergiant ──
    betelgeuse = StarSystem(
        name="Betelgeuse",
        x_ly=260, y_ly=-470, z_ly=-100,
        stars=[Star("Betelgeuse", "M1-M2Ia-ab", _m_from_solar(16.5),
                     764*6.957e8, 126_000*3.828e26, 3500, 0.008)],
        planets=[],
    )
    systems["Betelgeuse"] = betelgeuse

    # ── Exotic: Cygnus X-1 (≈6,070 ly) — stellar-mass black hole ──
    cyg_x1 = StarSystem(
        name="Cygnus X-1",
        x_ly=1900, y_ly=-5700, z_ly=600,
        stars=[Star("HDE 226868", "O9.7Iab", _m_from_solar(41), 20*6.957e8,
                     400_000*3.828e26, 31_000, 0.005)],
        exotic_objects=[
            BlackHole("Cygnus X-1 BH", _m_from_solar(21.2), spin=0.95),
        ],
    )
    systems["Cygnus X-1"] = cyg_x1

    # ── Exotic: Sagittarius A* (≈26,670 ly) — supermassive BH ──
    sgr_a = StarSystem(
        name="Sagittarius A*",
        x_ly=0, y_ly=0, z_ly=26670,
        stars=[],
        exotic_objects=[
            BlackHole("Sgr A*", _m_from_solar(4.154e6), spin=0.5),
        ],
    )
    systems["Sagittarius A*"] = sgr_a

    # ── Exotic: Crab Pulsar (≈6,500 ly) ──
    crab = StarSystem(
        name="Crab Pulsar",
        x_ly=-3400, y_ly=-5000, z_ly=-1000,
        stars=[],
        exotic_objects=[
            NeutronStar("Crab Pulsar", _m_from_solar(1.4), radius_km=10.0, rotation_hz=30.2),
        ],
    )
    systems["Crab Pulsar"] = crab

    # ── TRAPPIST-1 (40.7 ly) — ultra-cool dwarf with 7 Earth-sized planets ──
    trappist1 = StarSystem(
        name="TRAPPIST-1",
        x_ly=36.2, y_ly=17.5, z_ly=-5.9,
        stars=[Star("TRAPPIST-1", "M8V", _m_from_solar(0.089), 0.121*6.957e8,
                     0.000522*3.828e26, 2566, 7.6)],
        planets=[
            Planet("TRAPPIST-1 b", "TRAPPIST-1", 0.011, 0.85*5.972e24, 1.09*6371e3, "rocky", False),
            Planet("TRAPPIST-1 c", "TRAPPIST-1", 0.015, 1.38*5.972e24, 1.06*6371e3, "rocky", False),
            Planet("TRAPPIST-1 d", "TRAPPIST-1", 0.021, 0.41*5.972e24, 0.77*6371e3, "rocky", False),
            Planet("TRAPPIST-1 e", "TRAPPIST-1", 0.028, 0.62*5.972e24, 0.92*6371e3, "rocky", True),
            Planet("TRAPPIST-1 f", "TRAPPIST-1", 0.037, 0.68*5.972e24, 1.04*6371e3, "rocky", True),
            Planet("TRAPPIST-1 g", "TRAPPIST-1", 0.045, 1.34*5.972e24, 1.13*6371e3, "rocky", True),
            Planet("TRAPPIST-1 h", "TRAPPIST-1", 0.062, 0.33*5.972e24, 0.76*6371e3, "rocky", False),
        ],
    )
    systems["TRAPPIST-1"] = trappist1

    return systems


# ── Universe ─────────────────────────────────────────────────────────────────

@dataclass
class Universe:
    """Container for all celestial objects the simulator can visit."""
    systems: Dict[str, StarSystem] = field(default_factory=build_catalog)

    def get(self, name: str) -> Optional[StarSystem]:
        return self.systems.get(name)

    def list_nearby(self, max_distance_ly: float = 50.0) -> List[StarSystem]:
        """Return systems within *max_distance_ly* of Sol, sorted by distance."""
        nearby = [s for s in self.systems.values()
                  if s.distance_from_sol <= max_distance_ly and s.name != "Sol"]
        nearby.sort(key=lambda s: s.distance_from_sol)
        return nearby

    def list_all_sorted(self) -> List[StarSystem]:
        all_sys = list(self.systems.values())
        all_sys.sort(key=lambda s: s.distance_from_sol)
        return all_sys

    def distance_between(self, name_a: str, name_b: str) -> Optional[float]:
        """Euclidean distance between two systems (ly)."""
        a = self.systems.get(name_a)
        b = self.systems.get(name_b)
        if a is None or b is None:
            return None
        dx = a.x_ly - b.x_ly
        dy = a.y_ly - b.y_ly
        dz = a.z_ly - b.z_ly
        return math.sqrt(dx*dx + dy*dy + dz*dz)
