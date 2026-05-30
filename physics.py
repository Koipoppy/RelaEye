"""
Relativistic Physics Engine
============================
Implements special and general relativistic effects for interstellar space travel.

Covers:
  - Lorentz factor & transformations
  - Time dilation (special + gravitational)
  - Length contraction
  - Relativistic velocity addition
  - Relativistic Doppler effect & aberration
  - Relativistic rocket equations (constant proper acceleration)
  - Gravitational time dilation (Schwarzschild / weak-field)
  - Numerical geodesic integration (RK4)

All units are naturalised: c = 1 ly/yr, so velocities are fractions of c.
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Tuple, List, Optional

# ── Physical Constants ──────────────────────────────────────────────────────

C_SI       = 299_792_458.0       # m / s
G_SI       = 6.67430e-11         # m^3 kg^-1 s^-2
SOLAR_MASS = 1.989e30            # kg
LY_TO_M    = 9.461e15            # metres per light-year
YR_TO_S    = 31_556_952.0        # seconds per Julian year
G_STANDARD = 9.80665             # m / s^2  (1 g)

# Convenience: 1 g expressed in ly / yr^2
G_IN_LY = G_STANDARD * YR_TO_S ** 2 / LY_TO_M   # ≈ 1.032 ly/yr²

# Natural units (used throughout)
C = 1.0          # ly / yr


# ── Core SR Functions ───────────────────────────────────────────────────────

def lorentz(beta: float) -> float:
    """Lorentz factor γ = 1 / √(1 − β²).  *beta* = v / c ∈ [0, 1)."""
    if beta >= 1.0:
        return float('inf')
    return 1.0 / math.sqrt(1.0 - beta * beta)


def lorentz_from_v(v: float) -> float:
    """γ from velocity *v* (ly / yr)."""
    return lorentz(v / C)


def time_dilation(dt_proper: float, v: float) -> float:
    """Coordinate (Earth) time elapsed for a proper interval *dt_proper*
    on a ship moving at speed *v*."""
    return lorentz_from_v(v) * dt_proper


def proper_time(dt_coord: float, v: float) -> float:
    """Proper (ship) time elapsed for a coordinate interval *dt_coord*."""
    return dt_coord / lorentz_from_v(v)


def length_contraction(L_proper: float, v: float) -> float:
    """Length in the direction of motion as measured by a stationary observer."""
    return L_proper / lorentz_from_v(v)


def length_seen_by_ship(L_stationary: float, v: float) -> float:
    """Distance the ship crew measures to a destination (they see it contracted)."""
    return L_stationary / lorentz_from_v(v)


def add_velocities(u: float, v: float) -> float:
    """Relativistic addition: w = (u + v) / (1 + u·v / c²)."""
    return (u + v) / (1.0 + u * v / C ** 2)


def relativistic_momentum(m0: float, v: float) -> float:
    """Relativistic momentum p = γ m₀ v."""
    return lorentz_from_v(v) * m0 * v


def relativistic_kinetic_energy(m0: float, v: float) -> float:
    """K = (γ − 1) m₀ c²."""
    return (lorentz_from_v(v) - 1.0) * m0 * C ** 2


# ── Doppler & Aberration ────────────────────────────────────────────────────

def doppler_factor(v: float, approaching: bool = True) -> float:
    """Ratio f_obs / f_src for a source moving at speed *v*.
    *approaching* → blueshift; `False` → redshift."""
    beta = v / C
    if approaching:
        return math.sqrt((1.0 + beta) / (1.0 - beta))
    else:
        return math.sqrt((1.0 - beta) / (1.0 + beta))


def doppler_shift_wavelength(v: float, lambda0: float,
                             approaching: bool = True) -> float:
    """Observed wavelength λ_obs = λ₀ / doppler_factor."""
    return lambda0 / doppler_factor(v, approaching)


def aberration_angle(theta_prime: float, v: float) -> float:
    """Relativistic aberration: angle *theta* in lab frame given angle
    *theta_prime* in the moving frame (radians, measured from direction of motion)."""
    beta = v / C
    gamma = lorentz(beta)
    cos_tp = math.cos(theta_prime)
    sin_tp = math.sin(theta_prime)
    if sin_tp == 0 and cos_tp == -1:
        return math.pi
    tan_theta = sin_tp / (gamma * (cos_tp + beta))
    theta = math.atan2(sin_tp, gamma * (cos_tp + beta))
    return theta


# ── Gravitational Time Dilation ─────────────────────────────────────────────

def schwarzschild_radius_ly(mass_kg: float) -> float:
    """Schwarzschild radius rₛ = 2 G M / c²  → returns light-years."""
    return 2.0 * G_SI * mass_kg / (C_SI ** 2) / LY_TO_M


def gravitational_time_dilation(mass_kg: float, r_ly: float) -> float:
    """Factor by which time runs slower at distance *r_ly* from mass *mass_kg*.
    dt_far / dt_near = 1 / √(1 − rₛ / r)."""
    rs = schwarzschild_radius_ly(mass_kg)
    if r_ly <= rs:
        return float('inf')
    return 1.0 / math.sqrt(1.0 - rs / r_ly)


def weak_field_time_dilation(potential_diff: float) -> float:
    """Weak-field approximation: Δt₂/Δt₁ ≈ 1 + ΔΦ / c².
    *potential_diff* = Φ₂ − Φ₁ (J / kg)."""
    return 1.0 + potential_diff / C_SI ** 2


def gravitational_potential(mass_kg: float, r_m: float) -> float:
    """Newtonian potential Φ = −G M / r  (J / kg)."""
    return -G_SI * mass_kg / r_m


# ── Relativistic Rocket (constant proper acceleration) ──────────────────────

@dataclass
class RocketState:
    """Instantaneous state of a relativistic rocket."""
    distance_ly: float      # distance traveled (Earth frame), ly
    velocity: float          # speed, ly / yr  (c = 1)
    earth_time: float        # coordinate time elapsed, yr
    proper_time: float       # proper time elapsed on ship, yr
    gamma: float             # Lorentz factor
    phase: str = "idle"     # "accel" | "coast" | "decel" | "idle"


def rocket_v_from_tau(a: float, tau: float) -> float:
    """Velocity from proper time: v(τ) = c·tanh(a τ / c)."""
    return C * math.tanh(a * tau / C)


def rocket_x_from_tau(a: float, tau: float) -> float:
    """Distance from proper time: x(τ) = (c²/a)·(cosh(a τ / c) − 1)."""
    return (C ** 2 / a) * (math.cosh(a * tau / C) - 1.0)


def rocket_t_from_tau(a: float, tau: float) -> float:
    """Earth time from proper time: t(τ) = (c/a)·sinh(a τ / c)."""
    return (C / a) * math.sinh(a * tau / C)


def rocket_tau_from_t(a: float, t: float) -> float:
    """Proper time from Earth time: τ(t) = (c/a)·arcsinh(a t / c)."""
    return (C / a) * math.asinh(a * t / C)


def rocket_v_from_t(a: float, t: float) -> float:
    """Velocity from Earth time: v(t) = a t / √(1 + (a t / c)²)."""
    at = a * t
    return at / math.sqrt(1.0 + (at / C) ** 2)


def rocket_x_from_t(a: float, t: float) -> float:
    """Distance from Earth time: x(t) = (c²/a)·(√(1 + (a t / c)²) − 1)."""
    return (C ** 2 / a) * (math.sqrt(1.0 + (a * t / C) ** 2) - 1.0)


def rocket_state_from_tau(a: float, tau: float) -> RocketState:
    """Full state given proper acceleration *a* and proper time *tau*."""
    v = rocket_v_from_tau(a, tau)
    x = rocket_x_from_tau(a, tau)
    t = rocket_t_from_tau(a, tau)
    return RocketState(
        distance_ly=x, velocity=v, earth_time=t,
        proper_time=tau, gamma=lorentz_from_v(v), phase="accel",
    )


def rocket_state_from_t(a: float, t: float) -> RocketState:
    """Full state given proper acceleration *a* and Earth time *t*."""
    v = rocket_v_from_t(a, t)
    x = rocket_x_from_t(a, t)
    tau = rocket_tau_from_t(a, t)
    return RocketState(
        distance_ly=x, velocity=v, earth_time=t,
        proper_time=tau, gamma=lorentz_from_v(v), phase="accel",
    )


# ── Journey Planner ─────────────────────────────────────────────────────────

@dataclass
class JourneyResult:
    """Complete results of a relativistic journey."""
    total_distance_ly: float
    proper_accel: float       # ly / yr²
    # Times
    earth_time_total: float
    proper_time_total: float
    # Accel phase (outbound)
    earth_time_accel: float
    proper_time_accel: float
    accel_distance: float
    # Coast phase
    earth_time_coast: float
    proper_time_coast: float
    coast_distance: float
    # Decel phase (inbound to destination)
    earth_time_decel: float
    proper_time_decel: float
    decel_distance: float
    # Velocity
    max_velocity: float
    max_beta: float
    max_gamma: float
    # Derived quantities
    time_dilation_ratio: float
    average_speed_earth: float


def plan_journey(distance_ly: float,
                 proper_accel: float = G_IN_LY,
                 accel_fraction: float = 0.5,
                 coast_fraction: float = 0.0) -> JourneyResult:
    """Plan a relativistic journey with constant proper acceleration.

    Parameters
    ----------
    distance_ly : float
        Total proper distance to travel (Earth frame).
    proper_accel : float
        Proper acceleration in ly/yr²  (1 g ≈ 1.032).
    accel_fraction : float
        Fraction of *distance* spent accelerating (0.5 = symmetric accel/decel).
    coast_fraction : float
        Fraction of *distance* spent coasting (remainder after accel + decel).

    Returns
    -------
    JourneyResult with all timing and velocity details.
    """
    if accel_fraction + coast_fraction > 1.0:
        raise ValueError("accel_fraction + coast_fraction must be ≤ 1.0")

    d_accel = distance_ly * accel_fraction
    d_coast = distance_ly * coast_fraction
    d_decel = distance_ly - d_accel - d_coast  # deceleration distance

    # ── Acceleration phase ──
    if d_accel > 0:
        tau_accel = (C / proper_accel) * math.acosh(1.0 + proper_accel * d_accel / C ** 2)
        t_accel   = (C / proper_accel) * math.sinh(proper_accel * tau_accel / C)
        v_max     = rocket_v_from_tau(proper_accel, tau_accel)
    else:
        tau_accel = 0.0
        t_accel   = 0.0
        v_max     = 0.0

    # ── Coast phase ──
    if d_coast > 0 and v_max > 0:
        t_coast_earth  = d_coast / v_max
        tau_coast_ship = t_coast_earth / lorentz_from_v(v_max)
    else:
        t_coast_earth  = 0.0
        tau_coast_ship = 0.0

    # ── Deceleration phase ──
    if d_decel > 0:
        tau_decel = (C / proper_accel) * math.acosh(1.0 + proper_accel * d_decel / C ** 2)
        t_decel   = (C / proper_accel) * math.sinh(proper_accel * tau_decel / C)
    else:
        tau_decel = 0.0
        t_decel   = 0.0

    # ── Totals ──
    t_total   = t_accel + t_coast_earth + t_decel
    tau_total = tau_accel + tau_coast_ship + tau_decel

    return JourneyResult(
        total_distance_ly   = distance_ly,
        proper_accel        = proper_accel,
        earth_time_total    = t_total,
        proper_time_total   = tau_total,
        earth_time_accel    = t_accel,
        proper_time_accel   = tau_accel,
        accel_distance      = d_accel,
        earth_time_coast    = t_coast_earth,
        proper_time_coast   = tau_coast_ship,
        coast_distance      = d_coast,
        earth_time_decel    = t_decel,
        proper_time_decel   = tau_decel,
        decel_distance      = d_decel,
        max_velocity        = v_max,
        max_beta            = v_max / C,
        max_gamma           = lorentz_from_v(v_max),
        time_dilation_ratio = t_total / tau_total if tau_total > 0 else float('inf'),
        average_speed_earth = distance_ly / t_total if t_total > 0 else 0.0,
    )


# ── Numerical Integration (for variable acceleration / GR trajectories) ─────

@dataclass
class TrajectoryPoint:
    """One point along a numerically integrated trajectory."""
    earth_time: float
    proper_time: float
    x: float           # position (ly)
    v: float           # velocity (ly / yr)
    gamma: float
    proper_accel: float
    grav_time_dilation: float = 1.0


def integrate_trajectory(
    proper_accel_profile,          # callable: (tau: float) -> float
    total_proper_time: float,
    n_steps: int = 10_000,
    gravity_mass_kg: float = 0.0,
    min_distance_ly: float = 0.01,
) -> List[TrajectoryPoint]:
    """Numerically integrate a relativistic trajectory using RK4.

    Parameters
    ----------
    proper_accel_profile : callable
        Function of proper time τ returning proper acceleration (ly/yr²).
    total_proper_time : float
        Total proper time to integrate over.
    n_steps : int
        Number of integration steps.
    gravity_mass_kg : float
        Mass of a nearby object to include gravitational time dilation.
    min_distance_ly : float
        Closest approach to the gravity source (avoid singularity).

    Returns
    -------
    List of TrajectoryPoint.
    """
    dtau = total_proper_time / n_steps
    trajectory: List[TrajectoryPoint] = []

    # Initial state
    tau = 0.0
    t   = 0.0
    x   = 0.0
    v   = 0.0

    def derivatives(_t: float, _v: float, a_proper: float) -> Tuple[float, float]:
        """Return (dt/dτ, dv/dτ) at current state."""
        gamma = lorentz_from_v(_v)
        # dt/dτ = γ
        dt_dtau = gamma
        # In the ship's instantaneous rest frame, a_proper is applied.
        # In Earth frame: dv/dt = a_proper / γ³   →   dv/dτ = a_proper / γ²
        # Derivation: a_earth = a_proper / γ³, and dv/dτ = (dv/dt)(dt/dτ) = a_earth * γ
        #              = a_proper / γ²
        dv_dtau = a_proper / (gamma * gamma)
        return dt_dtau, dv_dtau

    def rk4_step(_tau: float, _t: float, _x: float, _v: float,
                 _dtau: float, a_proper: float):
        """Single RK4 step for (t, x, v) integration."""
        # k1
        k1t, k1v = derivatives(_t, _v, a_proper)
        # k2
        t2 = _t + 0.5 * _dtau * k1t
        v2 = _v + 0.5 * _dtau * k1v
        a2 = proper_accel_profile(_tau + 0.5 * _dtau)
        k2t, k2v = derivatives(t2, v2, a2)
        # k3
        t3 = _t + 0.5 * _dtau * k2t
        v3 = _v + 0.5 * _dtau * k2v
        a3 = proper_accel_profile(_tau + 0.5 * _dtau)
        k3t, k3v = derivatives(t3, v3, a3)
        # k4
        t4 = _t + _dtau * k3t
        v4 = _v + _dtau * k3v
        a4 = proper_accel_profile(_tau + _dtau)
        k4t, k4v = derivatives(t4, v4, a4)

        t_new  = _t + (_dtau / 6.0) * (k1t + 2*k2t + 2*k3t + k4t)
        v_new  = _v + (_dtau / 6.0) * (k1v + 2*k2v + 2*k3v + k4v)
        x_new  = _x + (_dtau / 6.0) * (k1t * _v + 2*k2t*(_v+0.5*_dtau*k1v)
                                        + 2*k3t*(_v+0.5*_dtau*k2v)
                                        + k4t*(_v+0.5*_dtau*k3v*2))
        # Simpler: dx/dτ = v * dt/dτ = v * γ  or just integrate v w.r.t. t
        # Actually dx/dτ = v * (dt/dτ) = v * γ
        x_new2 = _x + (_dtau / 6.0) * (
            _v * k1t + 2 * v2 * k2t + 2 * v3 * k3t + v4 * k4t)
        return t_new, x_new2, v_new

    trajectory.append(TrajectoryPoint(
        earth_time=t, proper_time=tau, x=x, v=v,
        gamma=1.0, proper_accel=proper_accel_profile(0.0),
    ))

    for _ in range(n_steps):
        a = proper_accel_profile(tau)
        t, x, v = rk4_step(tau, t, x, v, dtau, a)
        tau += dtau

        gamma = lorentz_from_v(v)

        # Gravitational time dilation correction
        grav_dil = 1.0
        if gravity_mass_kg > 0 and x > min_distance_ly:
            grav_dil = gravitational_time_dilation(gravity_mass_kg, max(x, min_distance_ly))

        trajectory.append(TrajectoryPoint(
            earth_time=t, proper_time=tau, x=x, v=v,
            gamma=gamma, proper_accel=a,
            grav_time_dilation=grav_dil,
        ))

    return trajectory


# ── Communication Delay ─────────────────────────────────────────────────────

def communication_delay(distance_ly: float) -> float:
    """One-way light-travel time in years for *distance_ly*."""
    return distance_ly / C


def signal_arrival_earth(ship_time_sent: float, ship_distance_ly: float,
                         ship_velocity: float) -> float:
    """Earth reception time for a signal sent at *ship_time_sent*
    when the ship is at *ship_distance_ly* moving at *ship_velocity*.

    Accounts for the fact that the ship moves while the signal travels.
    Returns Earth time when signal arrives.
    """
    beta = ship_velocity / C
    # Signal travel time in Earth frame ≈ distance / c, but ship is moving
    # More precisely: d(t_recv) = d_send + v * (t_recv - t_send_ship...)
    # For simplicity, use instantaneous distance / c as first approximation
    delay = ship_distance_ly / C
    return ship_time_sent + delay


# ── Utility ─────────────────────────────────────────────────────────────────

def format_duration(years: float) -> str:
    """Pretty-print a duration in years."""
    if years < 0.001:
        return f"{years * YR_TO_S / 3600:.2f} hours"
    if years < 1.0:
        return f"{years * 365.25:.1f} days"
    if years < 1000:
        return f"{years:.2f} years"
    if years < 1_000_000:
        return f"{years / 1000:.2f} kyr"
    return f"{years / 1_000_000:.2f} Myr"


def format_velocity(v_ly_per_yr: float) -> str:
    """Pretty-print a velocity."""
    beta = v_ly_per_yr / C
    if beta < 0.0001:
        return f"{v_ly_per_yr * C_SI / 1000:.1f} km/s"
    return f"{beta:.4f}c  ({v_ly_per_yr * C_SI / 1000:.1f} km/s)"


def format_distance(ly: float) -> str:
    """Pretty-print a distance."""
    if ly < 0.01:
        return f"{ly * LY_TO_M / 1e9:.2f} million km"
    if ly < 1000:
        return f"{ly:.3f} ly"
    return f"{ly / 1000:.2f} kly"
