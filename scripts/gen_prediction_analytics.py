#!/usr/bin/env python3
"""
Fetch finished match polls from Supabase and compute fan prediction accuracy.

Usage:
  python scripts/gen_prediction_analytics.py
  python scripts/gen_prediction_analytics.py --out supabase/generated/prediction-analytics.json
  python scripts/gen_prediction_analytics.py --article news/fan-prediction-scorecard.html
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "js" / "config.js"
DEFAULT_JSON = ROOT / "supabase" / "generated" / "prediction-analytics.json"

CHOICE_LABEL = {"home": "Home win", "draw": "Draw", "away": "Away win"}


def load_supabase_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_m = re.search(r"supabaseUrl:\s*'([^']+)'", text)
    key_m = re.search(r"supabaseAnonKey:\s*'([^']+)'", text)
    if not url_m or not key_m:
        raise SystemExit(f"Could not parse Supabase config from {CONFIG_PATH}")
    return url_m.group(1).rstrip("/"), key_m.group(1)


def rpc(base_url: str, key: str, name: str, params: dict, timeout: float = 60) -> object:
    url = f"{base_url}/rest/v1/rpc/{name}"
    body = json.dumps(params).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def unwrap_rpc(data: object) -> dict | None:
    if data is None:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    return data


def choice_label(choices: list[dict], choice_id: str | None) -> str:
    if not choice_id:
        return "—"
    for c in choices:
        if c.get("id") == choice_id:
            return str(c.get("label") or choice_id)
    return CHOICE_LABEL.get(choice_id, choice_id)


def fixture_label(home: str, away: str) -> str:
    return f"{home.upper()} vs {away.upper()}"


def build_analytics(base_url: str, key: str) -> dict:
    polls = rpc(
        base_url,
        key,
        "get_active_polls",
        {"p_event_id": "wc-2026", "p_poll_type": "match_winner", "p_limit": 200, "p_offset": 0},
    )
    if not isinstance(polls, list):
        raise SystemExit("get_active_polls returned unexpected shape")

    matches: list[dict] = []
    for row in polls:
        detail = unwrap_rpc(rpc(base_url, key, "get_poll_detail", {"p_poll_id": row["poll_id"]}))
        if not detail:
            continue
        match = detail.get("match") or {}
        if match.get("match_status") != "finished":
            continue

        choices = detail.get("choices") or []
        total = int(detail.get("total_votes") or 0)
        correct = int(detail.get("correct_vote_count") or 0)
        result_id = match.get("result_choice_id")

        fav_id = None
        fav_pct = 0.0
        for c in choices:
            pct = float(c.get("pct") or 0)
            if pct > fav_pct:
                fav_pct = pct
                fav_id = c.get("id")

        crowd_right = fav_id == result_id if result_id and fav_id else None
        accuracy = round(100 * correct / total, 1) if total else None

        matches.append(
            {
                "poll_id": row["poll_id"],
                "match_id": match.get("id"),
                "group_code": match.get("group_code"),
                "stage": match.get("stage"),
                "home_team_id": match.get("home_team_id"),
                "away_team_id": match.get("away_team_id"),
                "home_score": match.get("home_score"),
                "away_score": match.get("away_score"),
                "kickoff_at": match.get("kickoff_at"),
                "result_choice_id": result_id,
                "result_label": choice_label(choices, result_id),
                "total_votes": total,
                "correct_votes": correct,
                "accuracy_pct": accuracy,
                "crowd_favorite_id": fav_id,
                "crowd_favorite_label": choice_label(choices, fav_id),
                "crowd_favorite_pct": round(fav_pct, 1),
                "crowd_majority_right": crowd_right,
                "fixture": fixture_label(match.get("home_team_id", ""), match.get("away_team_id", "")),
                "choices": [
                    {
                        "id": c.get("id"),
                        "label": c.get("label"),
                        "pct": c.get("pct"),
                        "vote_count": c.get("vote_count"),
                    }
                    for c in choices
                ],
            }
        )

    matches.sort(key=lambda m: m.get("kickoff_at") or "")

    with_votes = [m for m in matches if m["total_votes"] > 0]
    total_votes = sum(m["total_votes"] for m in matches)
    total_correct = sum(m["correct_votes"] for m in matches)
    overall = round(100 * total_correct / total_votes, 1) if total_votes else 0.0
    crowd_right_n = sum(1 for m in with_votes if m["crowd_majority_right"])

    group_stats: dict[str, dict] = {}
    for m in with_votes:
        g = m.get("group_code") or "—"
        if g not in group_stats:
            group_stats[g] = {"matches": 0, "votes": 0, "correct": 0}
        group_stats[g]["matches"] += 1
        group_stats[g]["votes"] += m["total_votes"]
        group_stats[g]["correct"] += m["correct_votes"]

    for g, st in group_stats.items():
        st["accuracy_pct"] = round(100 * st["correct"] / st["votes"], 1) if st["votes"] else 0.0

    hardest = sorted(with_votes, key=lambda m: m["accuracy_pct"] or 0)
    easiest = sorted(with_votes, key=lambda m: -(m["accuracy_pct"] or 0))
    crowd_misses = sorted(
        [m for m in with_votes if m["crowd_majority_right"] is False],
        key=lambda m: -m["crowd_favorite_pct"],
    )

    return {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "summary": {
            "finished_matches": len(matches),
            "matches_with_votes": len(with_votes),
            "matches_without_votes": len(matches) - len(with_votes),
            "total_votes": total_votes,
            "total_correct": total_correct,
            "overall_accuracy_pct": overall,
            "crowd_majority_right": crowd_right_n,
            "crowd_majority_wrong": len(with_votes) - crowd_right_n,
        },
        "highlights": {
            "hardest": hardest[:5],
            "easiest": easiest[:5],
            "biggest_crowd_misses": crowd_misses[:5],
        },
        "by_group": group_stats,
        "matches": matches,
    }


def pct_str(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:.1f}%"


def write_article(data: dict, path: Path) -> None:
    s = data["summary"]
    today = datetime.now().strftime("%Y-%m-%d")
    finished = s["finished_matches"]
    overall = s["overall_accuracy_pct"]
    votes = s["total_votes"]
    correct = s["total_correct"]
    crowd_ok = s["crowd_majority_right"]
    crowd_total = s["matches_with_votes"]
    crowd_pct = round(100 * crowd_ok / crowd_total, 1) if crowd_total else 0

    def row(m: dict) -> str:
        acc = pct_str(m["accuracy_pct"])
        score = f"{m['home_score']}–{m['away_score']}"
        fav = m["crowd_favorite_label"]
        fav_pct = m["crowd_favorite_pct"]
        result = m["result_label"]
        miss = m["crowd_majority_right"] is False
        note = f"Fans backed {fav} ({fav_pct}%) — result {result}" if miss else f"Crowd lean {fav} ({fav_pct}%)"
        return (
            f"<tr><td>{m['fixture']}</td><td>{score}</td>"
            f"<td>{result}</td><td>{m['total_votes']}</td><td>{acc}</td>"
            f"<td>{note}</td></tr>"
        )

    table_rows = "\n          ".join(row(m) for m in data["matches"] if m["total_votes"] > 0)

    highlights_html = ""
    for m in data["highlights"]["biggest_crowd_misses"][:3]:
        highlights_html += (
            f"<li><strong>{m['fixture']}</strong> ({m['home_score']}–{m['away_score']}) — "
            f"{m['crowd_favorite_pct']}% picked {m['crowd_favorite_label']}; "
            f"actual: {m['result_label']}.</li>\n          "
        )

    group_rows = ""
    for g in sorted(data["by_group"].keys()):
        st = data["by_group"][g]
        group_rows += (
            f"<tr><td>Group {g}</td><td>{st['matches']}</td>"
            f"<td>{st['votes']}</td><td>{st['accuracy_pct']:.1f}%</td></tr>\n          "
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WC 2026 Fan Prediction Scorecard — Who Got It Right? | TOP FAN VOTE</title>
  <meta name="description" content="How accurate are World Cup 2026 fan match predictions? {overall}% of votes matched the result across {finished} finished group games — crowd majority right on {crowd_ok} of {crowd_total} matches." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://topfan.vote/news/fan-prediction-scorecard.html" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="TOP FAN VOTE" />
  <meta property="og:title" content="WC 2026 fan prediction scorecard — {overall}% accuracy so far" />
  <meta property="og:description" content="{correct:,} correct votes out of {votes:,} on finished group matches. See which fixtures fooled the crowd." />
  <meta property="og:url" content="https://topfan.vote/news/fan-prediction-scorecard.html" />
  <meta property="og:image" content="https://topfan.vote/assets/winner-silhouettes-1280.jpg" />
  <meta property="article:published_time" content="{today}" />
  <meta property="article:modified_time" content="{today}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Fan prediction scorecard — WC 2026 group stage" />
  <meta name="twitter:description" content="{overall}% of fan votes called the right winner across {finished} finished matches." />
  <meta name="twitter:image" content="https://topfan.vote/assets/winner-silhouettes-1280.jpg" />
  <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "Article",
      "headline": "WC 2026 fan prediction scorecard",
      "description": "Accuracy of fan match predictions on TOP FAN VOTE across finished group-stage fixtures.",
      "url": "https://topfan.vote/news/fan-prediction-scorecard.html",
      "datePublished": "{today}",
      "dateModified": "{today}",
      "author": {{ "@type": "Organization", "name": "TOP FAN VOTE" }},
      "publisher": {{ "@type": "Organization", "name": "TOP FAN VOTE", "url": "https://topfan.vote/" }}
    }},
    {{
      "@type": "BreadcrumbList",
      "itemListElement": [
        {{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://topfan.vote/" }},
        {{ "@type": "ListItem", "position": 2, "name": "Hot takes", "item": "https://topfan.vote/news/" }},
        {{ "@type": "ListItem", "position": 3, "name": "Prediction scorecard", "item": "https://topfan.vote/news/fan-prediction-scorecard.html" }}
      ]
    }}
  ]
}}
  </script>
  <link rel="stylesheet" href="../css/hub.css" />
</head>
<body data-page="news">
  <div class="shell">
    <header class="site-header">
      <a class="logo logo--home" href="/" aria-label="TOP FAN VOTE home"><span class="logo__line">TOP FAN</span><span class="logo__line logo__line--vote">VOTE</span></a>
      <nav class="topnav topnav--split" aria-label="Site">
        <div class="topnav-polls" aria-label="Polls">
          <a href="../winner.html">Winner</a>
          <a href="../favorite.html">Favorite</a>
          <a href="../matches.html">Matches</a>
        </div>
        <a href="/news/" class="topnav-link is-active">Hot takes</a>
        <a href="../arch.html" class="topnav-arch">Archive</a>
      </nav>
    </header>

    <main class="page-main news-article">
      <nav class="news-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span class="news-breadcrumb__sep">›</span>
        <a href="/news/">Hot takes</a><span class="news-breadcrumb__sep">›</span>
        <span>Prediction scorecard</span>
      </nav>
      <nav class="news-vote-bar" aria-label="Cast your vote">
        <span class="news-vote-bar__label">Vote</span>
        <a href="../winner.html">Winner</a>
        <a href="../favorite.html">Favorite</a>
        <a href="../matches.html">Matches</a>
      </nav>

      <header>
        <p class="news-article__tag">Fan data</p>
        <h1 class="news-article__title">Who got it right? WC 2026 fan prediction scorecard</h1>
        <p class="news-article__meta">Updated {today} · {finished} finished group matches · unofficial poll, not FIFA</p>
      </header>

      <div class="news-article__body">
        <p>
          Fans on TOP FAN VOTE pick a winner (or draw) before each group game. Once the score is in,
          we count how many votes matched the actual result. This is live data from our poll — not betting
          advice, not a bookmaker line.
        </p>

        <section class="news-section">
          <p class="news-section__label">The numbers</p>
          <h2>{overall}% of votes called the right outcome</h2>
          <ul>
            <li><strong>{votes:,} votes</strong> across <strong>{finished}</strong> finished group-stage matches ({s['matches_with_votes']} with at least one vote).</li>
            <li><strong>{correct:,} correct</strong> predictions — about <strong>{overall}%</strong> overall accuracy.</li>
            <li><strong>Crowd majority</strong> (the option with the highest share) matched the result on <strong>{crowd_ok} of {crowd_total}</strong> matches ({crowd_pct}%).</li>
          </ul>
          <p>
            In plain language: the “wisdom of the crowd” is decent on obvious home wins, but upsets and
            tight draws still burn a lot of picks.
          </p>
        </section>

        <section class="news-section">
          <p class="news-section__label">Where the crowd whiffed</p>
          <h2>Biggest misses so far</h2>
          <ul>
          {highlights_html}
          </ul>
          <p>
            These are the games where the plurality of fans backed the wrong side — often because a
            favourite looked safe on paper.
          </p>
        </section>

        <section class="news-section">
          <p class="news-section__label">By group</p>
          <h2>Accuracy by group</h2>
          <table>
            <thead>
              <tr><th>Group</th><th>Matches</th><th>Votes</th><th>Accuracy</th></tr>
            </thead>
            <tbody>
          {group_rows}
            </tbody>
          </table>
        </section>

        <section class="news-section">
          <p class="news-section__label">Every finished game</p>
          <h2>Match-by-match breakdown</h2>
          <table>
            <thead>
              <tr>
                <th>Fixture</th><th>Score</th><th>Result</th><th>Votes</th><th>Correct %</th><th>Crowd lean</th>
              </tr>
            </thead>
            <tbody>
          {table_rows}
            </tbody>
          </table>
        </section>

        <section class="news-section">
          <p class="news-section__label">Method</p>
          <h2>How we count</h2>
          <p>
            One vote per match per browser. “Correct” means your pick equals the match outcome
            (home win, draw, or away win) after the game is marked finished in our database.
            Percentages are vote-weighted, not per-user averages.
          </p>
          <p>
            We do not compare to live betting odds in this article — that needs closing lines from
            third-party markets and clearer licensing. If you want that layer next, we can add implied
            probability from public odds for a sample of upsets.
          </p>
        </section>

        <aside class="news-cta">
          <p class="news-cta__title">Still games to play</p>
          <p class="news-cta__text">Group stage is not over — cast your picks before kick-off.</p>
          <p class="news-cta__links">
            <a href="../matches.html?utm_source=news&utm_campaign=prediction-scorecard">Predict matches</a>
            <a href="../winner.html?utm_source=news&utm_campaign=prediction-scorecard">Tournament winner</a>
          </p>
        </aside>

        <p class="news-disclaimer">
          TOP FAN VOTE is an unofficial fan poll. Not affiliated with FIFA. Not betting advice.
          Data snapshot generated {data['generated_at']}.
        </p>
      </div>
    </main>
  </div>
  <script src="../js/site.js"></script>
</body>
</html>
"""
    path.write_text(html, encoding="utf-8")
    print(f"Wrote {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate fan prediction analytics from Supabase")
    parser.add_argument("--out", type=Path, default=DEFAULT_JSON, help="JSON output path")
    parser.add_argument("--article", type=Path, default=None, help="Optional HTML article path")
    args = parser.parse_args()

    base_url, key = load_supabase_config()
    try:
        data = build_analytics(base_url, key)
    except urllib.error.URLError as exc:
        raise SystemExit(f"Supabase request failed: {exc}") from exc

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(
        f"Finished {data['summary']['finished_matches']} matches, "
        f"{data['summary']['total_votes']} votes, "
        f"{data['summary']['overall_accuracy_pct']}% accuracy"
    )
    print(f"Wrote {args.out}")

    article_path = args.article or ROOT / "news" / "fan-prediction-scorecard.html"
    write_article(data, article_path)


if __name__ == "__main__":
    main()
