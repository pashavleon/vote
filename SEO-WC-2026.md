# World Cup 2026 — SEO & indexing (English)

Property in Google Search Console: **`https://pashavleon.github.io/vote/`**

Operational checklist: see [SEO-INDEXING.md](./SEO-INDEXING.md) (sitemap, GSC, `.nojekyll`).

---

## Product positioning (what we rank for)

| We are | We are not |
|--------|------------|
| Unofficial **fan poll** with live aggregated votes | Official FIFA / bookmaker / news site |
| **Vote** on tournament winner (48 teams) and **match winners** | Live scores, streaming, tickets |
| Fast mobile page, instant results | Deep stats (xG, lineups) |

Copy and schema must repeat: *unofficial fan poll*, *not affiliated with FIFA* — builds trust and avoids implied endorsement.

---

## Search intent clusters (English)

### 1. Tournament / brand (high volume, very competitive)

| Query pattern | Intent | Target page |
|---------------|--------|-------------|
| world cup 2026 | Info/nav | Home |
| fifa world cup 2026 | Info/nav | Home |
| 2026 world cup | Info/nav | Home |
| wc 2026 | Short nav | Home |

**Title tip:** lead with *World Cup 2026*; use *FIFA* in description/FAQ, not necessarily in `<title>` (trademark sensitivity).

### 2. Winner / outright (core for FanVote)

| Query pattern | Intent | Target page |
|---------------|--------|-------------|
| who will win world cup 2026 | Prediction | **winner.html** + Home |
| world cup 2026 winner predictions | Prediction | winner.html |
| who will win the 2026 fifa world cup | Prediction | winner.html |
| world cup 2026 favorites | Prediction / odds adjacency | winner.html |
| world cup 2026 winner odds | Betting (adjacent) | winner.html — fan poll angle |
| spain france england world cup 2026 favorite | Team-specific | winner.html (48-team grid) |

Editorial hooks (from pre-tournament media, June 2026): Spain, France, England, Argentina, Brazil, Portugal often named as favorites — mention in FAQ as context, not as betting advice.

### 3. Hosts / schedule / format (supporting content)

| Query pattern | Intent | Target page |
|---------------|--------|-------------|
| world cup 2026 schedule | Schedule | Home FAQ |
| world cup 2026 start date | When | Home FAQ — **11 June 2026** |
| world cup 2026 final date | When | Home FAQ — **19 July 2026** |
| usa mexico canada world cup 2026 | Hosts | Home |
| world cup 2026 host cities | Venues | Home FAQ — 16 cities |
| 48 teams world cup 2026 | Format | Home + matches |
| 104 matches world cup 2026 | Format | Home FAQ |

### 4. Group stage & matches (matches page)

| Query pattern | Intent | Target page |
|---------------|--------|-------------|
| world cup 2026 groups | Draw / tables | **matches.html** + Home |
| world cup 2026 group stage | Stage | matches.html |
| world cup 2026 group a / b … | Group-specific | matches.html (dynamic groups) |
| world cup 2026 match predictions | Prediction | matches.html |
| predict world cup 2026 games | Prediction | matches.html |
| mexico vs south africa world cup 2026 | Match | matches.html (when fixture visible) |
| usa vs paraguay world cup 2026 | Match | matches.html |

### 5. Fan poll / community (differentiator)

| Query pattern | Intent | Target page |
|---------------|--------|-------------|
| world cup 2026 fan poll | Exact fit | Home |
| world cup 2026 vote | Exact fit | Home |
| world cup 2026 predictor | Tool | Home / winner |
| fan vote world cup 2026 | Exact fit | Home |

### 6. Long-tail / archive

| Query pattern | Intent | Target page |
|---------------|--------|-------------|
| ucl final 2026 fan poll | Past event | ucl.html |
| champions league final 2026 poll | Past | ucl.html |
| fanvote archive | Brand | arch.html |

---

## Page-level SEO map

| URL | Primary keyword focus | Title (≤60 chars) |
|-----|----------------------|-------------------|
| `/vote/` | world cup 2026 fan poll | World Cup 2026 Fan Poll — Who Will Win? Live \| FanVote |
| `/vote/winner.html` | who will win world cup 2026 | Who Will Win World Cup 2026? Live Fan Poll \| 48 Teams |
| `/vote/matches.html` | world cup 2026 match predictions | World Cup 2026 Match Predictions — Group Stage Fan Poll |
| `/vote/arch.html` | fan poll archive | Fan Poll Archive — World Cup 2026 & UCL \| FanVote |
| `/vote/ucl.html` | arsenal psg ucl final 2026 poll | (unchanged — UCL niche) |

**Canonical:** each page → its own URL (fix UCL: `ucl.html`, not `/`).

**OG image:**

| Page | Image |
|------|--------|
| Home, winner | `assets/winner-silhouettes-1280.jpg` |
| matches | `assets/groups-tilted-1280.jpg` |

---

## Structured data (JSON-LD)

| Page | Types |
|------|--------|
| Home | `WebSite`, `SportsEvent` (WC 2026), `FAQPage` |
| winner | `WebPage`, `FAQPage` |
| matches | `WebPage`, `FAQPage` |
| arch | `WebPage`, `CollectionPage` |
| ucl | existing `WebPage` + `SportsEvent` + `FAQPage` |

`SportsEvent` facts (aligned with seed):

- Name: FIFA World Cup 2026  
- startDate: 2026-06-11  
- endDate: 2026-07-19  
- location: USA, Mexico, Canada (multiple host countries)

---

## Indexing rollout

1. Deploy meta + JSON-LD + visible FAQ on Home.  
2. GSC → **URL inspection** → request indexing for:
   - `https://pashavleon.github.io/vote/`
   - `https://pashavleon.github.io/vote/winner.html`
   - `https://pashavleon.github.io/vote/matches.html`
3. Resubmit `sitemap.xml` (lastmod updated).  
4. After group stage kicks off: optional blog/Telegram posts with deep links to `matches.html?` (groups) — earns match long-tail.  
5. Optional phase 2: `/vote/groups.html` static landing with group table (extra indexable URL) — not required for v1.

---

## Content rules (avoid misleading snippets)

- Do not claim “official” or “FIFA endorsed”.  
- Snippets may say “live fan poll” / “instant results after you vote”.  
- Do not promise betting odds; “see how fans vote” is fine.  
- Update FAQ when voting closes or tournament ends.

---

## Keywords meta tag (reference — Home)

```
World Cup 2026, FIFA World Cup 2026, fan poll, who will win World Cup 2026,
World Cup 2026 predictions, World Cup 2026 groups, match predictions,
USA Mexico Canada 2026, group stage, unofficial poll
```

Google largely ignores `keywords`; still useful for internal consistency.

---

## Competitors (SERPs to watch)

News / odds: ESPN, BBC, FIFA.com, Flashscore, Yahoo Sports, Opta Analyst.  
We compete on **long-tail**: *fan poll*, *vote*, *predict every match*, not on breaking news.

---

## Metrics (GSC)

Track impressions/clicks for:

- `world cup 2026 fan poll`  
- `who will win world cup 2026`  
- `world cup 2026 groups`  
- `world cup 2026 match predictions`  

Compare before/after 4–6 weeks post-indexing request.

---

## Why zero traffic (diagnosis, May 2026)

| Factor | Impact |
|--------|--------|
| **CSR-only grids** | `winner.html` / `matches.html` showed only “Loading…” to crawlers — no team or fixture text in HTML. **Fixed:** static `page-seo` blocks + `ItemList` JSON-LD on Home and Winner; groups block on Matches. |
| **Head-term competition** | “World Cup 2026”, “schedule”, “streaming”, “tickets” dominated by FIFA, news, travel — we cannot win those without authority. |
| **No backlinks / brand** | New GitHub Pages subdomain, no mentions, no social proof. |
| **Indexing lag** | GSC request + sitemap alone take 2–8 weeks; tournament spike starts ~4 weeks before kickoff. |
| **Niche mismatch** | We rank for *fan poll / vote / predict* — volume is 10–100× lower than schedule or streaming. |

**Regenerate team SEO after roster changes:**

```bash
python scripts/gen_wc_teams_seo.py
python scripts/validate_teams_seo.py   # 48/48 on index + winner
```

---

## Top search clusters (English, pre-tournament 2026)

Prioritize content we can honestly satisfy. Volume tiers are relative (not exact Google numbers).

### Tier A — schedule & logistics (huge volume, low fit)

| Queries | Our angle |
|---------|-----------|
| world cup 2026 schedule / fixtures / dates | FAQ on Home only — do not build a full schedule product |
| world cup 2026 tickets / hotels / flights | Out of scope |
| world cup 2026 streaming / where to watch | Out of scope |
| world cup 2026 host cities / venues | One FAQ line + group opener text on Matches SEO block |

### Tier B — tournament narrative (high volume, partial fit)

| Queries | Target |
|---------|--------|
| world cup 2026 groups / group stage / draw | matches.html + static groups SEO |
| world cup 2026 qualified teams / 48 teams | index + winner team lists |
| world cup 2026 format / 104 matches | Home FAQ |
| world cup 2026 favorites / odds / predictions | winner.html |
| who will win world cup 2026 | winner.html (primary) |
| spain / france / england / argentina / brazil world cup 2026 | Team lines on index + winner |
| messi / mbappe world cup 2026 | Optional FAQ sentence — no player pages v1 |

### Tier C — exact product fit (lower volume, winnable)

| Queries | Target |
|---------|--------|
| world cup 2026 fan poll / fan vote | Home |
| world cup 2026 predictor (fan) | Home, winner |
| world cup 2026 match predictions fan | matches.html |
| predict world cup 2026 games | matches.html |
| mexico vs south africa world cup 2026 | matches groups SEO (opener) |
| usa vs paraguay world cup 2026 | matches groups SEO |
| world cup 2026 group a predictions | matches.html Group A block |

### Tier D — long-tail per team (48 × patterns)

Pattern: `{Country} world cup 2026`, `{Country} world cup 2026 winner odds`, `will {Country} win world cup 2026`.

**Coverage:** each of 48 nations appears in static HTML on **index.html** and **winner.html** (validated by `validate_teams_seo.py`). **matches.html** lists every team inside group paragraphs.

### Tier E — post-kickoff spikes (plan ahead)

| Queries | Action when stage opens |
|---------|-------------------------|
| world cup 2026 results / standings | Not our product — link FAQ to official sources |
| world cup 2026 round of 32 predictions | Enable knockout voting + update matches meta |
| `{team} vs {team} world cup 2026 prediction` | Dynamic `<title>` per visible stage in hub.js (phase 2) |

---

## Optimization roadmap (English)

**Done (v1.1)**

- Chevron fix for group collapse (CSS, no broken minus glyph).
- Static team/group SEO HTML + ItemList schema.
- Sitemap `lastmod` refresh.

**Next — high ROI**

1. GSC: URL inspection → **Request indexing** for `/`, `winner.html`, `matches.html`.
2. Add 2–3 external links (Reddit r/soccer, personal X/Telegram, project README) — even one DR30+ link helps.
3. Expand Home `keywords` / description with “fan vote”, “unofficial poll” (not head terms).
4. **Phase 2:** `document.title` on matches when user picks stage/group (`World Cup 2026 Group D predictions`).
5. **Phase 2:** `groups.html` or `/teams/spain.html` only if GSC shows impressions but low CTR for team long-tail.

**Do not**

- Fake “live scores” or copy FIFA schedule tables wholesale (copyright + wrong intent).
- Buy traffic or keyword-stuff 48 teams into `<title>`.
