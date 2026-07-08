#!/usr/bin/env python3
"""
One-command workflow to open the next knockout voting stage.

Fetches ESPN results for the completed round, generates bracket SQL + eliminated
teams, and prints Supabase + deploy checklist.

Usage:
  python scripts/open_knockout_stage.py --stage qf --dry-run
  python scripts/open_knockout_stage.py --stage qf
  python scripts/open_knockout_stage.py --stage qf --skip-fetch   # use existing match-results-*.sql

Stages: r16 | qf | sf | final
  (For R32 after groups use: gen_knockout_stage.py)

Outputs:
  supabase/generated/match-results-{prev}.sql
  supabase/generated/resolve-{stage}-teams.sql
  supabase/generated/eliminated-teams.sql
  supabase/generated/knockout-{stage}.json
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN_DIR = ROOT / "supabase" / "generated"
SEED_PATH = ROOT / "supabase" / "seed-wc-2026.sql"

# stage to open → previous stage whose results we fetch
PREV_STAGE: dict[str, str] = {
    "r16": "r32",
    "qf": "r16",
    "sf": "qf",
    "final": "sf",
}

PATCH_FILE: dict[str, str] = {
    "r16": "patch-match-votes-r16.sql",
    "qf": "patch-match-votes-qf.sql",
    "sf": "patch-match-votes-sf.sql",
    "final": "patch-match-votes-final.sql",
}


def kickoff_dates_for_stage(stage: str) -> tuple[date, date]:
    """Min/max kickoff dates for all matches in stage (from seed)."""
    text = SEED_PATH.read_text(encoding="utf-8")
    pattern = re.compile(
        r"\('wc26-m\d+', 'wc-2026', '" + re.escape(stage) + r"', null, '[^']*', "
        r"'[^']+', '[^']+', timestamptz '([^']+)'"
    )
    dates: list[date] = []
    for m in pattern.finditer(text):
        dt = datetime.fromisoformat(m.group(1).replace("Z", "+00:00"))
        dates.append(dt.date())
    if not dates:
        raise SystemExit(f"No kickoff dates found for stage {stage!r} in seed")
    return min(dates), max(dates)


def run(cmd: list[str], label: str) -> None:
    print(f"\n>>> {label}")
    print("    " + " ".join(cmd))
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit(f"Failed: {label} (exit {result.returncode})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Open next WC knockout voting stage")
    parser.add_argument("--stage", required=True, choices=list(PREV_STAGE.keys()))
    parser.add_argument("--dry-run", action="store_true", help="Fetch + bracket preview only")
    parser.add_argument(
        "--skip-fetch",
        action="store_true",
        help="Skip ESPN fetch; use existing match-results-{prev}.sql",
    )
    args = parser.parse_args()

    prev = PREV_STAGE[args.stage]
    from_d, to_d = kickoff_dates_for_stage(prev)
    results_sql = GEN_DIR / f"match-results-{prev}.sql"
    patch_sql = ROOT / "supabase" / PATCH_FILE[args.stage]

    print(f"Open stage: {args.stage}")
    print(f"Fetch results: {prev} ({from_d} .. {to_d})")

    if not args.skip_fetch:
        fetch_cmd = [
            sys.executable,
            "scripts/fetch_match_results.py",
            "--all-stages",
            "--from",
            from_d.isoformat(),
            "--to",
            to_d.isoformat(),
            "--out",
            str(results_sql),
        ]
        if args.dry_run:
            fetch_cmd.append("--dry-run")
        run(fetch_cmd, "ESPN -> match results SQL")

    if args.dry_run:
        if results_sql.is_file() or args.skip_fetch:
            merge = ["--merge-results", str(results_sql)] if results_sql.is_file() else []
            run(
                [sys.executable, "scripts/gen_knockout_round.py", "--stage", args.stage, "--dry-run", *merge],
                "Bracket preview",
            )
        print("\n--- Dry run complete. Re-run without --dry-run to write SQL files. ---")
        return 0

    if not results_sql.is_file():
        raise SystemExit(f"Missing {results_sql} — run without --skip-fetch first")

    run(
        [
            sys.executable,
            "scripts/gen_knockout_round.py",
            "--stage",
            args.stage,
            "--merge-results",
            str(results_sql),
        ],
        "Generate resolve + eliminated SQL",
    )

    resolve_sql = GEN_DIR / f"resolve-{args.stage}-teams.sql"
    elim_sql = GEN_DIR / "eliminated-teams.sql"

    print("\n" + "=" * 60)
    print("SUPABASE SQL EDITOR — run in order:")
    print("=" * 60)
    print(f"  1. {results_sql.relative_to(ROOT)}")
    print(f"  2. {resolve_sql.relative_to(ROOT)}")
    print(f"  3. {elim_sql.relative_to(ROOT)}")
    print(f"  4. supabase/{PATCH_FILE[args.stage]}")
    print("\nFRONTEND:")
    print(f"  js/config.js -> activeMatchStage: '{args.stage}'")
    print("  git commit + push (or say «деплой»)")
    print("\nVERIFY:")
    print(f"  https://topfan.vote/matches.html -> Active voting: {args.stage}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
