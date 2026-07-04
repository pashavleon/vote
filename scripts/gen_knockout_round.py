#!/usr/bin/env python3
"""
Resolve knockout bracket after a round completes (R32 → R16 → QF → SF → Final).

Reads finished matches from the previous stage in Supabase, maps winner slots
(w73, w89, …) to real team ids, and updates the next round's matches/polls.
Also regenerates eliminated-teams.sql for winner/favorite polls.

Usage:
  python scripts/gen_knockout_round.py --stage r16 --dry-run
  python scripts/gen_knockout_round.py --stage r16
  python scripts/gen_knockout_round.py --stage qf

Optional overlay (if Supabase scores lag ESPN):
  python scripts/gen_knockout_round.py --stage r16 --merge-results supabase/generated/match-results.sql

Outputs:
  supabase/generated/resolve-{stage}-teams.sql
  supabase/generated/eliminated-teams.sql

Then in Supabase SQL Editor:
  1. resolve-{stage}-teams.sql
  2. eliminated-teams.sql
  3. supabase/patch-match-votes-{stage}.sql

Frontend: js/config.js → activeMatchStage = '{stage}', then deploy.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "js" / "config.js"
SEED_PATH = ROOT / "supabase" / "seed-wc-2026.sql"
GEN_DIR = ROOT / "supabase" / "generated"

# w73 → wc26-m073 (winner of that R32 match)
SLOT_TO_SOURCE_MATCH: dict[str, str] = {
    "w73": "wc26-m073",
    "w74": "wc26-m074",
    "w75": "wc26-m075",
    "w76": "wc26-m076",
    "w77": "wc26-m077",
    "w78": "wc26-m078",
    "w79": "wc26-m079",
    "w80": "wc26-m080",
    "w81": "wc26-m081",
    "w82": "wc26-m082",
    "w83": "wc26-m083",
    "w84": "wc26-m084",
    "w85": "wc26-m085",
    "w86": "wc26-m086",
    "w87": "wc26-m087",
    "w88": "wc26-m088",
    "w89": "wc26-m089",
    "w90": "wc26-m090",
    "w91": "wc26-m091",
    "w92": "wc26-m092",
    "w93": "wc26-m093",
    "w94": "wc26-m094",
    "w95": "wc26-m095",
    "w96": "wc26-m096",
    "w97": "wc26-m097",
    "w98": "wc26-m098",
    "w99": "wc26-m099",
    "w100": "wc26-m100",
    "w101": "wc26-m101",
    "w102": "wc26-m102",
}

STAGE_CHAIN: dict[str, dict] = {
    "r16": {"prev": "r32", "match_range": range(89, 97)},
    "qf": {"prev": "r16", "match_range": range(97, 101)},
    "sf": {"prev": "qf", "match_range": range(101, 103)},
    "final": {"prev": "sf", "match_range": range(104, 105)},
}


@dataclass
class StageMatch:
    match_id: str
    home_slot: str
    away_slot: str
    kickoff_at: str


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
    text = SEED_PATH.read_text(encoding="utf-8")
    teams: dict[str, dict] = {}
    for m in re.finditer(
        r"\('wc-2026-winner', '([a-z]{3})', '([^']*)', '\{\"short\": \"([A-Z]{3})\", \"flag\": \"([^\"]*)\"",
        text,
    ):
        tid, label, short, flag = m.group(1), m.group(2), m.group(3), m.group(4)
        teams[tid] = {"label": label, "short": short, "flag": flag}
    return teams


def load_stage_matches_from_seed(stage: str) -> list[StageMatch]:
    cfg = STAGE_CHAIN[stage]
    ids = {f"wc26-m{n:03d}" for n in cfg["match_range"]}
    text = SEED_PATH.read_text(encoding="utf-8")
    out: list[StageMatch] = []
    pattern = re.compile(
        r"\('(wc26-m\d+)', 'wc-2026', '" + re.escape(stage) + r"', null, '[^']*', "
        r"'([^']+)', '([^']+)', timestamptz '([^']+)'"
    )
    for m in pattern.finditer(text):
        if m.group(1) not in ids:
            continue
        out.append(
            StageMatch(
                match_id=m.group(1),
                home_slot=m.group(2),
                away_slot=m.group(3),
                kickoff_at=m.group(4),
            )
        )
    out.sort(key=lambda x: x.match_id)
    return out


def parse_results_sql(path: Path) -> dict[str, dict]:
    text = path.read_text(encoding="utf-8")
    overlay: dict[str, dict] = {}
    pattern = re.compile(
        r"'(wc26-m\d+)'::text,\s*(\d+)::smallint,\s*(\d+)::smallint,\s*'(\w+)'::text,"
        r"\s*(?:null|'(?:''|[^'])*')::text,\s*'(?:''|[^'])*'::jsonb,\s*"
        r"(?:'(\w+)'::text|null::text)",
        re.DOTALL,
    )
    for m in pattern.finditer(text):
        overlay[m.group(1)] = {
            "home_score": int(m.group(2)),
            "away_score": int(m.group(3)),
            "match_status": m.group(4),
            "result_choice_id": m.group(5),
        }
    return overlay


def merge_overlay(matches: list[dict], overlay: dict[str, dict]) -> int:
    n = 0
    for row in matches:
        patch = overlay.get(row.get("id"))
        if not patch:
            continue
        row["home_score"] = patch["home_score"]
        row["away_score"] = patch["away_score"]
        row["match_status"] = patch["match_status"]
        if patch.get("result_choice_id"):
            row["result_choice_id"] = patch["result_choice_id"]
        n += 1
    return n


def match_winner_id(m: dict) -> str:
    if m.get("match_status") != "finished":
        raise SystemExit(f"Match {m['id']} not finished")
    rc = m.get("result_choice_id")
    if rc == "home":
        return m["home_team_id"]
    if rc == "away":
        return m["away_team_id"]
    hs, as_ = m.get("home_score"), m.get("away_score")
    if hs is None or as_ is None:
        raise SystemExit(f"Match {m['id']} has no result_choice_id or scores")
    if int(hs) > int(as_):
        return m["home_team_id"]
    if int(hs) < int(as_):
        return m["away_team_id"]
    raise SystemExit(f"Match {m['id']} ended in a draw — cannot resolve winner")


def match_loser_id(m: dict) -> str:
    w = match_winner_id(m)
    return m["away_team_id"] if w == m["home_team_id"] else m["home_team_id"]


def resolve_slot(slot: str, by_id: dict[str, dict]) -> str:
    if slot not in SLOT_TO_SOURCE_MATCH:
        raise SystemExit(f"Unknown winner slot {slot!r}")
    src_id = SLOT_TO_SOURCE_MATCH[slot]
    src = by_id.get(src_id)
    if not src:
        raise SystemExit(f"Source match {src_id} not found in Supabase")
    return match_winner_id(src)


def team_meta_json(team_id: str, teams: dict[str, dict]) -> str:
    meta = teams.get(team_id, {})
    return json.dumps(
        {"short": meta.get("short", team_id.upper()), "flag": meta.get("flag", "")},
        ensure_ascii=False,
    )


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_resolve_sql(stage: str, fixtures: list[dict], teams: dict[str, dict]) -> str:
    label = stage.upper() if stage == "qf" else stage.replace("r", "Round of ", 1) if stage.startswith("r") else stage
    lines = [
        f"-- Generated by scripts/gen_knockout_round.py ({stage})",
        f"-- {datetime.now(timezone.utc).isoformat()}",
        "begin;",
        "",
        f"-- {label}: real teams + poll titles/choices",
    ]
    for row in fixtures:
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
            label_t = teams[tid]["label"]
            meta = team_meta_json(tid, teams)
            lines.append(
                f"update public.poll_choices set "
                f"label = {sql_str(label_t)}, meta = {sql_str(meta)}::jsonb "
                f"where poll_id = {sql_str(poll_id)} and id = {sql_str(side)};"
            )
        lines.append("")
    lines.append("commit;")
    return "\n".join(lines)


def build_eliminated_sql(eliminated: list[str]) -> str:
    lines = [
        "-- Generated by scripts/gen_knockout_round.py",
        f"-- {datetime.now(timezone.utc).isoformat()}",
        "begin;",
        "",
        "update public.poll_choices",
        "set meta = coalesce(meta, '{}'::jsonb) - 'eliminated'",
        "where poll_id in ('wc-2026-winner', 'wc-2026-favorite');",
        "",
        f"-- Mark {len(eliminated)} eliminated teams",
    ]
    if eliminated:
        ids_sql = ", ".join(sql_str(t) for t in eliminated)
        lines.append(
            "update public.poll_choices\n"
            "set meta = coalesce(meta, '{}'::jsonb) || '{\"eliminated\": true}'::jsonb\n"
            f"where poll_id in ('wc-2026-winner', 'wc-2026-favorite') and id in ({ids_sql});"
        )
    lines.extend(["", "commit;"])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve next knockout round from finished matches")
    parser.add_argument(
        "--stage",
        required=True,
        choices=list(STAGE_CHAIN.keys()),
        help="Stage to open (r16, qf, sf, final)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--merge-results", type=Path, default=None)
    parser.add_argument("--out-dir", type=Path, default=GEN_DIR)
    args = parser.parse_args()

    cfg = STAGE_CHAIN[args.stage]
    teams = load_teams_from_seed()
    stage_matches = load_stage_matches_from_seed(args.stage)
    base_url, key = load_supabase_config()

    prev_stage = cfg["prev"]
    try:
        prev_matches = rest_get(
            base_url,
            key,
            f"matches?event_id=eq.wc-2026&stage=eq.{prev_stage}&select=*&order=sort_order",
        )
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase request failed: {e}") from e

    if not isinstance(prev_matches, list):
        raise SystemExit("Unexpected matches response")

    if args.merge_results:
        overlay = parse_results_sql(args.merge_results)
        applied = merge_overlay(prev_matches, overlay)
        print(f"Merged {applied} results from {args.merge_results}")

    by_id = {m["id"]: m for m in prev_matches}
    finished = [
        m
        for m in prev_matches
        if m.get("match_status") == "finished"
        and m.get("home_score") is not None
        and m.get("away_score") is not None
    ]
    expected = len(prev_matches)
    if len(finished) < expected:
        missing = [m["id"] for m in prev_matches if m["id"] not in {f["id"] for f in finished}]
        raise SystemExit(
            f"{prev_stage} incomplete: {len(finished)}/{expected} finished. "
            f"Missing: {', '.join(missing[:5])}{'…' if len(missing) > 5 else ''}. "
            "Run fetch_match_results.py --all-stages first."
        )

    fixtures: list[dict] = []
    still_in: set[str] = set()
    for sm in stage_matches:
        home_id = resolve_slot(sm.home_slot, by_id)
        away_id = resolve_slot(sm.away_slot, by_id)
        still_in.add(home_id)
        still_in.add(away_id)
        fixtures.append(
            {
                "match_id": sm.match_id,
                "home_id": home_id,
                "away_id": away_id,
                "title": f"{teams[home_id]['label']} vs {teams[away_id]['label']}",
                "kickoff_at": sm.kickoff_at,
            }
        )

    # Losers from previous round join elimination pool
    for m in finished:
        try:
            match_loser_id(m)
        except SystemExit:
            continue

    eliminated = sorted(set(teams.keys()) - still_in)

    print(f"Previous stage {prev_stage}: {len(finished)}/{expected} finished")
    print(f"Opening {args.stage}: {len(fixtures)} matches, {len(still_in)} teams still in tournament")
    print(f"Eliminated in winner/favorite: {len(eliminated)} teams")
    print()
    for fx in fixtures:
        print(f"  {fx['match_id']}: {fx['title']} ({fx['kickoff_at']})")

    if args.dry_run:
        return 0

    args.out_dir.mkdir(parents=True, exist_ok=True)
    resolve_path = args.out_dir / f"resolve-{args.stage}-teams.sql"
    resolve_path.write_text(build_resolve_sql(args.stage, fixtures, teams) + "\n", encoding="utf-8")
    (args.out_dir / "eliminated-teams.sql").write_text(build_eliminated_sql(eliminated) + "\n", encoding="utf-8")
    summary = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "stage": args.stage,
        "prev_stage": prev_stage,
        "still_in_tournament": sorted(still_in),
        "eliminated_teams": eliminated,
        "fixtures": fixtures,
    }
    (args.out_dir / f"knockout-{args.stage}.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
    )
    print(f"\nWrote {resolve_path}")
    print(f"Wrote {args.out_dir / 'eliminated-teams.sql'}")
    print(f"\nSupabase: resolve-{args.stage}-teams.sql → eliminated-teams.sql → patch-match-votes-{args.stage}.sql")
    print(f"Frontend: activeMatchStage = '{args.stage}' → deploy")
    return 0


if __name__ == "__main__":
    sys.exit(main())
