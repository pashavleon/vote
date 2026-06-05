#!/usr/bin/env python3
"""Generate static SEO HTML blocks for WC 2026 teams (crawler-visible)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT.parent / "docs" / "cl-vote-mockup" / "supabase" / "_gen_seed_wc2026.py"


def load_data() -> tuple[dict, dict]:
    text = GEN.read_text(encoding="utf-8")
    ns: dict = {"__file__": str(GEN)}
    exec(compile(text, str(GEN), "exec"), ns)  # noqa: S102
    return ns["TEAMS"], ns["GROUP_FIXTURES"]


def teams_by_group(fixtures: dict) -> dict[str, list[str]]:
    out: dict[str, set[str]] = {}
    for g, rows in fixtures.items():
        s: set[str] = set()
        for h, a, *_ in rows:
            s.add(h)
            s.add(a)
        out[g] = s
    return {g: sorted(out[g], key=lambda t: ns_teams[t][0]) for g in sorted(out)}


def team_li(tid: str, teams: dict, page: str) -> str:
    name = teams[tid][0]
    href = "winner.html"
    return (
        f'<li><a href="{href}">{name} World Cup 2026</a> — '
        f'fan poll &amp; winner predictions</li>'
    )


ns_teams: dict = {}


def teams_section(teams: dict, page: str) -> str:
    ids = sorted(teams, key=lambda t: teams[t][0])
    items = "\n          ".join(team_li(t, teams, page) for t in ids)
    return f"""      <section class="page-seo page-seo--teams" aria-labelledby="wc-teams-seo-title">
        <h2 id="wc-teams-seo-title" class="page-seo__title">World Cup 2026 teams — all 48 nations</h2>
        <p class="page-seo__lead">Vote in our unofficial fan poll for tournament winner and group matches. Every qualified nation:</p>
        <ul class="page-seo__teams">
          {items}
        </ul>
      </section>"""


def _fmt_kickoff(iso: str) -> str:
    from datetime import datetime

    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y, %H:%M UTC")
    except ValueError:
        return iso


def fixtures_section(teams: dict, fixtures: dict) -> str:
    rows: list[str] = []
    for g in sorted(fixtures):
        for home, away, kickoff, venue in fixtures[g]:
            label = f"{teams[home][0]} vs {teams[away][0]}"
            when = _fmt_kickoff(kickoff)
            rows.append(
                f"""        <li>
          <strong>Group {g}</strong> — {label}: {when}, {venue}.
          <span class="page-seo__fixture-meta">World Cup 2026 kick-off time, stadium, TV listings via FIFA and Live Soccer TV.</span>
        </li>"""
            )
    inner = "\n".join(rows)
    return f"""      <section class="page-seo page-seo--fixtures" aria-labelledby="wc-fixtures-seo-title">
        <h2 id="wc-fixtures-seo-title" class="page-seo__title">World Cup 2026 fixtures — time, venue &amp; TV</h2>
        <p class="page-seo__lead">Group-stage schedule (72 matches). Tap the info icon on each match card for local kick-off times and where-to-watch links.</p>
        <ul class="page-seo__fixtures">
{inner}
        </ul>
      </section>"""


def groups_section(teams: dict, fixtures: dict) -> str:
    blocks: list[str] = []
    for g in sorted(fixtures):
        tids = sorted({t for h, a, *_ in fixtures[g] for t in (h, a)}, key=lambda t: teams[t][0])
        team_names = ", ".join(teams[t][0] for t in tids)
        open_h, open_a, _, _ = fixtures[g][0]
        opener = f"{teams[open_h][0]} vs {teams[open_a][0]}"
        blocks.append(
            f"""        <li>
          <strong>Group {g}</strong>: {team_names}.
          <a href="matches.html">Predict Group {g} matches</a>
          (opener: {opener}).
        </li>"""
        )
    inner = "\n".join(blocks)
    return f"""      <section class="page-seo page-seo--groups" aria-labelledby="wc-groups-seo-title">
        <h2 id="wc-groups-seo-title" class="page-seo__title">World Cup 2026 groups A–L</h2>
        <p class="page-seo__lead">12 groups of four teams — 72 group-stage matches, three games per nation:</p>
        <ul class="page-seo__groups">
{inner}
        </ul>
      </section>"""


def itemlist_json(teams: dict, page_url: str) -> str:
    ids = sorted(teams, key=lambda t: teams[t][0])
    items = [
        {
            "@type": "ListItem",
            "position": i + 1,
            "item": {
                "@type": "SportsTeam",
                "name": teams[t][0],
                "sport": "Soccer",
                "memberOf": {
                    "@type": "SportsEvent",
                    "name": "FIFA World Cup 2026",
                },
            },
        }
        for i, t in enumerate(ids)
    ]
    graph = {
        "@type": "ItemList",
        "name": "FIFA World Cup 2026 qualified teams",
        "numberOfItems": len(ids),
        "itemListElement": items,
        "url": page_url,
    }
    return json.dumps(graph, ensure_ascii=False, indent=2)


def patch_file(path: Path, marker: str, content: str) -> None:
    text = path.read_text(encoding="utf-8")
    start = f"<!-- {marker}:start -->"
    end = f"<!-- {marker}:end -->"
    if start not in text or end not in text:
        print(f"SKIP {path.name}: markers {marker} not found", file=sys.stderr)
        return
    new = re.sub(
        re.escape(start) + r"[\s\S]*?" + re.escape(end),
        start + "\n" + content + "\n      " + end,
        text,
        count=1,
    )
    path.write_text(new, encoding="utf-8")
    print(f"Patched {path.name} ({marker})")


def patch_json_ld_itemlist(path: Path, page_url: str, teams: dict) -> None:
    text = path.read_text(encoding="utf-8")
    item = itemlist_json(teams, page_url)
    block = ",\n    " + item
    needle = '  ]\n}'
    if '"@type": "ItemList"' in text:
        print(f"SKIP {path.name}: ItemList already present")
        return
    if needle not in text:
        print(f"SKIP {path.name}: JSON-LD graph end not found", file=sys.stderr)
        return
    text = text.replace(needle, block + "\n  ]\n}", 1)
    path.write_text(text, encoding="utf-8")
    print(f"Patched {path.name} (ItemList JSON-LD)")


def main() -> int:
    global ns_teams
    teams, fixtures = load_data()
    ns_teams = teams

    index = ROOT / "index.html"
    winner = ROOT / "winner.html"
    matches = ROOT / "matches.html"

    patch_file(index, "wc-teams-seo", teams_section(teams, "index"))
    patch_file(winner, "wc-teams-seo", teams_section(teams, "winner"))
    patch_file(matches, "wc-groups-seo", groups_section(teams, fixtures))
    patch_file(matches, "wc-fixtures-seo", fixtures_section(teams, fixtures))

    patch_json_ld_itemlist(index, "https://pashavleon.github.io/vote/", teams)
    patch_json_ld_itemlist(winner, "https://pashavleon.github.io/vote/winner.html", teams)

    return 0


if __name__ == "__main__":
    sys.exit(main())
