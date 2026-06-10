# Custom `*.vote` domain on GitHub Pages

Use this checklist to point a domain such as `fanvote.vote` or `wc26.vote` at the FanVote site (`pashavleon/vote`).

## 1. Buy the domain

- Registrar: Namecheap, Cloudflare Registrar, Google Domains successor, etc.
- TLD `.vote` is managed by Afilias/Identity Digital — check availability (e.g. `fanvote.vote`, `worldcup26.vote`).

## 2. Choose URL shape

| Option | GitHub Pages setup | Example |
|--------|-------------------|---------|
| **Apex only** | Apex + `www` CNAME/ALIAS | `fanvote.vote` → site root |
| **Subpath** | Not supported on custom domain without redirect | Avoid `/vote/` on custom domain unless you use a redirect |

**Recommended:** custom domain = **site root** (`https://fanvote.vote/`), not `fanvote.vote/vote/`.

If you keep publishing from `pashavleon.github.io/vote/`:

1. Either move repo to **user/org site** (`pashavleon.github.io` repo root), **or**
2. Use a **new repo** `pashavleon.github.io` with CNAME only to custom domain and deploy the same files at root.

Simplest for current repo: add custom domain in repo settings; GitHub serves the project at **domain root** when CNAME is set on the `vote` project.

## 3. GitHub repository settings

1. Repo → **Settings** → **Pages**
2. **Custom domain:** enter `fanvote.vote` (your domain)
3. Wait for DNS check → **Enforce HTTPS** (enable when available)
4. GitHub creates/updates `CNAME` file in the repo — **do not delete** it after deploy.

## 4. DNS records (at registrar or Cloudflare)

### Apex `fanvote.vote` (recommended with Cloudflare)

| Type | Name | Value |
|------|------|--------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

(GitHub Pages apex IPs — verify current list: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

### `www` (optional)

| Type | Name | Value |
|------|------|--------|
| CNAME | `www` | `pashavleon.github.io` |

## 5. Update FanVote after domain is live

Replace `https://pashavleon.github.io/vote/` in:

| File | What |
|------|------|
| `index.html`, `winner.html`, `matches.html`, `arch.html` | `<link rel="canonical">`, JSON-LD `url` |
| `sitemap.xml` | all `<loc>` |
| `robots.txt` | Sitemap URLs |
| `js/hub-share.js` | `SITE` constant |
| `js/share.js` | `SITE_URL` |
| `SEO-WC-2026.md` | property URL |

Search: `pashavleon.github.io/vote` → replace with `https://YOUR.vote/`

## 6. Google Search Console

1. Add property **URL prefix** `https://fanvote.vote/`
2. Verify via DNS TXT or HTML file
3. Submit `sitemap.xml`
4. **Request indexing** for `/`, `winner.html`, `matches.html`
5. Keep old `github.io/vote` property for 301/redirect monitoring if you add redirects later

## 7. Redirect old URLs (optional but good for SEO)

GitHub project Pages on custom domain usually serves **only** the custom domain when Enforce HTTPS is on. Old `github.io/vote/` may still work — add a note in README or use Cloudflare redirect rule:

`pashavleon.github.io/vote/*` → `https://fanvote.vote/$1` (if you control apex redirect via meta refresh in a stub — limited on GitHub).

Pragmatic approach: leave both live; canonical tags point to `.vote` only.

## 8. Verification checklist

- [ ] `https://fanvote.vote/` loads home with trophy + quick ballot
- [ ] `https://fanvote.vote/CNAME` or Pages settings shows **DNS correct**
- [ ] TLS certificate active (padlock)
- [ ] `canonical` on home = custom domain
- [ ] `sitemap.xml` reachable on custom domain
- [ ] Vote + Supabase still work (same `config.js` keys)
- [ ] GSC property added and sitemap submitted

## 9. Timeline

| Step | Typical delay |
|------|----------------|
| DNS propagation | 5 min – 48 h |
| GitHub TLS cert | up to 24 h after DNS OK |
| Google re-index | 1–4 weeks |
