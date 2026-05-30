#!/usr/bin/env python3
"""
Relativistic Space Explorer
============================
An interactive space exploration simulator that accounts for
special and general relativistic effects.

Usage:
    python main.py              Interactive mode
    python main.py --help       Show options
    python main.py --demo       Run a quick demo
    python main.py --tutorial   Show relativity tutorial
"""

from __future__ import annotations
import sys
import argparse
from typing import Optional

# Ensure UTF-8 output on Windows terminals
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from physics import G_IN_LY, format_duration, format_distance, format_velocity
from universe import Universe, build_catalog
from simulation import (
    MissionConfig, MissionSimulator, simulate_communications,
)
from display import (
    Ansi, print_banner, print_star_map, print_status_panel,
    print_comparison, print_comm_log, print_quick_summary,
    print_relativity_tutorial, animate_journey,
)


# ── Globals ─────────────────────────────────────────────────────────────────

universe = Universe()


# ── Menu Helpers ────────────────────────────────────────────────────────────

def clear_screen():
    print(Ansi.CLEAR_SCREEN + Ansi.HOME, end="")


def press_enter():
    input(f"\n  {Ansi.DIM}Press Enter to continue...{Ansi.RESET}")


def pick_destination(prompt: str = "Select destination") -> Optional[str]:
    """Let the user pick a star system from the catalog."""
    systems = universe.list_all_sorted()

    print(f"\n  {Ansi.BOLD}{prompt}{Ansi.RESET}")
    print(f"  {'─' * 50}")

    for i, sys_obj in enumerate(systems):
        marker = "🏠" if sys_obj.name == "Sol" else "  "
        dist = format_distance(sys_obj.distance_from_sol)
        star_info = ""
        if sys_obj.primary_star:
            star_info = f"({sys_obj.primary_star.spectral_type}, "
            star_info += f"{sys_obj.primary_star.mass_solar:.1f} M☉)"
        planets = f"  [{len(sys_obj.planets)} planets]" if sys_obj.planets else ""
        exotics = ""
        if sys_obj.exotic_objects:
            from universe import BlackHole, NeutronStar
            bh = sum(1 for o in sys_obj.exotic_objects if isinstance(o, BlackHole))
            ns = sum(1 for o in sys_obj.exotic_objects if isinstance(o, NeutronStar))
            parts = []
            if bh: parts.append(f"{bh} BH")
            if ns: parts.append(f"{ns} NS")
            exotics = f"  ⚡[{', '.join(parts)}]"

        print(f"  {Ansi.BOLD}{i+1:>3d}.{Ansi.RESET} {marker} "
              f"{Ansi.CYAN}{sys_obj.name:<22s}{Ansi.RESET} "
              f"@ {Ansi.YELLOW}{dist:>10s}{Ansi.RESET}  "
              f"{Ansi.DIM}{star_info}{planets}{exotics}{Ansi.RESET}")

    print(f"  {'─' * 50}")
    print(f"  {Ansi.BOLD}  0.{Ansi.RESET} Cancel")

    while True:
        try:
            choice = input(f"\n  {Ansi.BYELLOW}Enter number (1-{len(systems)}):{Ansi.RESET} ")
            if choice == '0':
                return None
            idx = int(choice) - 1
            if 0 <= idx < len(systems):
                return systems[idx].name
        except (ValueError, IndexError):
            pass
        print(f"  {Ansi.RED}Invalid choice, please try again.{Ansi.RESET}")


def configure_mission(origin: str, destination: str) -> Optional[MissionConfig]:
    """Interactive mission configuration."""
    sys_dest = universe.get(destination)
    distance = universe.distance_between(origin, destination)

    if distance is None:
        print(f"  {Ansi.RED}Cannot compute distance!{Ansi.RESET}")
        return None

    print()
    print(f"  {Ansi.BOLD}⚙  MISSION CONFIGURATION{Ansi.RESET}")
    print(f"  {'─' * 50}")
    print(f"  Origin:      {Ansi.CYAN}{origin}{Ansi.RESET}")
    print(f"  Destination: {Ansi.CYAN}{destination}{Ansi.RESET}")
    print(f"  Distance:    {Ansi.YELLOW}{format_distance(distance)}{Ansi.RESET}")
    print()

    # Acceleration
    print(f"  {Ansi.BOLD}Proper Acceleration{Ansi.RESET}")
    print(f"    1g  = {G_IN_LY:.3f} ly/yr²  (comfortable, Earth-like gravity)")
    print(f"    2g  = {2*G_IN_LY:.3f} ly/yr²  (heavy but survivable)")
    print(f"    5g  = {5*G_IN_LY:.3f} ly/yr²  (extreme, requires liquid breathing)")
    print(f"    10g = {10*G_IN_LY:.3f} ly/yr² (near limit of human tolerance)")
    print()

    while True:
        g_choice = input(f"  Acceleration in g [{Ansi.DIM}1.0{Ansi.RESET}]: ").strip()
        if g_choice == "":
            accel = G_IN_LY
            break
        try:
            g_val = float(g_choice)
            if 0.01 <= g_val <= 100:
                accel = g_val * G_IN_LY
                break
            else:
                print(f"  {Ansi.RED}Please enter a value between 0.01 and 100.{Ansi.RESET}")
        except ValueError:
            print(f"  {Ansi.RED}Invalid number.{Ansi.RESET}")

    # Journey type
    print()
    print(f"  {Ansi.BOLD}Journey Profile{Ansi.RESET}")
    print(f"    1. Standard (accelerate half-way, decelerate half-way)")
    print(f"    2. Sprint (accelerate 25%, coast 50%, decelerate 25%)")
    print(f"    3. Express (accelerate 10%, coast 80%, decelerate 10%)")
    print(f"    4. Custom")

    while True:
        profile = input(f"  Profile [{Ansi.DIM}1{Ansi.RESET}]: ").strip()
        if profile == "" or profile == "1":
            accel_frac, coast_frac = 0.5, 0.0
            break
        elif profile == "2":
            accel_frac, coast_frac = 0.25, 0.5
            break
        elif profile == "3":
            accel_frac, coast_frac = 0.1, 0.8
            break
        elif profile == "4":
            try:
                accel_frac = float(input("    Acceleration fraction (0-1): "))
                coast_frac = float(input("    Coast fraction (0-1): "))
                if accel_frac + coast_frac <= 1.0:
                    break
                else:
                    print(f"  {Ansi.RED}Fractions must sum to ≤ 1.0{Ansi.RESET}")
            except ValueError:
                print(f"  {Ansi.RED}Invalid number.{Ansi.RESET}")
        else:
            print(f"  {Ansi.RED}Invalid choice.{Ansi.RESET}")

    # Mission name
    print()
    name = input(f"  Mission name [{Ansi.DIM}{origin} → {destination}{Ansi.RESET}]: ").strip()
    if not name:
        name = f"{origin} → {destination}"

    # Crew
    crew_str = input(f"  Crew size [{Ansi.DIM}4{Ansi.RESET}]: ").strip()
    crew = int(crew_str) if crew_str else 4

    # Ship mass
    mass_str = input(f"  Ship mass (tonnes) [{Ansi.DIM}1000{Ansi.RESET}]: ").strip()
    mass = float(mass_str) if mass_str else 1000.0

    return MissionConfig(
        origin=origin,
        destination=destination,
        proper_accel=accel,
        accel_fraction=accel_frac,
        coast_fraction=coast_frac,
        mission_name=name,
        crew_size=crew,
        ship_mass_tonnes=mass,
    )


# ── Interactive Menus ───────────────────────────────────────────────────────

def menu_plan_mission():
    """Plan a new mission interactively."""
    # Pick origin
    print()
    use_sol = input(f"  Start from Earth/Sol? [{Ansi.DIM}Y/n{Ansi.RESET}]: ").strip().lower()
    if use_sol in ('n', 'no'):
        origin = pick_destination("Select origin system")
        if origin is None:
            return
    else:
        origin = "Sol"

    # Pick destination
    dest = pick_destination("Select destination system")
    if dest is None:
        return
    if dest == origin:
        print(f"  {Ansi.RED}Origin and destination cannot be the same!{Ansi.RESET}")
        return

    # Configure
    config = configure_mission(origin, dest)
    if config is None:
        return

    # Create simulator and plan
    sim = MissionSimulator(config, universe)
    sim.plan()

    # Display results
    clear_screen()
    print_banner()
    sim.print_plan()
    print_comparison(sim)
    sim.print_events()

    # Options after plan
    menu_post_plan(sim)


def menu_post_plan(sim: MissionSimulator):
    """Menu shown after a mission plan is generated."""
    while True:
        print()
        print(f"  {Ansi.BOLD}What next?{Ansi.RESET}")
        print(f"    1. Animate the journey")
        print(f"    2. Simulate communications")
        print(f"    3. View detailed effects at specific point")
        print(f"    4. Print journey data")
        print(f"    0. Return to main menu")

        choice = input(f"\n  Choice [{Ansi.DIM}1{Ansi.RESET}]: ").strip()
        if choice == "" or choice == "1":
            animate_journey(sim, speed=2.0, steps=50, fps=6)
        elif choice == "2":
            signals = simulate_communications(sim, n_messages=6)
            print_comm_log(signals)
            press_enter()
        elif choice == "3":
            _menu_effects_inspection(sim)
        elif choice == "4":
            _print_journey_data(sim)
        elif choice == "0":
            break


def _menu_effects_inspection(sim: MissionSimulator):
    """Let user inspect relativistic effects at arbitrary points."""
    j = sim.journey
    if j is None:
        return

    print()
    print(f"  {Ansi.BOLD}🔍  EFFECTS INSPECTOR{Ansi.RESET}")
    print(f"  Total journey (Earth time): {format_duration(j.earth_time_total)}")
    print(f"  Enter a time as fraction of journey (0-1) or Earth years.")

    while True:
        inp = input(f"\n  Fraction or years [{Ansi.DIM}0.5{Ansi.RESET}]: ").strip()
        if inp == "":
            fraction = 0.5
        elif inp.lower() in ('q', 'quit', 'exit', '0'):
            break
        else:
            try:
                val = float(inp)
                if 0 <= val <= 1:
                    fraction = val
                else:
                    # Interpret as Earth years
                    fraction = val / j.earth_time_total
            except ValueError:
                print(f"  {Ansi.RED}Invalid input.{Ansi.RESET}")
                continue

        t = j.earth_time_total * fraction
        state = sim.state_at_earth_time(t)
        if state:
            print()
            print_star_map(sim, state)
            print_status_panel(sim, state)


def _print_journey_data(sim: MissionSimulator):
    """Print a table of journey data points."""
    j = sim.journey
    if j is None:
        return

    print()
    print(f"  {Ansi.BOLD}📊  JOURNEY DATA TABLE{Ansi.RESET}")
    print(f"  {'─' * 78}")
    print(f"  {'Earth Time':>10s}  {'Ship Time':>10s}  {'Speed':>12s}  "
          f"{'Distance':>10s}  {'γ':>8s}  Phase")
    print(f"  {'─' * 78}")

    for i in range(21):
        frac = i / 20.0
        t = j.earth_time_total * frac
        state = sim.state_at_earth_time(t)
        if state:
            print(f"  {format_duration(state.earth_time):>10s}  "
                  f"{format_duration(state.proper_time):>10s}  "
                  f"{format_velocity(state.velocity):>12s}  "
                  f"{format_distance(state.distance_ly):>10s}  "
                  f"{state.gamma:>8.3f}  {state.phase}")

    print(f"  {'─' * 78}")
    press_enter()


def menu_quick_mission():
    """Quick mission with presets."""
    print()
    print(f"  {Ansi.BOLD}🚀  QUICK MISSION — Presets{Ansi.RESET}")
    print()
    print(f"    1. Earth → Alpha Centauri  (4.37 ly)  at 1g")
    print(f"    2. Earth → Barnard's Star   (5.96 ly)  at 1g")
    print(f"    3. Earth → Sirius           (8.60 ly)  at 1g")
    print(f"    4. Earth → Tau Ceti         (11.9 ly)  at 1g")
    print(f"    5. Earth → Vega             (25.0 ly)  at 1g")
    print(f"    6. Earth → TRAPPIST-1       (40.7 ly)  at 1g")
    print(f"    7. Earth → Betelgeuse       (548 ly)   at 1g")
    print(f"    8. Earth → Sagittarius A*   (26,670 ly) at 1g")
    print(f"    9. Earth → Alpha Centauri   (4.37 ly)  at 0.1g (low thrust)")
    print(f"   10. Earth → Alpha Centauri   (4.37 ly)  at 5g  (extreme)")
    print(f"    0. Cancel")

    presets = {
        '1':  ("Sol", "Alpha Centauri",  G_IN_LY),
        '2':  ("Sol", "Barnard's Star",   G_IN_LY),
        '3':  ("Sol", "Sirius",           G_IN_LY),
        '4':  ("Sol", "Tau Ceti",         G_IN_LY),
        '5':  ("Sol", "Vega",             G_IN_LY),
        '6':  ("Sol", "TRAPPIST-1",       G_IN_LY),
        '7':  ("Sol", "Betelgeuse",       G_IN_LY),
        '8':  ("Sol", "Sagittarius A*",   G_IN_LY),
        '9':  ("Sol", "Alpha Centauri",   0.1 * G_IN_LY),
        '10': ("Sol", "Alpha Centauri",   5.0 * G_IN_LY),
    }

    choice = input(f"\n  Pick a preset [{Ansi.DIM}1{Ansi.RESET}]: ").strip()
    if choice == "":
        choice = "1"
    if choice == "0":
        return
    if choice not in presets:
        print(f"  {Ansi.RED}Invalid choice.{Ansi.RESET}")
        return

    origin, dest, accel = presets[choice]
    config = MissionConfig(
        origin=origin, destination=dest,
        proper_accel=accel,
        mission_name=f"{origin} → {dest}",
    )
    sim = MissionSimulator(config, universe)
    sim.plan()

    clear_screen()
    print_banner()
    sim.print_plan()
    print_comparison(sim)

    menu_post_plan(sim)


def menu_explore_universe():
    """Browse the star catalog."""
    systems = universe.list_all_sorted()

    print()
    print(f"  {Ansi.BOLD}🌟  STAR CATALOG{Ansi.RESET}")
    print(f"  {'─' * 60}")

    for i, sys_obj in enumerate(systems):
        dist = format_distance(sys_obj.distance_from_sol)
        print(f"  {Ansi.BOLD}{i+1:>3d}.{Ansi.RESET} "
              f"{Ansi.CYAN}{sys_obj.name:<22s}{Ansi.RESET} "
              f"@ {Ansi.YELLOW}{dist:>10s}{Ansi.RESET}")

    print()
    print(f"  Enter a number to see details, or 0 to return.")
    while True:
        choice = input(f"\n  System #: ").strip()
        if choice == "0":
            break
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(systems):
                print()
                print(systems[idx].summary())
                # Also show what a mission to this system would look like
                if systems[idx].name != "Sol":
                    d = universe.distance_between("Sol", systems[idx].name)
                    if d:
                        config = MissionConfig("Sol", systems[idx].name)
                        sim = MissionSimulator(config, universe)
                        try:
                            sim.plan()
                            print()
                            print_quick_summary(sim)
                        except Exception:
                            pass
                print()
        except (ValueError, IndexError):
            print(f"  {Ansi.RED}Invalid.{Ansi.RESET}")


def menu_compare_accelerations():
    """Compare journey times with different accelerations."""
    dest = pick_destination("Select destination to compare")
    if dest is None:
        return

    distance = universe.distance_between("Sol", dest)
    if distance is None:
        return

    print()
    print(f"  {Ansi.BOLD}📊  ACCELERATION COMPARISON: Sol → {dest}{Ansi.RESET}")
    print(f"  Distance: {format_distance(distance)}")
    print(f"  {'─' * 72}")
    print(f"  {'Accel':>10s}  {'Earth Time':>14s}  {'Ship Time':>14s}  "
          f"{'Max Speed':>14s}  {'Max γ':>8s}")
    print(f"  {'─' * 72}")

    for g in [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]:
        config = MissionConfig(
            origin="Sol", destination=dest,
            proper_accel=g * G_IN_LY,
        )
        sim = MissionSimulator(config, universe)
        sim.plan()
        j = sim.journey
        if j:
            print(f"  {g:>8.2f}g  {format_duration(j.earth_time_total):>14s}  "
                  f"{format_duration(j.proper_time_total):>14s}  "
                  f"{format_velocity(j.max_velocity):>14s}  "
                  f"{j.max_gamma:>8.2f}")

    print(f"  {'─' * 72}")
    press_enter()


# ── Main Menu ───────────────────────────────────────────────────────────────

def main_menu():
    """Main interactive menu loop."""
    while True:
        clear_screen()
        print_banner()

        print(f"""
  {Ansi.BOLD}MAIN MENU{Ansi.RESET}

    1. {Ansi.BYELLOW}Plan a Mission{Ansi.RESET}        — Choose origin, destination & configure ship
    2. {Ansi.BGREEN}Quick Mission{Ansi.RESET}          — Pre-configured missions to nearby stars
    3. {Ansi.BBLUE}Explore Universe{Ansi.RESET}        — Browse the star catalog
    4. {Ansi.BMAGENTA}Compare Accelerations{Ansi.RESET}  — See how g-force affects journey time
    5. {Ansi.BCYAN}Relativity Tutorial{Ansi.RESET}     — Learn about relativistic effects
    0. {Ansi.RED}Exit{Ansi.RESET}
""")

        choice = input(f"  {Ansi.BYELLOW}Select option{Ansi.RESET} [{Ansi.DIM}1{Ansi.RESET}]: ").strip()

        if choice == "" or choice == "1":
            menu_plan_mission()
        elif choice == "2":
            menu_quick_mission()
        elif choice == "3":
            menu_explore_universe()
        elif choice == "4":
            menu_compare_accelerations()
        elif choice == "5":
            clear_screen()
            print_banner()
            print_relativity_tutorial()
            press_enter()
        elif choice == "0":
            print()
            print(f"  {Ansi.BYELLOW}🌌  Clear skies and following seas, commander.{Ansi.RESET}")
            print()
            break
        else:
            print(f"  {Ansi.RED}Invalid option.{Ansi.RESET}")
            press_enter()


# ── CLI Entry Point ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Relativistic Space Explorer — interstellar travel with real physics",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                        Interactive mode
  python main.py --demo                 Run a demo animation
  python main.py --tutorial             Read the relativity tutorial
  python main.py --mission "Alpha Centauri"  Quick mission to Alpha Centauri
  python main.py --compare "Vega"       Compare acceleration profiles to Vega
        """,
    )
    parser.add_argument("--demo", action="store_true",
                        help="Run a quick demonstration")
    parser.add_argument("--tutorial", action="store_true",
                        help="Display the relativity tutorial")
    parser.add_argument("--mission", type=str, metavar="DEST",
                        help="Quick mission to DEST from Earth")
    parser.add_argument("--compare", type=str, metavar="DEST",
                        help="Compare accelerations for journey to DEST")
    parser.add_argument("--list", action="store_true",
                        help="List all star systems and exit")
    args = parser.parse_args()

    print_banner()

    if args.list:
        menu_explore_universe()
    elif args.tutorial:
        print_relativity_tutorial()
    elif args.mission:
        dest = args.mission
        if dest not in universe.systems:
            print(f"  {Ansi.RED}Unknown destination: {dest}{Ansi.RESET}")
            print(f"  Available: {', '.join(sorted(universe.systems.keys()))}")
            return
        config = MissionConfig(origin="Sol", destination=dest,
                               proper_accel=G_IN_LY,
                               mission_name=f"Sol → {dest}")
        sim = MissionSimulator(config, universe)
        sim.plan()
        sim.print_plan()
        print_comparison(sim)
        sim.print_events()
    elif args.compare:
        dest = args.compare
        if dest not in universe.systems:
            print(f"  {Ansi.RED}Unknown destination: {dest}{Ansi.RESET}")
            return
        distance = universe.distance_between("Sol", dest)
        if distance is None:
            return
        print(f"\n  Acceleration comparison: Sol → {dest} ({format_distance(distance)})")
        print(f"  {'─' * 72}")
        print(f"  {'Accel':>10s}  {'Earth Time':>14s}  {'Ship Time':>14s}  "
              f"{'Max Speed':>14s}  {'Max γ':>8s}")
        print(f"  {'─' * 72}")
        for g in [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]:
            config = MissionConfig(origin="Sol", destination=dest,
                                   proper_accel=g * G_IN_LY)
            sim = MissionSimulator(config, universe)
            sim.plan()
            j = sim.journey
            if j:
                print(f"  {g:>8.2f}g  {format_duration(j.earth_time_total):>14s}  "
                      f"{format_duration(j.proper_time_total):>14s}  "
                      f"{format_velocity(j.max_velocity):>14s}  "
                      f"{j.max_gamma:>8.2f}")
        print(f"  {'─' * 72}")
    elif args.demo:
        # Quick demo: Alpha Centauri at 1g
        config = MissionConfig(
            origin="Sol", destination="Alpha Centauri",
            proper_accel=G_IN_LY,
            mission_name="DEMO: Sol → Alpha Centauri",
        )
        sim = MissionSimulator(config, universe)
        sim.plan()
        sim.print_plan()
        print_comparison(sim)
        print()
        input(f"  {Ansi.BYELLOW}Press Enter to start animation...{Ansi.RESET}")
        animate_journey(sim, speed=8.0, steps=40, fps=8)
    else:
        # Interactive mode
        try:
            main_menu()
        except KeyboardInterrupt:
            print()
            print(f"  {Ansi.BYELLOW}🌌  Mission aborted. Safe travels.{Ansi.RESET}")
            print()


if __name__ == "__main__":
    main()
