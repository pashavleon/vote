# Social story banners (1080×1920)

HTML templates for **Instagram Stories** and **Telegram Stories** — same 9:16 format.

## Files

| File | Use with post |
|------|----------------|
| `story-winner.html` / `story-winner.png` | Tournament winner poll |
| `story-artan.html` / `story-artan.png` | Omar Artan news article |
| `story-matches.html` / `story-matches.png` | Match predictions |
| `story-football-soccer-en.png` | Football vs soccer meme — EN slogan |
| `story-football-soccer-ru.png` | Football vs soccer meme — RU slogan |
| `x-card-artan.html` / `x-card-artan.png` | X link preview — Post 2 |
| `x-card-matches.html` / `x-card-matches.png` | X link preview — Post 3 |

Copy text: `docs/social/reddit-x-posts.md`

## Export to PNG

1. Open the `.html` file in Chrome or Edge (local file is fine).
2. DevTools → toggle device toolbar → set **1080 × 1920** (or zoom until the canvas fills).
3. Screenshot, or run from repo root:

```bash
npx --yes puppeteer-cli screenshot assets/social/story-winner.html story-winner.png --viewport 1080x1920
```

Repeat for each story file. Upload PNG to IG/TG; add link sticker (IG) or link in caption (TG).

## Brand colors

- Background `#05080c`
- Green `#00A651`
- Gold `#F5C518`
- Text `#e8edf4`
