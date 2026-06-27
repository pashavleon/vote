#!/usr/bin/env python3
"""
After the group stage: resolve Round of 32 teams, mark eliminated nations, open R32 voting.

Reads finished group matches from Supabase, computes standings + FIFA Annex C third-place
assignments, and writes SQL patches plus JSON summary.

Usage:
  python scripts/gen_knockout_stage.py --dry-run
  python scripts/gen_knockout_stage.py
  python scripts/gen_knockout_stage.py --allow-partial   # skip unfinished groups (dev only)

Outputs (default):
  supabase/generated/resolve-r32-teams.sql
  supabase/generated/eliminated-teams.sql
  supabase/generated/knockout-transition.json

Run generated SQL in Supabase SQL Editor, then:
  supabase/patch-match-votes-r32.sql
  supabase/patch-eliminated-teams-votes.sql
Update js/config.js: activeMatchStage = 'r32'
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "js" / "config.js"
SEED_PATH = ROOT / "supabase" / "seed-wc-2026.sql"
GEN_DIR = ROOT / "supabase" / "generated"
THIRD_PLACE_CSV = Path(__file__).resolve().parent / "data" / "third_place_combination.csv"

GROUPS = list("ABCDEFGHIJKL")
R32_MATCHES = tuple(f"wc26-m{n:03d}" for n in range(73, 89))

# Annex C winner columns → seed third-place slot ids (m074…m087)
THIRD_SLOT_COLUMN = {
    "3p1": "slot_1E",
    "3p2": "slot_1I",
    "3p3": "slot_1A",
    "3p4": "slot_1L",
    "3p5": "slot_1D",
    "3p6": "slot_1G",
    "3p7": "slot_1B",
    "3p8": "slot_1K",
}


@dataclass
class TeamRow:
    id: str
    label: str
    group: str
    pts: int = 0
    gd: int = 0
    gf: int = 0
    ga: int = 0
    p: int = 0
    rank: int = 0


def load_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_m = re.search(r"supabaseUrl:\s*'([^']+)'", text)
    key_m = re.search(r"supabaseAnonKey:\s*'([^']+)'", text)
    if not url_m or not key_m:
        raise SystemExit(f"Could not parse Supabase config from {CONFIG_PATH}")
    return url_m.group(1).rstrip("/"), key_m.group(1)


def rest_get(base_url: str, key: str, path: str, timeout: float = 60) -> object:
    url = f"{base_url}/rest/v1/{path}"
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def load_teams_from_seed() -> dict[str, dict]:
    """team_id → {label, short, flag}"""
    text = SEED_PATH.read_text(encoding="utf-8")
    teams: dict[str, dict] = {}
    for m in re.finditer(
        r"\('wc-2026-winner', '([a-z]{3})', '([^']*)', '\{\"short\": \"([A-Z]{3})\", \"flag\": \"([^\"]*)\"",
        text,
    ):
        tid, label, short, flag = m.group(1), m.group(2), m.group(3), m.group(4)
        teams[tid] = {"label": label, "short": short, "flag": flag}
    return teams


def load_r32_slots_from_seed() -> dict[str, tuple[str, str, str]]:
    """match_id → (home_slot, away_slot, kickoff_iso)"""
    text = SEED_PATH.read_text(encoding="utf-8")
    slots: dict[str, tuple[str, str, str]] = {}
    for m in re.finditer(
        r"\('(wc26-m07[3-9]|wc26-m08[0-8])', 'wc-2026', 'r32', null, '[^']*', "
        r"'([^']+)', '([^']+)', timestamptz '([^']+)'",
        text,
    ):
        slots[m.group(1)] = (m.group(2), m.group(3), m.group(4))
    return slots


def load_third_place_table() -> dict[str, dict[str, str]]:
    """sorted groups_advancing key → {slot_1A: 3E, ...}"""
    if not THIRD_PLACE_CSV.is_file():
        raise SystemExit(f"Missing {THIRD_PLACE_CSV} — run from repo with scripts/data/")
    table: dict[str, dict[str, str]] = {}
    with THIRD_PLACE_CSV.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = row["groups_advancing"].strip()
            table[key] = {
                col: row[col].strip()
                for col in reader.fieldnames or []
                if col.startswith("slot_")
            }
    return table


def compute_standings(matches: list[dict], teams: dict[str, dict]) -> dict[str, list[TeamRow]]:
    by_group: dict[str, dict[str, TeamRow]] = {g: {} for g in GROUPS}

    for m in matches:
        g = m.get("group_code")
        if not g or g not in by_group:
            continue
        for tid in (m.get("home_team_id"), m.get("away_team_id")):
            if not tid or tid in by_group[g]:
                continue
            meta = teams.get(tid, {})
            by_group[g][tid] = TeamRow(
                id=tid,
                label=meta.get("label", tid.upper()),
                group=g,
            )

    for m in matches:
        if m.get("match_status") != "finished":
            continue
        hs, as_ = m.get("home_score"), m.get("away_score")
        if hs is None or as_ is None:
            continue
        g = m.get("group_code")
        if not g:
            continue
        home = by_group[g].get(m["home_team_id"])
        away = by_group[g].get(m["away_team_id"])
        if not home or not away:
            continue
        hs, as_ = int(hs), int(as_)
        home.p += 1
        away.p += 1
        home.gf += hs
        home.ga += as_
        away.gf += as_
        away.ga += hs
        if hs > as_:
            home.pts += 3
        elif hs < as_:
            away.pts += 3
        else:
            home.pts += 1
            away.pts += 1

    for g in GROUPS:
        for row in by_group[g].values():
            row.gd = row.gf - row.ga

    standings: dict[str, list[TeamRow]] = {}
    for g in GROUPS:
        rows = sorted(
            by_group[g].values(),
            key=lambda r: (-r.pts, -r.gd, -r.gf, r.label),
        )
        for i, row in enumerate(rows, start=1):
            row.rank = i
        standings[g] = rows
    return standings


def rank_third_places(standings: dict[str, list[TeamRow]]) -> list[TeamRow]:
    thirds = [rows[2] for rows in standings.values() if len(rows) >= 3]
    return sorted(thirds, key=lambda r: (-r.pts, -r.gd, -r.gf, r.label))


def lookup_third_mapping(
    qualified_thirds: list[TeamRow], table: dict[str, dict[str, str]]
) -> dict[str, str]:
    """3p1…3p8 → team_id"""
    advancing = "".join(sorted(r.group for r in qualified_thirds))
    row = table.get(advancing)
    if not row:
        raise SystemExit(
            f"No Annex C row for advancing groups {advancing!r}. "
            "Check third_place_combination.csv or group results."
        )
    thirds_by_group = {r.group: r for r in qualified_thirds}
    out: dict[str, str] = {}
    for slot_id, col in THIRD_SLOT_COLUMN.items():
        ref = row[col]  # e.g. 3E
        if not ref.startswith("3") or len(ref) != 2:
            raise SystemExit(f"Bad third ref {ref!r} in column {col}")
        g = ref[1]
        if g not in thirds_by_group:
            raise SystemExit(f"Column {col}={ref} but group {g} third did not qualify")
        out[slot_id] = thirds_by_group[g].id
    return out


def resolve_slot(
    slot: str,
    standings: dict[str, list[TeamRow]],
    third_map: dict[str, str],
) -> str:
    if slot.startswith("3p"):
        return third_map[slot]
    if len(slot) == 2 and slot[0] in "12" and slot[1].isalpha():
        rank = int(slot[0])
        g = slot[1].upper()
        rows = standings.get(g, [])
        if len(rows) < rank:
            raise SystemExit(f"Cannot resolve slot {slot!r} — group {g} incomplete")
        return rows[rank - 1].id
    raise SystemExit(f"Unknown slot id {slot!r}")


def team_meta_json(team_id: str, teams: dict[str, dict]) -> str:
    meta = teams.get(team_id, {})
    return json.dumps(
        {"short": meta.get("short", team_id.upper()), "flag": meta.get("flag", "")},
        ensure_ascii=False,
    )


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_sql(
    r32_resolved: list[dict],
    eliminated: list[str],
    advancing: list[str],
    teams: dict[str, dict],
) -> tuple[str, str]:
    lines = [
        "-- Generated by scripts/gen_knockout_stage.py",
        f"-- {datetime.now(timezone.utc).isoformat()}",
        "begin;",
        "",
        "-- Round of 32: real teams + poll titles/choices",
    ]
    for row in r32_resolved:
        mid = row["match_id"]
        poll_id = f"wc26-poll-{mid}"
        home, away = row["home_id"], row["away_id"]
        title = row["title"]
        lines.append(
            f"update public.matches set "
            f"home_team_id = {sql_str(home)}, away_team_id = {sql_str(away)}, "
            f"round_label = {sql_str(title)} "
            f"where id = {sql_str(mid)};"
        )
        lines.append(
            f"update public.polls set title = {sql_str(title)} "
            f"where id = {sql_str(poll_id)};"
        )
        for side, tid in (("home", home), ("away", away)):
            label = teams[tid]["label"]
            meta = team_meta_json(tid, teams)
            lines.append(
                f"update public.poll_choices set "
                f"label = {sql_str(label)}, meta = {sql_str(meta)}::jsonb "
                f"where poll_id = {sql_str(poll_id)} and id = {sql_str(side)};"
            )
        lines.append("")

    lines.append("commit;")
    resolve_sql = "\n".join(lines)

    elim_sql_lines = [
        "-- Generated by scripts/gen_knockout_stage.py",
        f"-- {datetime.now(timezone.utc).isoformat()}",
        "begin;",
        "",
        "-- Clear eliminated flag on all teams (idempotent re-run)",
        "update public.poll_choices",
        "set meta = coalesce(meta, '{}'::jsonb) - 'eliminated'",
        "where poll_id in ('wc-2026-winner', 'wc-2026-favorite');",
        "",
        f"-- Mark {len(eliminated)} eliminated teams",
    ]
    if eliminated:
        ids_sql = ", ".join(sql_str(t) for t in eliminated)
        elim_sql_lines.extend(
            [
                "update public.poll_choices",
                "set meta = coalesce(meta, '{}'::jsonb) || '{\"eliminated\": true}'::jsonb",
                f"where poll_id in ('wc-2026-winner', 'wc-2026-favorite') and id in ({ids_sql});",
            ]
        )
    elim_sql_lines.extend(["", "commit;"])
    return resolve_sql, "\n".join(elim_sql_lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve R32 teams and eliminated nations")
    parser.add_argument("--dry-run", action="store_true", help="Print summary only, no files")
    parser.add_argument(
        "--allow-partial",
        action="store_true",
        help="Allow incomplete group stage (not for production)",
    )
    parser.add_argument("--out-dir", type=Path, default=GEN_DIR)
    args = parser.parse_args()

    teams = load_teams_from_seed()
    r32_slots = load_r32_slots_from_seed()
    third_table = load_third_place_table()
    base_url, key = load_supabase_config()

    try:
        raw_matches = rest_get(
            base_url,
            key,
            "matches?event_id=eq.wc-2026&stage=eq.group&select=*&order=sort_order",
        )
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase request failed: {e}") from e

    if not isinstance(raw_matches, list):
        raise SystemExit("Unexpected matches response")

    finished = [
        m
        for m in raw_matches
        if m.get("match_status") == "finished"
        and m.get("home_score") is not None
        and m.get("away_score") is not None
    ]
    if len(finished) < 72 and not args.allow_partial:
        raise SystemExit(
            f"Group stage incomplete: {len(finished)}/72 matches finished. "
            "Use --allow-partial for dev only."
        )

    standings = compute_standings(raw_matches, teams)
    ranked_thirds = rank_third_places(standings)
    qualified_thirds = ranked_thirds[:8]
    if len(qualified_thirds) < 8 and not args.allow_partial:
        raise SystemExit("Need 8 qualified third-place teams")

    third_map = lookup_third_mapping(qualified_thirds, third_table)
    advancing_ids: set[str] = set()
    for g, rows in standings.items():
        if len(rows) >= 2:
            advancing_ids.add(rows[0].id)
            advancing_ids.add(rows[1].id)
    for t in qualified_thirds:
        advancing_ids.add(t.id)

    all_team_ids = {tid for rows in standings.values() for tid in (r.id for r in rows)}
    eliminated = sorted(all_team_ids - advancing_ids)

    r32_resolved: list[dict] = []
    for mid in R32_MATCHES:
        home_slot, away_slot, kickoff = r32_slots[mid]
        home_id = resolve_slot(home_slot, standings, third_map)
        away_id = resolve_slot(away_slot, standings, third_map)
        title = f"{teams[home_id]['label']} vs {teams[away_id]['label']}"
        r32_resolved.append(
            {
                "match_id": mid,
                "home_id": home_id,
                "away_id": away_id,
                "home_slot": home_slot,
                "away_slot": away_slot,
                "title": title,
                "kickoff_at": kickoff,
            }
        )

    summary = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "group_matches_finished": len(finished),
        "advancing_teams": sorted(advancing_ids),
        "eliminated_teams": eliminated,
        "third_place_qualified_groups": sorted(t.group for t in qualified_thirds),
        "standings": {
            g: [
                {
                    "id": r.id,
                    "label": r.label,
                    "pts": r.pts,
                    "gd": r.gd,
                    "gf": r.gf,
                    "rank": r.rank,
                }
                for r in rows
            ]
            for g, rows in standings.items()
        },
        "r32_fixtures": r32_resolved,
    }

    print(f"Group matches finished: {len(finished)}/72")
    print(f"Advancing: {len(advancing_ids)} teams")
    print(f"Eliminated: {len(eliminated)} — {', '.join(eliminated)}")
    print(f"Third-place groups in R32: {summary['third_place_qualified_groups']}")
    print("\nRound of 32:")
    for fx in r32_resolved:
        print(f"  {fx['match_id']}: {fx['title']} ({fx['kickoff_at']})")

    if args.dry_run:
        return 0

    args.out_dir.mkdir(parents=True, exist_ok=True)
    partial = len(finished) < 72
    resolve_sql, elim_sql = build_sql(r32_resolved, eliminated, list(advancing_ids), teams)
    if partial:
        warn = (
            f"-- WARNING: generated with incomplete group stage ({len(finished)}/72 finished).\n"
            "-- Re-run without --allow-partial before applying to production.\n\n"
        )
        resolve_sql = warn + resolve_sql
        elim_sql = warn + elim_sql
    (args.out_dir / "resolve-r32-teams.sql").write_text(resolve_sql + "\n", encoding="utf-8")
    (args.out_dir / "eliminated-teams.sql").write_text(elim_sql + "\n", encoding="utf-8")
    (args.out_dir / "knockout-transition.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
    )
    print(f"\nWrote {args.out_dir / 'resolve-r32-teams.sql'}")
    print(f"Wrote {args.out_dir / 'eliminated-teams.sql'}")
    print(f"Wrote {args.out_dir / 'knockout-transition.json'}")
    print("\nNext: run SQL in Supabase, then supabase/patch-match-votes-r32.sql")
    print("Set js/config.js activeMatchStage to 'r32' and deploy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
