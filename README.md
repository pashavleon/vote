# TOP FAN VOTE — World Cup 2026 fan polls

Unofficial **WC 2026 vote** hub: tournament winner, favorite team, and group-stage match predictions. Static site on GitHub Pages + Supabase.

- **Site:** https://topfan.vote/
- **SEO / indexing:** [SEO-WC-2026.md](SEO-WC-2026.md), [SEO-INDEXING.md](SEO-INDEXING.md)
- **Supabase setup:** [README-SUPABASE.md](README-SUPABASE.md)

## Pages

| URL | Poll |
|-----|------|
| `/` | Hub — three poll types |
| `/winner.html` | Tournament winner (48 teams) |
| `/favorite.html` | Favorite team (support poll) |
| `/matches.html` | Group-stage match predictions |
| `/arch.html` | Poll archive |
| `/ucl.html` | UCL Final 2026 (legacy) |

## Structure

| Path | Description |
|------|-------------|
| `index.html` | Home hub |
| `js/hub.js` | Poll UI (winner, favorite, matches) |
| `js/config.js` | Supabase URL and anon key |
| `assets/` | Portal chip images, flags |
| `supabase/` | Schema and seed SQL |

## GitHub Pages

**Settings → Pages:** branch `main`, folder `/ (root)`. Custom domain: `topfan.vote` (`CNAME` in repo).
