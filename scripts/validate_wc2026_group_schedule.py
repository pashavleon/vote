#!/usr/bin/env python3
"""
Validate WC 2026 group-stage schedule in seed vs official format.

Official (FIFA regulations, 48-team edition):
  - 12 groups × 4 teams
  - Round-robin within each group: 6 matches per group (C(4,2))
  - Each team plays exactly 3 group matches
  - 72 group-stage matches total; 104 matches in the tournament

Usage:
  python scripts/validate_wc2026_group_schedule.py
  python scripts/validate_wc2026_group_schedule.py --write-report report.txt

Re-generate seed after editing GROUP_FIXTURES in:
  docs/cl-vote-mockup/supabase/_gen_seed_wc2026.py
  python docs/cl-vote-mockup/supabase/_gen_seed_wc2026.py
  copy supabase/seed-wc-2026.sql → hpj-landing-publish/supabase/
  Re-apply in Supabase SQL Editor (idempotent upserts).
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "supabase" / "seed-wc-2026.sql"
GEN_PATH = Path(__file__).resolve().parents[2] / "docs" / "cl-vote-mockup" / "supabase" / "_gen_seed_wc2026.py"

EXPECTED_GROUPS = list("ABCDEFGHIJKL")
MATCHES_PER_GROUP = 6
GAMES_PER_TEAM = 3
TOTAL_GROUP_MATCHES = 72
TOTAL_MATCHES = 104


def load_group_fixtures_from_generator() -> dict[str, list[tuple[str, str]]]:
    """Parse GROUP_FIXTURES tuples from generator source (no exec)."""
    if not GEN_PATH.is_file():
        return {}
    text = GEN_PATH.read_text(encoding="utf-8")
    block = re.search(r"GROUP_FIXTURES:\s*dict\[.*?\]\s*=\s*\{", text)
    if not block:
        return {}
    out: dict[str, list[tuple[str, str]]] = {}
    for gm in re.finditer(
        r'"([A-L])":\s*\[(.*?)\]\s*,',
        text[block.start() : block.start() + 120000],
        re.DOTALL,
    ):
        pairs = re.findall(r'\("([^"]+)",\s*"([^"]+)",\s*et\(', gm.group(2))
        out[gm.group(1)] = [(h, a) for h, a in pairs]
    return out


def parse_seed_group_matches(text: str) -> dict[str, list[dict]]:
    # Venue may contain SQL-escaped quotes: Levi''s Stadium
    pattern = re.compile(
        r"\('(wc26-m\d+)', 'wc-2026', 'group', '([A-L])', 'Group [A-L]', "
        r"'([^']+)', '([^']+)', timestamptz '([^']+)', '((?:[^']|'')*)', (\d+)\)"
    )
    by_group: dict[str, list[dict]] = defaultdict(list)
    for m in pattern.finditer(text):
        by_group[m.group(2)].append(
            {
                "id": m.group(1),
                "home": m.group(3),
                "away": m.group(4),
                "kickoff": m.group(5),
                "venue": m.group(6),
            }
        )
    return dict(by_group)


def team_game_counts(fixtures: list[tuple[str, str]]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for home, away in fixtures:
        counts[home] += 1
        counts[away] += 1
    return dict(counts)


def run_audit() -> tuple[list[str], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    lines: list[str] = []

    if not SEED_PATH.is_file():
        return [f"Missing seed file: {SEED_PATH}"], [], []

    seed_text = SEED_PATH.read_text(encoding="utf-8")
    seed_groups = parse_seed_group_matches(seed_text)
    gen_groups = load_group_fixtures_from_generator()

    lines.append("=== FIFA World Cup 2026 — group stage audit ===")
    lines.append("Official: 12x4 teams, 6 matches/group, 3 games/team, 72 group matches.\n")

    for g in EXPECTED_GROUPS:
        if g not in seed_groups:
            errors.append(f"Seed missing group {g}")
        elif len(seed_groups[g]) != MATCHES_PER_GROUP:
            errors.append(
                f"Group {g}: {len(seed_groups[g])} matches in seed, expected {MATCHES_PER_GROUP}"
            )

    total_group = sum(len(v) for v in seed_groups.values())
    lines.append(f"Group matches in seed: {total_group} (expected {TOTAL_GROUP_MATCHES})")
    if total_group != TOTAL_GROUP_MATCHES:
        errors.append(f"Total group matches {total_group} != {TOTAL_GROUP_MATCHES}")

    for g in sorted(seed_groups):
        fixtures = [(m["home"], m["away"]) for m in seed_groups[g]]
        counts = team_game_counts(fixtures)
        if len(counts) != 4:
            errors.append(f"Group {g}: expected 4 teams, got {len(counts)}")
        for tid, n in counts.items():
            if n != GAMES_PER_TEAM:
                errors.append(f"Group {g}: {tid} has {n} games, expected {GAMES_PER_TEAM}")
        pairs = [tuple(sorted(f)) for f in fixtures]
        if len(pairs) != len(set(pairs)):
            errors.append(f"Group {g}: duplicate fixture")
        lines.append(f"  Group {g}: {len(fixtures)} fixtures — {dict(sorted(counts.items()))}")

    all_matches = len(re.findall(r"\('wc26-m\d+", seed_text))
    lines.append(f"\nAll stages: {all_matches} matches in seed (expected {TOTAL_MATCHES})")
    if all_matches != TOTAL_MATCHES:
        warnings.append(f"Total match rows {all_matches} != {TOTAL_MATCHES}")

    if gen_groups:
        lines.append("\nSeed vs generator GROUP_FIXTURES:")
        for g in EXPECTED_GROUPS:
            if g not in gen_groups:
                warnings.append(f"Generator missing group {g}")
                continue
            seed_pairs = sorted(tuple(sorted((m["home"], m["away"]))) for m in seed_groups.get(g, []))
            gen_pairs = sorted(tuple(sorted(p)) for p in gen_groups[g])
            if seed_pairs != gen_pairs:
                errors.append(f"Group {g}: seed != generator — regenerate seed SQL")
            else:
                lines.append(f"  Group {g}: matches generator")
    else:
        warnings.append(f"Generator not found: {GEN_PATH}")

    lines.append("\n=== Result ===")
    if errors:
        lines.append(f"FAILED ({len(errors)} errors)")
        for e in errors:
            lines.append(f"  FAIL {e}")
    else:
        lines.append("PASSED — group stage aligns with official 3-matches-per-team format.")
    for w in warnings:
        lines.append(f"  WARN {w}")

    return errors, warnings, lines


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-report", type=Path)
    args = parser.parse_args()

    errors, warnings, lines = run_audit()
    report = "\n".join(lines)
    print(report)

    if args.write_report:
        args.write_report.write_text(report + "\n", encoding="utf-8")
        print(f"\nWrote {args.write_report}")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
