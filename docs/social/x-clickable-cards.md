# X (Twitter) — clickable link preview cards

On X you **cannot** attach a PNG and make it clickable. The clickable “banner” is a **link preview card**: X reads `og:image` + `twitter:card` from the destination URL and renders a large tappable card.

## How to post (Posts 2 & 3)

1. **Deploy** so OG images are live on topfan.vote (see files below).
2. Open X → compose tweet.
3. Paste **only the URL** — do **not** attach `story-*.png` or `x-card-*.png` manually.
4. Wait for the preview card to appear (large image + title + description).
5. Add your tweet text **above** the card.
6. Publish.

### Post 2 — Artan

**URL (must be in tweet):**  
`https://topfan.vote/news/omar-artan-referee-denied.html`

**Card image (auto):** `assets/social/x-card-artan.png` via OG tags

**Example tweet:**
```
He had the visa. He had FIFA's call. Miami said no.

Somalia's first World Cup referee — sent home before kickoff.

https://topfan.vote/news/omar-artan-referee-denied.html

#WorldCup2026 #Somalia #FootballNews
```

### Post 3 — Matches

**URL:**  
`https://topfan.vote/matches.html`

**Card image (auto):** `assets/social/x-card-matches.png`

**Example tweet:**
```
Mexico vs South Africa opens the World Cup.

How are fans calling every group match?

https://topfan.vote/matches.html

#WorldCup2026 #WC2026 #MatchPredictions
```

## Do / Don't

| Do | Don't |
|----|--------|
| Paste URL, let X build the card | Attach PNG + URL (X often hides the card) |
| Put URL on its own line | Use link shorteners for first post (cache issues) |
| Re-validate after deploy | Expect instant update — X caches cards |

## Refresh card cache after deploy

1. [Twitter Card Validator](https://cards-dev.twitter.com/validator) (legacy but still works for many accounts), or  
2. Post once from a test account; or  
3. X Premium → post analytics sometimes refreshes preview on re-edit.

Paste the article URL → **Preview card** → confirm image is `x-card-artan.png` or `x-card-matches.png`.

## Files

| Asset | Size | Used by |
|-------|------|---------|
| `x-card-artan.png` | 1200×628 | OG/Twitter on Artan article |
| `x-card-matches.png` | 1200×628 | OG/Twitter on matches.html |
| `x-card-artan.html` | — | Editable source; export PNG if needed |
| `x-card-matches.html` | — | Editable source |

**IG/TG stories** still use vertical `story-artan.png` / `story-matches.png` — different format, not clickable on X.

## OG tags (already on site)

```html
<meta name="twitter:card" content="summary_large_image" />
<meta property="og:image" content="https://topfan.vote/assets/social/x-card-artan.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="628" />
<meta name="twitter:image" content="https://topfan.vote/assets/social/x-card-artan.png" />
<meta name="twitter:image:alt" content="..." />
```

After pushing to GitHub Pages, wait ~1–2 min, then validate the URL.
