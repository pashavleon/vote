#!/usr/bin/env python3
"""
Fetch FIFA World Cup 2026 match results online and generate SQL to update Supabase.

Data source: ESPN public scoreboard API (no API key).
Schedule / match_id mapping: supabase/seed-wc-2026.sql (group-stage fixtures).

Usage:
  python scripts/fetch_match_results.py --dry-run
  python scripts/fetch_match_results.py --from 2026-06-11 --to 2026-06-13
  python scripts/fetch_match_results.py --days 2 --out supabase/generated/match-results.sql
  python scripts/fetch_match_results.py --days 7 --stdout

After generating SQL:
  Supabase Dashboard → SQL Editor → run the file (APPLY block only, or whole file).

Prerequisites in Supabase (once):
  patch-match-scores.sql, patch-match-correct-votes.sql
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import textwrap
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "supabase" / "seed-wc-2026.sql"
GEN_PATH = Path(__file__).resolve().parents[2] / "docs" / "cl-vote-mockup" / "supabase" / "_gen_seed_wc2026.py"

ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
KICKOFF_TOLERANCE_SEC = 7200  # 2 h — covers schedule drift vs ESPN

# ESPN abbreviation overrides (most map via FIFA short codes in TEAMS)
ESPN_ABBREV_ALIASES: dict[str, str] = {
    "CIV": "civ",  # Ivory Coast sometimes IVCO on other feeds
}


@dataclass
class DbMatch:
    id: str
    stage: str
    home_team_id: str
    away_team_id: str
    kickoff_at: datetime


@dataclass
class FetchedResult:
    match_id: str
    home_score: int
    away_score: int
    match_status: str
    result_note: str | None = None
    goals: list[dict] = field(default_factory=list)
    result_choice_id: str | None = None
    source_event_date: str = ""
    fixture_label: str = ""


def load_teams() -> dict[str, str]:
    """FIFA short code (upper) → internal team id."""
    abbrev: dict[str, str] = {}
    if GEN_PATH.is_file():
        text = GEN_PATH.read_text(encoding="utf-8")
        for m in re.finditer(
            r'"([a-z]{3})":\s*\("([^"]+)",\s*"([A-Z]{3})"',
            text,
        ):
            team_id, _name, short = m.group(1), m.group(2), m.group(3)
            abbrev[short] = team_id
            abbrev[team_id.upper()] = team_id
    for alias, team_id in ESPN_ABBREV_ALIASES.items():
        abbrev[alias] = team_id
    return abbrev


def parse_seed_matches(path: Path) -> list[DbMatch]:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"\('(wc26-m\d+)', 'wc-2026', '([^']+)', "
        r"(?:'([A-L])'|null), '[^']*', "
        r"'([^']+)', '([^']+)', timestamptz '([^']+)'"
    )
    matches: list[DbMatch] = []
    for m in pattern.finditer(text):
        kickoff = datetime.fromisoformat(m.group(6).replace("Z", "+00:00"))
        matches.append(
            DbMatch(
                id=m.group(1),
                stage=m.group(2),
                home_team_id=m.group(4),
                away_team_id=m.group(5),
                kickoff_at=kickoff,
            )
        )
    return matches


def parse_minute(display: str) -> int:
    s = display.replace("'", "").strip()
    if "+" in s:
        base, extra = s.split("+", 1)
        return int(base) + int(extra)
    return int(s)


def espn_fetch(url: str, timeout: float = 30.0) -> dict:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "topfan-vote-fetch/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def fetch_espn_events(from_day: date, to_day: date) -> list[dict]:
    """Fetch events in weekly chunks (single-day ESPN URLs often time out)."""
    events: list[dict] = []
    chunk_start = from_day
    while chunk_start <= to_day:
        chunk_end = min(chunk_start + timedelta(days=6), to_day)
        dates = f"{chunk_start.strftime('%Y%m%d')}-{chunk_end.strftime('%Y%m%d')}"
        url = f"{ESPN_SCOREBOARD}?dates={dates}"
        try:
            data = espn_fetch(url)
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"warning: ESPN fetch failed for {dates}: {exc}", file=sys.stderr)
            chunk_start = chunk_end + timedelta(days=1)
            continue
        events.extend(data.get("events", []))
        chunk_start = chunk_end + timedelta(days=1)
    return events


def espn_status_to_match_status(status_type: dict) -> str | None:
    state = status_type.get("state")
    name = status_type.get("name", "")
    if state == "pre":
        return "scheduled"
    if state == "in":
        return "live"
    if state == "post":
        if name in ("STATUS_FULL_TIME", "STATUS_FINAL", "STATUS_END_PERIOD"):
            return "finished"
        return "finished"
    return None


def is_goal_detail(detail: dict) -> bool:
    """ESPN: 'Goal', 'Goal - Header', 'Own Goal', etc. (type ids 70 / 97)."""
    if not detail.get("scoringPlay"):
        return False
    if detail.get("shootout"):
        return False
    type_obj = detail.get("type") or {}
    type_text = type_obj.get("text", "")
    type_id = str(type_obj.get("id", ""))
    if type_id in ("70", "97"):
        return True
    if type_text.startswith("Goal"):
        return True
    if type_text.startswith("Own Goal"):
        return True
    return bool(detail.get("ownGoal"))


def parse_espn_goals(
    details: list[dict],
    team_id_by_espn_id: dict[str, str],
    home_team_id: str,
    away_team_id: str,
) -> list[dict]:
    goals: list[dict] = []
    for detail in details:
        if not is_goal_detail(detail):
            continue
        clock = detail.get("clock") or {}
        display = clock.get("displayValue") or ""
        if not display:
            continue
        athletes = detail.get("athletesInvolved") or []
        player = athletes[0].get("displayName", "Unknown") if athletes else "Unknown"
        is_og = bool(detail.get("ownGoal"))

        if is_og and athletes:
            scorer_espn = str((athletes[0].get("team") or {}).get("id", ""))
            scorer_team = team_id_by_espn_id.get(scorer_espn)
            if scorer_team == home_team_id:
                team_id = away_team_id
            elif scorer_team == away_team_id:
                team_id = home_team_id
            else:
                team_id = None
        else:
            espn_team_id = str((detail.get("team") or {}).get("id", ""))
            team_id = team_id_by_espn_id.get(espn_team_id)

        if not team_id:
            continue

        goals.append(
            {
                "minute": parse_minute(display),
                "team_id": team_id,
                "player": player,
                "own_goal": is_og,
            }
        )
    goals.sort(key=lambda g: g["minute"])
    return goals


def expected_goal_events(home_score: int, away_score: int) -> int:
    return home_score + away_score


def infer_result_choice_id(
    stage: str,
    home_score: int,
    away_score: int,
    home_winner: bool,
    away_winner: bool,
) -> str | None:
    if home_score > away_score:
        return "home"
    if home_score < away_score:
        return "away"
    if stage == "group":
        return "draw"
    if home_winner:
        return "home"
    if away_winner:
        return "away"
    return None


def find_db_match(
    db_matches: list[DbMatch],
    home_id: str,
    away_id: str,
    kickoff: datetime,
    group_only: bool,
) -> DbMatch | None:
    candidates = []
    for m in db_matches:
        if group_only and m.stage != "group":
            continue
        if m.home_team_id != home_id or m.away_team_id != away_id:
            continue
        delta = abs((m.kickoff_at - kickoff).total_seconds())
        if delta <= KICKOFF_TOLERANCE_SEC:
            candidates.append((delta, m))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


def map_espn_event(
    event: dict,
    abbrev_to_id: dict[str, str],
    db_matches: list[DbMatch],
    group_only: bool,
) -> FetchedResult | None:
    comp = (event.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or []
    if len(competitors) < 2:
        return None

    home = next((c for c in competitors if c.get("homeAway") == "home"), None)
    away = next((c for c in competitors if c.get("homeAway") == "away"), None)
    if not home or not away:
        return None

    home_abbrev = (home.get("team") or {}).get("abbreviation", "").upper()
    away_abbrev = (away.get("team") or {}).get("abbreviation", "").upper()
    home_id = abbrev_to_id.get(home_abbrev)
    away_id = abbrev_to_id.get(away_abbrev)
    if not home_id or not away_id:
        return None

    status_type = (comp.get("status") or {}).get("type") or {}
    match_status = espn_status_to_match_status(status_type)
    if not match_status:
        return None

    home_score_raw = home.get("score")
    away_score_raw = away.get("score")
    if home_score_raw is None or away_score_raw is None:
        if match_status == "scheduled":
            return None
        return None

    home_score = int(home_score_raw)
    away_score = int(away_score_raw)

    kickoff = datetime.fromisoformat(event["date"].replace("Z", "+00:00"))
    db_match = find_db_match(db_matches, home_id, away_id, kickoff, group_only)
    if not db_match:
        return None

    team_id_by_espn_id: dict[str, str] = {}
    for side in (home, away):
        tid = str((side.get("team") or {}).get("id", ""))
        abbr = (side.get("team") or {}).get("abbreviation", "").upper()
        internal = abbrev_to_id.get(abbr)
        if tid and internal:
            team_id_by_espn_id[tid] = internal

    goals = parse_espn_goals(
        comp.get("details") or [],
        team_id_by_espn_id,
        home_id,
        away_id,
    )

    result_note = None
    notes = comp.get("notes") or []
    if notes:
        headline = notes[0].get("headline") or notes[0].get("text")
        if headline and any(x in headline.lower() for x in ("pen", "aet", "extra")):
            result_note = headline

    result_choice_id = infer_result_choice_id(
        db_match.stage,
        home_score,
        away_score,
        bool(home.get("winner")),
        bool(away.get("winner")),
    )

    return FetchedResult(
        match_id=db_match.id,
        home_score=home_score,
        away_score=away_score,
        match_status=match_status,
        result_note=result_note,
        goals=goals,
        result_choice_id=result_choice_id,
        source_event_date=event.get("date", ""),
        fixture_label=f"{home_id} vs {away_id}",
    )


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def sql_literal(value: str | None) -> str:
    if value is None:
        return "null"
    return f"'{sql_escape(value)}'"


def generate_sql(results: list[FetchedResult], source_label: str) -> str:
    if not results:
        return "-- No match results to update.\n"

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "-- Auto-generated match result updates",
        f"-- Source: {source_label}",
        f"-- Generated: {now}",
        f"-- Matches: {len(results)}",
        "-- Run in Supabase SQL Editor (single execution).",
        "",
        "with _match_results as (",
        "  select",
        "    v.match_id,",
        "    v.home_score,",
        "    v.away_score,",
        "    v.match_status,",
        "    v.result_note,",
        "    v.goals,",
        "    v.result_choice_id",
        "  from (",
        "    values",
    ]

    value_rows: list[str] = []
    for r in results:
        goals_json = json.dumps(r.goals, ensure_ascii=False)
        value_rows.append(
            textwrap.indent(
                f"(\n"
                f"  '{r.match_id}'::text,\n"
                f"  {r.home_score}::smallint,\n"
                f"  {r.away_score}::smallint,\n"
                f"  '{r.match_status}'::text,\n"
                f"  {sql_literal(r.result_note)}::text,\n"
                f"  '{sql_escape(goals_json)}'::jsonb,\n"
                f"  {sql_literal(r.result_choice_id)}::text\n"
                f")",
                "      ",
            )
        )
    lines.append(",".join(value_rows))
    lines.extend(
        [
            "  ) as v(match_id, home_score, away_score, match_status, result_note, goals, result_choice_id)",
            "  where v.match_status in ('scheduled', 'live', 'finished', 'postponed')",
            "),",
            "updated as (",
            "  update public.matches m",
            "  set",
            "    home_score = r.home_score,",
            "    away_score = r.away_score,",
            "    match_status = r.match_status,",
            "    result_note = r.result_note,",
            "    goals = r.goals,",
            "    result_choice_id = case",
            "      when r.result_choice_id is not null then r.result_choice_id",
            "      when r.home_score > r.away_score then 'home'",
            "      when r.home_score < r.away_score then 'away'",
            "      when m.stage = 'group' and r.home_score = r.away_score then 'draw'",
            "      else null",
            "    end",
            "  from _match_results r",
            "  where m.id = r.match_id",
            "  returning m.id, m.stage, m.home_team_id, m.away_team_id,",
            "    m.home_score, m.away_score, m.match_status, m.result_choice_id",
            ")",
            "select",
            "  u.id as match_id,",
            "  u.home_team_id || ' vs ' || u.away_team_id as fixture,",
            "  u.home_score || '–' || u.away_score as score,",
            "  u.match_status,",
            "  public.match_result_choice(",
            "    u.stage, u.home_score, u.away_score, u.match_status, u.result_choice_id",
            "  ) as result_choice,",
            "  case",
            "    when u.stage <> 'group'",
            "      and u.home_score = u.away_score",
            "      and public.match_result_choice(",
            "        u.stage, u.home_score, u.away_score, u.match_status, u.result_choice_id",
            "      ) is null",
            "    then 'WARNING: knockout draw — set result_choice_id manually'",
            "    else 'ok'",
            "  end as check_status",
            "from updated u",
            "order by u.id;",
        ]
    )
    return "\n".join(lines) + "\n"


def safe_console(text: str) -> str:
    enc = getattr(sys.stdout, "encoding", None) or "utf-8"
    return text.encode(enc, errors="replace").decode(enc)


def print_dry_run(results: list[FetchedResult]) -> None:
    if not results:
        print("No matches mapped to seed schedule.")
        return
    print(f"{'match_id':<12} {'fixture':<16} {'score':<7} {'status':<10} goals")
    print("-" * 60)
    for r in results:
        score = f"{r.home_score}-{r.away_score}"
        goal_warn = ""
        expected = expected_goal_events(r.home_score, r.away_score)
        if len(r.goals) < expected:
            goal_warn = f"  WARNING: {len(r.goals)}/{expected} goals parsed — check ESPN or add manually"
        print(
            f"{r.match_id:<12} {r.fixture_label:<16} {score:<7} {r.match_status:<10} {len(r.goals)}"
        )
        if goal_warn:
            print(goal_warn)
        for g in r.goals:
            print(f"    {g['minute']}' {g['team_id']} {safe_console(g['player'])}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch WC 2026 results and generate SQL")
    parser.add_argument("--from", dest="from_date", help="Start date YYYY-MM-DD")
    parser.add_argument("--to", dest="to_date", help="End date YYYY-MM-DD")
    parser.add_argument(
        "--days",
        type=int,
        default=3,
        help="If --from omitted: fetch last N days through today (default 3)",
    )
    parser.add_argument("--out", type=Path, help="Write SQL to file")
    parser.add_argument("--stdout", action="store_true", help="Print SQL to stdout")
    parser.add_argument("--dry-run", action="store_true", help="Show mapped results, no SQL file")
    parser.add_argument(
        "--include-scheduled",
        action="store_true",
        help="Include scheduled matches (usually skip)",
    )
    parser.add_argument(
        "--all-stages",
        action="store_true",
        help="Map knockout too (needs real team names in DB; default group only)",
    )
    return parser.parse_args()


def resolve_date_range(args: argparse.Namespace) -> tuple[date, date]:
    if args.from_date:
        start = date.fromisoformat(args.from_date)
        end = date.fromisoformat(args.to_date) if args.to_date else start
    else:
        end = date.today()
        start = end - timedelta(days=max(args.days - 1, 0))
    if end < start:
        raise SystemExit("--to must be on or after --from")
    return start, end


def main() -> int:
    args = parse_args()
    if not SEED_PATH.is_file():
        print(f"Missing seed file: {SEED_PATH}", file=sys.stderr)
        return 1

    abbrev_to_id = load_teams()
    db_matches = parse_seed_matches(SEED_PATH)
    start, end = resolve_date_range(args)

    events = fetch_espn_events(start, end)
    group_only = not args.all_stages

    mapped: dict[str, FetchedResult] = {}
    unmapped: list[str] = []
    for event in events:
        result = map_espn_event(event, abbrev_to_id, db_matches, group_only)
        if not result:
            comp = (event.get("competitions") or [{}])[0]
            competitors = comp.get("competitors") or []
            if len(competitors) >= 2:
                h = next((c for c in competitors if c.get("homeAway") == "home"), {})
                a = next((c for c in competitors if c.get("homeAway") == "away"), {})
                label = (
                    f"{(h.get('team') or {}).get('abbreviation')} "
                    f"{h.get('score')}-{(a.get('team') or {}).get('abbreviation')} {a.get('score')} "
                    f"@ {event.get('date')}"
                )
                status = espn_status_to_match_status((comp.get("status") or {}).get("type") or {})
                if status and status != "scheduled":
                    unmapped.append(label)
            continue
        if result.match_status == "scheduled" and not args.include_scheduled:
            continue
        mapped[result.match_id] = result  # latest wins if duplicate

    results = sorted(mapped.values(), key=lambda r: r.match_id)

    if args.dry_run:
        print_dry_run(results)
        if unmapped:
            print("\nESPN events not mapped to seed (knockout / unknown teams):")
            for line in unmapped:
                print(f"  {line}")
        return 0

    sql = generate_sql(results, f"ESPN scoreboard {start}..{end}")

    if args.stdout or not args.out:
        print(sql)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(sql, encoding="utf-8")
        print(f"Wrote {args.out} ({len(results)} matches)", file=sys.stderr)
        for r in results:
            expected = expected_goal_events(r.home_score, r.away_score)
            if len(r.goals) < expected:
                print(
                    f"warning: {r.match_id} goals {len(r.goals)}/{expected} — verify JSON in SQL",
                    file=sys.stderr,
                )

    if unmapped and not args.stdout:
        print("\nUnmapped ESPN events:", file=sys.stderr)
        for line in unmapped:
            print(f"  {line}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
