#!/usr/bin/env python3
"""Generate a VALUES row for supabase/set-match-results.sql.

Examples:
  python scripts/gen_match_results_sql.py wc26-m007 2 1
  python scripts/gen_match_results_sql.py wc26-m007 2 1 -g 23 can "Julian Quinones"
  python scripts/gen_match_results_sql.py wc26-m073 1 1 --note "4-3 pens" --winner home
  python scripts/gen_match_results_sql.py wc26-m007 1 0 --status live
"""

from __future__ import annotations

import argparse
import json
import sys


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def format_row(
    match_id: str,
    home_score: int,
    away_score: int,
    status: str = "finished",
    result_note: str | None = None,
    goals: list[dict] | None = None,
    result_choice_id: str | None = None,
) -> str:
    goals_json = json.dumps(goals or [], ensure_ascii=False)
    note_sql = "null" if result_note is None else f"'{sql_escape(result_note)}'"
    choice_sql = "null" if result_choice_id is None else f"'{result_choice_id}'"

    return (
        f"      (\n"
        f"        '{match_id}'::text,\n"
        f"        {home_score}::smallint,\n"
        f"        {away_score}::smallint,\n"
        f"        '{status}'::text,\n"
        f"        {note_sql}::text,\n"
        f"        '{goals_json}'::jsonb,\n"
        f"        {choice_sql}::text\n"
        f"      )"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate SQL row for set-match-results.sql")
    parser.add_argument("match_id", help="e.g. wc26-m007")
    parser.add_argument("home_score", type=int)
    parser.add_argument("away_score", type=int)
    parser.add_argument(
        "-g", "--goal",
        action="append",
        nargs=3,
        metavar=("MINUTE", "TEAM_ID", "PLAYER"),
        default=[],
        help="goal: minute team_id player_name",
    )
    parser.add_argument("--status", default="finished", choices=("scheduled", "live", "finished", "postponed"))
    parser.add_argument("--note", help="result_note, e.g. '4-3 pens'")
    parser.add_argument("--winner", choices=("home", "away"), help="result_choice_id for knockout pens")
    parser.add_argument("--own-goal", action="store_true", help="mark last -g goal as own goal")
    args = parser.parse_args()

    goals: list[dict] = []
    for minute, team_id, player in args.goal:
        goals.append(
            {
                "minute": int(minute),
                "team_id": team_id,
                "player": player,
                "own_goal": False,
            }
        )
    if args.own_goal and goals:
        goals[-1]["own_goal"] = True

    row = format_row(
        args.match_id,
        args.home_score,
        args.away_score,
        status=args.status,
        result_note=args.note,
        goals=goals,
        result_choice_id=args.winner,
    )
    print(row)
    print("\n-- Paste into VALUES in supabase/set-match-results.sql (add comma before row)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
