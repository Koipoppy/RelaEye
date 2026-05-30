"""
Mission Simulation Engine
==========================
Simulates relativistic space journeys: multi-phase trajectories,
event recording, communication delay tracking, and relativistic
effect computation throughout the mission.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Callable
import math
import time as time_module

from physics import (
    C, G_IN_LY, lorentz_from_v,
    plan_journey, JourneyResult,
    RocketState, rocket_state_from_tau, rocket_tau_from_t,
    integrate_trajectory, TrajectoryPoint,
    doppler_factor, length_seen_by_ship,
    communication_delay, format_duration, format_velocity, format_distance,
    gravitational_time_dilation,
)
from universe import Universe, StarSystem, BlackHole


# ── Mission Event ───────────────────────────────────────────────────────────

@dataclass
class MissionEvent:
    """A notable event during the mission."""
    earth_time_yr: float
    proper_time_yr: float
    event_type: str           # "launch", "max_q", "turnover", "arrival", "signal", ...
    description: str
    distance_ly: float = 0.0
    velocity: float = 0.0


# ── Mission Config ──────────────────────────────────────────────────────────

@dataclass
class MissionConfig:
    """Parameters for a space mission."""
    origin: str                          # system name
    destination: str                     # system name
    proper_accel: float = G_IN_LY        # ly / yr²  (1 g ≈ 1.032)
    accel_fraction: float = 0.5          # fraction of distance accelerating
    coast_fraction: float = 0.0          # fraction of distance coasting
    mission_name: str = "Unnamed Mission"
    crew_size: int = 4
    ship_mass_tonnes: float = 1000.0


# ── Mission Simulator ───────────────────────────────────────────────────────

@dataclass
class MissionSimulator:
    """Runs a relativistic space mission from origin to destination."""

    config: MissionConfig
    universe: Universe = field(default_factory=Universe)

    # Computed after init
    origin_system: Optional[StarSystem] = None
    dest_system: Optional[StarSystem] = None
    distance_ly: float = 0.0
    journey: Optional[JourneyResult] = None
    events: List[MissionEvent] = field(default_factory=list)
    trajectory: List[TrajectoryPoint] = field(default_factory=list)
    _current_state: Optional[RocketState] = None
    _phase: str = "idle"

    def __post_init__(self):
        self.origin_system = self.universe.get(self.config.origin)
        self.dest_system   = self.universe.get(self.config.destination)

        if self.origin_system is None:
            raise ValueError(f"Unknown origin system: {self.config.origin}")
        if self.dest_system is None:
            raise ValueError(f"Unknown destination system: {self.config.destination}")

        self.distance_ly = self.universe.distance_between(
            self.config.origin, self.config.destination)
        if self.distance_ly is None or self.distance_ly <= 0:
            raise ValueError(
                f"Cannot compute distance between {self.config.origin} and {self.config.destination}")

    # ── Planning ─────────────────────────────────────────────────────────

    def plan(self) -> JourneyResult:
        """Compute the journey plan."""
        self.journey = plan_journey(
            distance_ly=self.distance_ly,
            proper_accel=self.config.proper_accel,
            accel_fraction=self.config.accel_fraction,
            coast_fraction=self.config.coast_fraction,
        )
        self._generate_event_plan()
        return self.journey

    def _generate_event_plan(self):
        """Pre-compute key mission events."""
        j = self.journey
        if j is None:
            return

        self.events = []

        # Launch
        self.events.append(MissionEvent(
            earth_time_yr=0.0, proper_time_yr=0.0,
            event_type="launch",
            description=f"Departure from {self.config.origin}",
        ))

        # End of acceleration / begin coast
        if j.earth_time_accel > 0:
            self.events.append(MissionEvent(
                earth_time_yr=j.earth_time_accel,
                proper_time_yr=j.proper_time_accel,
                event_type="end_accel",
                description=f"End of acceleration phase. "
                            f"Velocity: {format_velocity(j.max_velocity)}, γ = {j.max_gamma:.2f}",
                distance_ly=j.accel_distance,
                velocity=j.max_velocity,
            ))

        # Begin deceleration (start of decel phase)
        t_decel_start = j.earth_time_accel + j.earth_time_coast
        tau_decel_start = j.proper_time_accel + j.proper_time_coast
        d_decel_start = j.accel_distance + j.coast_distance

        if j.earth_time_decel > 0:
            self.events.append(MissionEvent(
                earth_time_yr=t_decel_start,
                proper_time_yr=tau_decel_start,
                event_type="turnover",
                description=f"Turnover — begin deceleration. "
                            f"Velocity: {format_velocity(j.max_velocity)}",
                distance_ly=d_decel_start,
                velocity=j.max_velocity,
            ))

        # Midpoint (in terms of distance)
        half_dist = self.distance_ly / 2.0
        # Find the time corresponding to half distance
        mid_state = self.state_at_distance(half_dist) if half_dist > 0 else None
        if mid_state:
            self.events.append(MissionEvent(
                earth_time_yr=mid_state.earth_time,
                proper_time_yr=mid_state.proper_time,
                event_type="midpoint",
                description=f"Midpoint of journey. Halfway to {self.config.destination}.",
                distance_ly=half_dist,
                velocity=mid_state.velocity,
            ))

        # Arrival
        self.events.append(MissionEvent(
            earth_time_yr=j.earth_time_total,
            proper_time_yr=j.proper_time_total,
            event_type="arrival",
            description=f"Arrival at {self.config.destination}!",
            distance_ly=self.distance_ly,
            velocity=0.0,
        ))

        # Sort events by Earth time
        self.events.sort(key=lambda e: e.earth_time_yr)

    # ── State Querying ──────────────────────────────────────────────────

    def state_at_earth_time(self, t: float) -> Optional[RocketState]:
        """Compute ship state at a given Earth time *t*."""
        j = self.journey
        if j is None:
            return None

        # Clamp
        if t <= 0:
            return RocketState(0.0, 0.0, 0.0, 0.0, 1.0, "idle")
        if t >= j.earth_time_total:
            return RocketState(self.distance_ly, 0.0, j.earth_time_total,
                               j.proper_time_total, 1.0, "idle")

        # Phase boundaries in Earth time
        t_accel_end  = j.earth_time_accel
        t_coast_end  = t_accel_end + j.earth_time_coast

        if t <= t_accel_end:
            return self._state_accel(t, j)
        elif t <= t_coast_end:
            return self._state_coast(t, j)
        else:
            return self._state_decel(t, j)

    def _state_accel(self, t: float, j: JourneyResult) -> RocketState:
        """Ship state during acceleration phase (starting from rest)."""
        a = self.config.proper_accel
        tau = (C / a) * math.asinh(a * t / C)
        state = rocket_state_from_tau(a, tau)
        state.phase = "accel"
        return state

    def _state_coast(self, t: float, j: JourneyResult) -> RocketState:
        """Ship state during coast phase."""
        coast_t = t - j.earth_time_accel
        v = j.max_velocity
        gamma = j.max_gamma

        x = j.accel_distance + v * coast_t
        tau = j.proper_time_accel + coast_t / gamma

        return RocketState(x, v, t, tau, gamma, "coast")

    def _state_decel(self, t: float, j: JourneyResult) -> RocketState:
        """Ship state during deceleration phase (slowing to rest at destination)."""
        a = self.config.proper_accel

        # Time into deceleration phase
        t_into_decel = t - (j.earth_time_accel + j.earth_time_coast)

        # Mirror: time remaining in deceleration
        t_remaining = j.earth_time_decel - t_into_decel

        # The state during decel mirrors acceleration from rest:
        # at t_remaining Earth time before arrival, the ship is at the
        # same velocity & distance-from-destination as a ship accelerating
        # from rest for t_remaining.
        mirror_state = rocket_state_from_tau(a, (C / a) * math.asinh(a * t_remaining / C))

        # Position: total_distance - distance_from_destination
        # distance_from_destination = mirror_state.distance_ly
        x = self.distance_ly - mirror_state.distance_ly
        v = mirror_state.velocity
        gamma = mirror_state.gamma

        # Proper time: start of decel proper time + proper time into decel
        tau_decel_start = j.proper_time_accel + j.proper_time_coast
        tau_into_decel = j.proper_time_decel - mirror_state.proper_time
        tau = tau_decel_start + tau_into_decel

        return RocketState(x, v, t, tau, gamma, "decel")

    def state_at_distance(self, d: float) -> Optional[RocketState]:
        """Find ship state when it reaches distance *d* from origin."""
        j = self.journey
        if j is None:
            return None

        if d <= 0:
            return RocketState(0.0, 0.0, 0.0, 0.0, 1.0, "idle")
        if d >= self.distance_ly:
            return RocketState(self.distance_ly, 0.0, j.earth_time_total,
                               j.proper_time_total, 1.0, "idle")

        a = self.config.proper_accel

        # Determine which phase this distance falls in
        if d <= j.accel_distance:
            # Acceleration phase
            tau = (C / a) * math.acosh(1.0 + a * d / C ** 2)
            state = rocket_state_from_tau(a, tau)
            state.phase = "accel"
            return state
        elif d <= j.accel_distance + j.coast_distance:
            # Coast phase
            d_coast = d - j.accel_distance
            t_coast = d_coast / j.max_velocity
            t = j.earth_time_accel + t_coast
            tau = j.proper_time_accel + t_coast / j.max_gamma
            return RocketState(d, j.max_velocity, t, tau, j.max_gamma, "coast")
        else:
            # Deceleration phase
            d_from_dest = self.distance_ly - d
            # Mirror: this is like accelerating from rest for d_from_dest
            tau_mirror = (C / a) * math.acosh(1.0 + a * d_from_dest / C ** 2)
            mirror_state = rocket_state_from_tau(a, tau_mirror)
            # Time from arrival
            t_remaining = mirror_state.earth_time
            t = j.earth_time_total - t_remaining
            tau_decel_start = j.proper_time_accel + j.proper_time_coast
            tau = tau_decel_start + (j.proper_time_decel - mirror_state.proper_time)
            return RocketState(d, mirror_state.velocity, t, tau,
                               mirror_state.gamma, "decel")

    def _find_tau_for_earth_time(self, a: float, t_earth: float) -> float:
        """Numerically invert t(τ) = (c/a)·sinh(aτ/c) to find τ(t)."""
        # Use analytical inverse
        return (C / a) * math.asinh(a * t_earth / C)

    # ── Trajectory Sampling ─────────────────────────────────────────────

    def sample_trajectory(self, n_points: int = 100) -> List[RocketState]:
        """Sample *n_points* evenly (in Earth time) along the trajectory."""
        j = self.journey
        if j is None:
            return []

        states = []
        for i in range(n_points + 1):
            t = j.earth_time_total * i / n_points
            state = self.state_at_earth_time(t)
            if state:
                states.append(state)
        return states

    # ── Run (Interactive / Stepped) ─────────────────────────────────────

    def run_step(self, current_earth_time: float) -> Optional[RocketState]:
        """Advance to the next discrete event or specified time."""
        return self.state_at_earth_time(current_earth_time)

    # ── Relativistic Effects Report ─────────────────────────────────────

    def effects_report(self, state: RocketState) -> dict:
        """Compute all relativistic effects at a given state."""
        j = self.journey
        if j is None:
            return {}

        gamma = state.gamma
        v = state.velocity

        # Time dilation
        time_dil_ratio = gamma

        # Length contraction of remaining distance
        remaining = self.distance_ly - state.distance_ly
        remaining_contracted = remaining / gamma if gamma < float('inf') else 0.0

        # Doppler shift of destination starlight (approaching)
        doppler_blue = doppler_factor(v, approaching=True)
        doppler_red  = doppler_factor(v, approaching=False)

        # Communication delay
        comm_delay = communication_delay(remaining)

        # Gravitational time dilation at origin and destination
        grav_origin = 1.0
        grav_dest   = 1.0
        if self.origin_system:
            grav_origin = gravitational_time_dilation(
                self.origin_system.total_mass_kg,
                max(state.distance_ly, 0.001),
            )
        if self.dest_system:
            grav_dest = gravitational_time_dilation(
                self.dest_system.total_mass_kg,
                max(remaining, 0.001),
            )

        # Relativistic kinetic energy per kg
        ke_per_kg = (gamma - 1.0) * C * C

        # Apparent star positions (aberration)
        # For a star directly ahead: θ' = 0 → θ = 0 (no change straight ahead)
        # For a star at 90° in ship frame:
        import math as m
        theta_90_lab = m.atan2(1.0, gamma * (0 + v/C))

        return {
            'lorentz_factor': gamma,
            'time_dilation': time_dil_ratio,
            'speed_fraction_c': v / C,
            'remaining_distance_ly': remaining,
            'remaining_contracted_ly': remaining_contracted,
            'doppler_approaching': doppler_blue,
            'doppler_receding': doppler_red,
            'comm_delay_yr': comm_delay,
            'kinetic_energy_per_kg': ke_per_kg,
            'aberration_90deg_rad': theta_90_lab,
            'grav_dilation_origin': grav_origin,
            'grav_dilation_dest': grav_dest,
        }

    # ── Summary ─────────────────────────────────────────────────────────

    def print_plan(self):
        """Print the full mission plan."""
        j = self.journey
        if j is None:
            self.plan()
            j = self.journey

        o = self.origin_system
        d = self.dest_system

        print()
        print("=" * 68)
        print(f"  MISSION PLAN: {self.config.mission_name}")
        print("=" * 68)
        print(f"  Origin:       {o.name}  ({o.primary_star.spectral_type if o.primary_star else '?'})")
        print(f"  Destination:  {d.name}  ({d.primary_star.spectral_type if d.primary_star else '?'})")
        print(f"  Distance:     {format_distance(self.distance_ly)}")
        print(f"  Acceleration: {self.config.proper_accel:.3f} ly/yr^2  "
              f"({self.config.proper_accel / G_IN_LY:.1f} g)")
        print("-" * 68)
        print(f"  Max velocity:   {format_velocity(j.max_velocity)}")
        print(f"  Max Lorentz γ:  {j.max_gamma:.3f}")
        print()
        print(f"  ⏱  EARTH TIME:    {format_duration(j.earth_time_total)}")
        print(f"  ⏱  SHIP TIME:     {format_duration(j.proper_time_total)}")
        print(f"  ⏱  TIME DILATION:  ×{j.time_dilation_ratio:.2f}")
        print()
        print(f"  Accel: {format_distance(j.accel_distance):>10s}  "
              f"({format_duration(j.earth_time_accel)} Earth, "
              f"{format_duration(j.proper_time_accel)} ship)")
        if j.coast_distance > 0:
            print(f"  Coast: {format_distance(j.coast_distance):>10s}  "
                  f"({format_duration(j.earth_time_coast)} Earth, "
                  f"{format_duration(j.proper_time_coast)} ship)")
        print(f"  Decel: {format_distance(j.decel_distance):>10s}  "
              f"({format_duration(j.earth_time_decel)} Earth, "
              f"{format_duration(j.proper_time_decel)} ship)")
        print(f"  Average speed (Earth): {format_velocity(j.average_speed_earth)}")
        print("=" * 68)

    def print_events(self):
        """Print the mission event timeline."""
        if not self.events:
            self.plan()

        print()
        print("─" * 68)
        print("  MISSION TIMELINE")
        print("─" * 68)
        for evt in self.events:
            e_type = {
                'launch':     '🚀 LAUNCH',
                'end_accel':  '⚡ MAX Q',
                'midpoint':   '📍 MIDPOINT',
                'turnover':   '🔄 TURNOVER',
                'arrival':    '🏁 ARRIVAL',
            }.get(evt.event_type, evt.event_type.upper())

            print(f"  [{format_duration(evt.earth_time_yr):>12} Earth]  "
                  f"[{format_duration(evt.proper_time_yr):>12} Ship]  "
                  f"{e_type}")
            print(f"    {evt.description}")
        print("─" * 68)


# ── Communication Log Simulation ────────────────────────────────────────────

@dataclass
class Signal:
    """A message sent between Earth and the ship."""
    sender: str
    receiver: str
    sent_earth_time: float
    sent_ship_time: float
    content: str
    received_earth_time: float = 0.0
    received_ship_time: float = 0.0
    delay_yr: float = 0.0


def simulate_communications(
    simulator: MissionSimulator,
    n_messages: int = 5,
) -> List[Signal]:
    """Simulate two-way communication during the mission."""
    j = simulator.journey
    if j is None:
        simulator.plan()
        j = simulator.journey

    signals = []

    # Earth sends periodic messages
    for i in range(n_messages):
        t_earth_send = j.earth_time_total * (i + 1) / (n_messages + 1)
        state = simulator.state_at_earth_time(t_earth_send)
        if state is None:
            continue

        delay = communication_delay(simulator.distance_ly - state.distance_ly)
        t_earth_recv = t_earth_send + delay

        # Ship receives it
        # Ship proper time at reception
        recv_state = simulator.state_at_earth_time(t_earth_recv)
        t_ship_recv = recv_state.proper_time if recv_state else t_earth_recv

        signals.append(Signal(
            sender="Earth",
            receiver="Ship",
            sent_earth_time=t_earth_send,
            sent_ship_time=state.proper_time,
            content=f"Mission Control message #{i+1}",
            received_earth_time=t_earth_recv,
            received_ship_time=t_ship_recv,
            delay_yr=delay,
        ))

    # Ship sends responses
    for i in range(n_messages):
        t_ship_send = j.proper_time_total * (i + 1) / (n_messages + 1)

        # Find Earth time when ship proper time == t_ship_send
        # Need to invert: find state by proper time
        # For accel phase: t_earth = (c/a) sinh(aτ/c)
        state = _find_state_by_proper_time(simulator, t_ship_send)
        if state is None:
            continue

        delay = communication_delay(simulator.distance_ly - state.distance_ly)
        t_earth_recv = state.earth_time + delay

        signals.append(Signal(
            sender="Ship",
            receiver="Earth",
            sent_earth_time=state.earth_time,
            sent_ship_time=t_ship_send,
            content=f"Crew report #{i+1}",
            received_earth_time=t_earth_recv,
            received_ship_time=t_ship_send,
            delay_yr=delay,
        ))

    signals.sort(key=lambda s: s.sent_earth_time)
    return signals


def _find_state_by_proper_time(sim: MissionSimulator,
                                tau_target: float) -> Optional[RocketState]:
    """Find ship state at a given proper time."""
    j = sim.journey
    if j is None:
        return None

    a = sim.config.proper_accel
    tau_accel_end = j.proper_time_accel
    tau_coast_end = j.proper_time_accel + j.proper_time_coast

    if tau_target <= 0:
        return RocketState(0.0, 0.0, 0.0, 0.0, 1.0, "idle")
    if tau_target >= j.proper_time_total:
        return RocketState(sim.distance_ly, 0.0, j.earth_time_total,
                           j.proper_time_total, 1.0, "idle")

    if tau_target <= tau_accel_end:
        # Acceleration phase
        state = rocket_state_from_tau(a, tau_target)
        state.phase = "accel"
        return state

    elif tau_target <= tau_coast_end:
        # Coast phase
        tau_coast = tau_target - tau_accel_end
        v = j.max_velocity
        gamma = j.max_gamma
        t_coast = tau_coast * gamma
        x = j.accel_distance + v * t_coast
        t = j.earth_time_accel + t_coast
        return RocketState(x, v, t, tau_target, gamma, "coast")

    else:
        # Deceleration phase
        tau_into_decel = tau_target - tau_coast_end
        tau_rev = j.proper_time_decel - tau_into_decel
        if tau_rev <= 0:
            return RocketState(sim.distance_ly, 0.0, j.earth_time_total,
                               j.proper_time_total, 1.0, "idle")

        mirror_state = rocket_state_from_tau(a, tau_rev)
        x = sim.distance_ly - mirror_state.distance_ly
        v = mirror_state.velocity
        gamma = mirror_state.gamma
        # Earth time: work backwards from total
        t_mirror = mirror_state.earth_time
        t = j.earth_time_total - t_mirror
        return RocketState(x, v, t, tau_target, gamma, "decel")
