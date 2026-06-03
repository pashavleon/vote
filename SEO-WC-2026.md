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
