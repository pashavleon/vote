#!/usr/bin/env python3
"""Verify all 48 WC teams appear in static HTML on index + winner."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT.parent / "docs" / "cl-vote-mockup" / "supabase" / "_gen_seed_wc2026.py"
PAGES = ("index.html", "winner.html")


def team_names() -> list[str]:
    text = GEN.read_text(encoding="utf-8")
    ns: dict = {"__file__": str(GEN)}
    exec(compile(text, str(GEN), "exec"), ns)  # noqa: S102
    teams: dict = ns["TEAMS"]
    return sorted(v[0] for v in teams.values())


def count_in(html: str, name: str) -> int:
    return len(re.findall(re.escape(name), html, re.IGNORECASE))


def main() -> int:
    names = team_names()
    errors: list[str] = []
    print(f"Expect {len(names)} teams on each of: {', '.join(PAGES)}\n")

    for page in PAGES:
        html = (ROOT / page).read_text(encoding="utf-8")
        missing = [n for n in names if count_in(html, n) < 1]
        has_itemlist = '"@type": "ItemList"' in html
        print(f"{page}: {len(names) - len(missing)}/{len(names)} teams, ItemList={has_itemlist}")
        if missing:
            errors.append(f"{page} missing: {', '.join(missing[:8])}" + ("..." if len(missing) > 8 else ""))
        if not has_itemlist:
            errors.append(f"{page}: no ItemList JSON-LD")

    matches = (ROOT / "matches.html").read_text(encoding="utf-8")
    for g in list("ABCDEFGHIJKL"):
        if f"Group {g}" not in matches:
            errors.append(f"matches.html missing Group {g}")

    if errors:
        print("\nFAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("\nPASSED — all teams indexed on index + winner; groups on matches.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
