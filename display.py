"""
Terminal Visualization
======================
ASCII-art star maps, progress bars, stats panels, and animated
journey display using ANSI escape codes for colour.
"""

from __future__ import annotations
import math
import sys
import time as time_module
from typing import List, Optional

from physics import (C, G_IN_LY, lorentz_from_v,
                     format_duration, format_velocity, format_distance,
                     doppler_factor, length_seen_by_ship, communication_delay)
from simulation import MissionSimulator, MissionEvent, RocketState


# ── ANSI Colours ────────────────────────────────────────────────────────────

class Ansi:
    RESET      = "\033[0m"
    BOLD       = "\033[1m"
    DIM        = "\033[2m"
    ITALIC     = "\033[3m"
    UNDERLINE  = "\033[4m"

    # Foreground
    BLACK   = "\033[30m"
    RED     = "\033[31m"
    GREEN   = "\033[32m"
    YELLOW  = "\033[33m"
    BLUE    = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN    = "\033[36m"
    WHITE   = "\033[37m"
    ORANGE  = "\033[38;5;208m"

    # Bright
    BRED     = "\033[91m"
    BGREEN   = "\033[92m"
    BYELLOW  = "\033[93m"
    BBLUE    = "\033[94m"
    BMAGENTA = "\033[95m"
    BCYAN    = "\033[96m"
    BWHITE   = "\033[97m"

    # Backgrounds
    BG_BLACK   = "\033[40m"
    BG_RED     = "\033[41m"
    BG_GREEN   = "\033[42m"
    BG_YELLOW  = "\033[43m"
    BG_BLUE    = "\033[44m"
    BG_MAGENTA = "\033[45m"
    BG_CYAN    = "\033[46m"
    BG_WHITE   = "\033[47m"

    # Cursor
    @staticmethod
    def up(n=1):    return f"\033[{n}A"
    @staticmethod
    def down(n=1):  return f"\033[{n}B"
    @staticmethod
    def right(n=1): return f"\033[{n}C"
    @staticmethod
    def left(n=1):  return f"\033[{n}D"
    @staticmethod
    def save():     return "\033[s"
    @staticmethod
    def restore():  return "\033[u"
    CLEAR_LINE = "\033[2K"
    CLEAR_SCREEN = "\033[2J"
    HOME = "\033[H"
    HIDE_CURSOR = "\033[?25l"
    SHOW_CURSOR = "\033[?25h"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _bar(fraction: float, width: int = 30, filled: str = "█",
         unfilled: str = "░") -> str:
    """Create a text progress bar."""
    n_filled = max(0, min(width, int(fraction * width)))
    return filled * n_filled + unfilled * (width - n_filled)


def _pad_right(s: str, width: int) -> str:
    return s + " " * max(0, width - len(s))


def _center(s: str, width: int) -> str:
    pad = max(0, width - len(s))
    left = pad // 2
    return " " * left + s + " " * (pad - left)


# ── Banner ──────────────────────────────────────────────────────────────────

BANNER = r"""
{cyan}     ╔══════════════════════════════════════════════════════════════╗
     ║   {yellow}✨  RELATIVISTIC SPACE EXPLORER  ✨{cyan}                   ║
     ║   {dim}"Space is big. Really big. You just won't believe how     {cyan}║
     ║   {dim} vastly, hugely, mind-bogglingly big it is." — D. Adams   {cyan}║
     ║   {white}  ⏱  Time Dilation  •  📏 Length Contraction           {cyan}║
     ║   {white}  🌟 Doppler Shift  •  🕳  Gravitational Effects       {cyan}║
     ╚══════════════════════════════════════════════════════════════╝{reset}
""".format(
    cyan=Ansi.CYAN, yellow=Ansi.BYELLOW, dim=Ansi.DIM,
    white=Ansi.WHITE, reset=Ansi.RESET,
)


def print_banner():
    print(BANNER)


# ── Star Map ────────────────────────────────────────────────────────────────

def print_star_map(sim: MissionSimulator, state: Optional[RocketState] = None,
                   width: int = 64):
    """Print an ASCII star map showing the journey."""
    j = sim.journey
    if j is None:
        sim.plan()
        j = sim.journey

    distance = sim.distance_ly
    progress = (state.distance_ly / distance) if state else 0.0
    remaining = distance - (state.distance_ly if state else 0.0)

    print()
    print(f"  {Ansi.BOLD}🌟  STAR MAP  —  {sim.config.origin}  →  {sim.config.destination}{Ansi.RESET}")
    print()

    # Scale
    # Map width in characters for the travel lane
    map_width = width - 10
    origin_pos = 5
    dest_pos = origin_pos + map_width

    # Origin label
    print(f"  {Ansi.GREEN}●{Ansi.RESET} {sim.config.origin:<18s}"
          f"{' ' * (map_width - 22)}"
          f"{sim.config.destination:>18s} {Ansi.BBLUE}●{Ansi.RESET}")

    # Track
    ship_col = origin_pos + int(progress * map_width)
    track = ["─"] * (map_width + 1)
    for i in range(0, map_width + 1, map_width // 4 if map_width >= 4 else 1):
        if i != ship_col - origin_pos:
            track[i] = "┼" if i > 0 and i < map_width else track[i]

    # Mark key waypoints
    if j.earth_time_accel > 0:
        accel_end_frac = j.accel_distance / distance
        accel_col = int(accel_end_frac * map_width)
        if 0 <= accel_col <= map_width:
            track[accel_col] = f"{Ansi.YELLOW}◈{Ansi.RESET}"

    if j.earth_time_coast > 0 and j.coast_distance > 0:
        coast_end_frac = (j.accel_distance + j.coast_distance) / distance
        coast_col = int(coast_end_frac * map_width)
        if 0 <= coast_col <= map_width:
            track[coast_col] = f"{Ansi.YELLOW}◈{Ansi.RESET}"

    # Ship marker
    if state and progress > 0 and progress < 1.0:
        if isinstance(track[ship_col - origin_pos], str) and Ansi.YELLOW in str(track[ship_col - origin_pos]):
            track[ship_col - origin_pos] = f"{Ansi.BRED}◆{Ansi.RESET}"
        else:
            track[ship_col - origin_pos] = f"{Ansi.BRED}▶{Ansi.RESET}"
    elif progress <= 0:
        track[0] = f"{Ansi.BRED}▶{Ansi.RESET}"
    else:
        track[map_width] = f"{Ansi.BRED}▶{Ansi.RESET}"

    # Print track
    track_str = "".join(str(t) for t in track)
    print(f"  {Ansi.GREEN}○{Ansi.RESET}{track_str}{Ansi.BBLUE}○{Ansi.RESET}")

    # Progress bar
    bar = _bar(progress, width=map_width + 2, filled=f"{Ansi.BG_GREEN} {Ansi.RESET}",
               unfilled=f"{Ansi.DIM}·{Ansi.RESET}")
    print(f"   {bar}  {progress * 100:.1f}%")

    # Distance annotations
    print(f"  Travelled: {format_distance(state.distance_ly if state else 0):>10s}"
          f"    Remaining: {format_distance(remaining):>10s}"
          f"    Total: {format_distance(distance):>10s}")


# ── Status Panel ────────────────────────────────────────────────────────────

def print_status_panel(sim: MissionSimulator, state: RocketState, width: int = 50):
    """Print a detailed relativistic status panel."""
    effects = sim.effects_report(state)
    j = sim.journey
    if j is None:
        return

    # Choose colour for time dilation severity
    if effects['lorentz_factor'] < 1.5:
        dil_color = Ansi.GREEN
    elif effects['lorentz_factor'] < 10:
        dil_color = Ansi.YELLOW
    else:
        dil_color = Ansi.RED

    # Doppler colours
    doppler_color = Ansi.BBLUE if effects['doppler_approaching'] > 2 else Ansi.WHITE

    print()
    print(f"  {Ansi.BOLD}╔{'═' * (width - 2)}╗{Ansi.RESET}")
    print(f"  {Ansi.BOLD}║{Ansi.RESET} {Ansi.BYELLOW}MISSION STATUS{Ansi.RESET}" + " " * (width - 17) + f"{Ansi.BOLD}║{Ansi.RESET}")
    print(f"  {Ansi.BOLD}╠{'═' * (width - 2)}╣{Ansi.RESET}")

    rows = [
        ("Phase", f"{state.phase.upper()}", Ansi.CYAN),
        ("Ship Time", format_duration(state.proper_time), Ansi.WHITE),
        ("Earth Time", format_duration(state.earth_time), Ansi.WHITE),
        ("Time Dilation γ", f"{effects['lorentz_factor']:.4f}", dil_color),
        ("Speed", format_velocity(state.velocity), Ansi.BYELLOW),
        ("Distance", format_distance(state.distance_ly), Ansi.WHITE),
        ("Remaining", format_distance(effects['remaining_distance_ly']), Ansi.WHITE),
        ("Contracted Dist.", format_distance(effects['remaining_contracted_ly']), Ansi.DIM),
        ("Doppler (ahead)", f"×{effects['doppler_approaching']:.3f}", doppler_color),
        ("Doppler (behind)", f"×{effects['doppler_receding']:.3f}", Ansi.DIM),
        ("Comm Delay", format_duration(effects['comm_delay_yr']), Ansi.MAGENTA),
        ("KE / kg", f"{effects['kinetic_energy_per_kg']:.2e} J/kg", Ansi.RED),
    ]

    for label, value, color in rows:
        print(f"  {Ansi.BOLD}║{Ansi.RESET} {label:<18s} │ {color}{value:>28s}{Ansi.RESET} {Ansi.BOLD}║{Ansi.RESET}")

    print(f"  {Ansi.BOLD}╚{'═' * (width - 2)}╝{Ansi.RESET}")


# ── Comparison Panel (Earth vs Ship) ───────────────────────────────────────

def print_comparison(sim: MissionSimulator):
    """Side-by-side comparison of Earth vs Ship perspectives."""
    j = sim.journey
    if j is None:
        return

    print()
    print(f"  {Ansi.BOLD}╔{'═' * 30}╤{'═' * 30}╗{Ansi.RESET}")
    print(f"  {Ansi.BOLD}║{Ansi.RESET} {Ansi.GREEN}{_center('EARTH FRAME', 28)}{Ansi.RESET} {Ansi.BOLD}│{Ansi.RESET} "
          f"{Ansi.BBLUE}{_center('SHIP FRAME', 28)}{Ansi.RESET} {Ansi.BOLD}║{Ansi.RESET}")
    print(f"  {Ansi.BOLD}╟{'─' * 30}┼{'─' * 30}╢{Ansi.RESET}")

    comparisons = [
        ("Journey Time", format_duration(j.earth_time_total),
         format_duration(j.proper_time_total)),
        ("Max Speed", format_velocity(j.max_velocity),
         format_velocity(j.max_velocity)),  # same in both frames
        ("Distance (proper)", format_distance(j.total_distance_ly),
         format_distance(length_seen_by_ship(j.total_distance_ly, j.max_velocity))),
        ("Time Dilation", "×1.000 (reference)",
         f"×{j.time_dilation_ratio:.3f} slower"),
    ]

    for label, earth_val, ship_val in comparisons:
        print(f"  {Ansi.BOLD}║{Ansi.RESET} {label:<14s} {Ansi.GREEN}{earth_val:>14s}{Ansi.RESET} "
              f"{Ansi.BOLD}│{Ansi.RESET} {Ansi.BBLUE}{ship_val:>14s}{Ansi.RESET} {Ansi.BOLD}║{Ansi.RESET}")

    print(f"  {Ansi.BOLD}╚{'═' * 30}╧{'═' * 30}╝{Ansi.RESET}")


# ── Communication Log ───────────────────────────────────────────────────────

def print_comm_log(signals, max_show: int = 8):
    """Print the communication log."""
    print()
    print(f"  {Ansi.BOLD}📡  COMMUNICATION LOG{Ansi.RESET}")
    print(f"  {'─' * 60}")
    for sig in signals[:max_show]:
        arrow = "→" if sig.sender == "Earth" else "←"
        color = Ansi.GREEN if sig.sender == "Earth" else Ansi.BBLUE
        print(f"  {color}[{format_duration(sig.sent_earth_time):>10s}]{Ansi.RESET} "
              f"{sig.sender:>5s} {arrow} {sig.receiver:<5s}  "
              f"delay: {format_duration(sig.delay_yr):>8s}  "
              f"\"{sig.content}\"")
    if len(signals) > max_show:
        print(f"  {Ansi.DIM}... and {len(signals) - max_show} more messages{Ansi.RESET}")
    print()


# ── Animated Journey ────────────────────────────────────────────────────────

def animate_journey(sim: MissionSimulator, speed: float = 1.0,
                    steps: int = 40, fps: float = 4.0):
    """Run an animated display of the journey.

    Parameters
    ----------
    speed : float
        Simulation speed multiplier. 1.0 = real-time-ish (journey plays
        in ~10-20 seconds regardless of actual duration).
    steps : int
        Number of animation frames.
    fps : float
        Frames per second of animation.
    """
    j = sim.journey
    if j is None:
        sim.plan()
        j = sim.journey

    frame_delay = 1.0 / fps
    total_anim_time = steps * frame_delay

    print(Ansi.HIDE_CURSOR)
    print(Ansi.CLEAR_SCREEN + Ansi.HOME)

    try:
        for step in range(steps + 1):
            fraction = step / steps
            t_earth = j.earth_time_total * fraction
            state = sim.state_at_earth_time(t_earth)

            if state is None:
                continue

            # Clear and redraw
            print(Ansi.HOME)

            print_banner()
            print()

            # Title
            anim_pct = step / steps * 100
            bar_frames = _bar(fraction, width=20, filled=f"{Ansi.BG_CYAN} {Ansi.RESET}",
                              unfilled="·")
            print(f"  {Ansi.BYELLOW}JOURNEY IN PROGRESS{Ansi.RESET}  {bar_frames}  "
                  f"{anim_pct:.0f}%")

            print_star_map(sim, state)
            print_status_panel(sim, state)

            # Event check
            for evt in sim.events:
                if evt.earth_time_yr > 0 and abs(fraction * j.earth_time_total - evt.earth_time_yr) < j.earth_time_total / steps * 2:
                    event_indicator = {
                        'launch': '🚀', 'end_accel': '⚡', 'turnover': '🔄',
                        'midpoint': '📍', 'arrival': '🏁',
                    }.get(evt.event_type, '•')
                    print(f"\n  {Ansi.BYELLOW}{event_indicator}  {evt.description}{Ansi.RESET}")

            print(f"\n  {Ansi.DIM}Animating at {speed:.0f}× speed  |  "
                  f"Press Ctrl+C to stop{Ansi.RESET}")

            sys.stdout.flush()
            time_module.sleep(frame_delay / speed)

    except KeyboardInterrupt:
        pass
    finally:
        print(Ansi.SHOW_CURSOR)
        print()

    # Final summary
    print(Ansi.CLEAR_SCREEN + Ansi.HOME)
    print_banner()
    print()
    print(f"  {Ansi.BGREEN}✅  JOURNEY COMPLETE!{Ansi.RESET}")
    print()
    sim.print_plan()
    print_comparison(sim)


# ── Quick Summary ───────────────────────────────────────────────────────────

def print_quick_summary(sim: MissionSimulator):
    """One-line summary of a planned mission."""
    j = sim.journey
    if j is None:
        sim.plan()
        j = sim.journey

    gamma_str = f"γ={j.max_gamma:.1f}" if j.max_gamma < 100 else f"γ={j.max_gamma:.1e}"
    print(f"  {Ansi.CYAN}{sim.config.origin}{Ansi.RESET} → "
          f"{Ansi.CYAN}{sim.config.destination}{Ansi.RESET}  "
          f"({format_distance(sim.distance_ly)})  |  "
          f"Earth: {Ansi.GREEN}{format_duration(j.earth_time_total)}{Ansi.RESET}  |  "
          f"Ship: {Ansi.BBLUE}{format_duration(j.proper_time_total)}{Ansi.RESET}  |  "
          f"v_max: {format_velocity(j.max_velocity)}  |  "
          f"{gamma_str}")


# ── Interactive Explorer ────────────────────────────────────────────────────

def print_relativity_tutorial():
    """Print educational content about relativistic effects."""
    print(f"""
  {Ansi.BOLD}📚  RELATIVISTIC EFFECTS IN SPACE TRAVEL{Ansi.RESET}

  {Ansi.BYELLOW}1. TIME DILATION (Special Relativity){Ansi.RESET}
     A clock moving at velocity v runs slower by factor γ = 1/√(1−v²/c²).
     At 0.9c, γ = 2.29 — every year on the ship is 2.29 years on Earth.
     At 0.999c, γ = 22.4 — a 10-year journey (ship time) spans 224 Earth years!

  {Ansi.BYELLOW}2. LENGTH CONTRACTION{Ansi.RESET}
     The crew sees the universe contracted along the direction of motion.
     A 4.37 ly distance to Alpha Centauri shrinks to 1.91 ly at 0.9c.
     At 0.999c, it shrinks to just 0.20 ly!

  {Ansi.BYELLOW}3. RELATIVISTIC DOPPLER EFFECT{Ansi.RESET}
     Light from stars ahead is blue-shifted by factor √((1+β)/(1−β)).
     At 0.9c, visible light from ahead shifts into the ultraviolet.
     Stars behind shift into the infrared — the universe looks very different!

  {Ansi.BYELLOW}4. GRAVITATIONAL TIME DILATION (General Relativity){Ansi.RESET}
     Time runs slower near massive objects. Near a black hole's event
     horizon, time nearly stops for a distant observer.
     At 1.5× the Schwarzschild radius, γ_grav ≈ 1.73.

  {Ansi.BYELLOW}5. RELATIVISTIC ROCKET{Ansi.RESET}
     With constant 1g proper acceleration, you can reach:
     • Alpha Centauri (4.37 ly) in ~3.6 years ship time (6.0 Earth years)
     • Vega (25 ly) in ~6.8 years ship time (27 Earth years)
     • Galactic centre (~26,670 ly) in ~20 years ship time!
       (But ~26,670 Earth years would pass — everyone you know is long gone.)

  {Ansi.DIM}All calculations in this simulator use the full relativistic equations.{Ansi.RESET}
""")
