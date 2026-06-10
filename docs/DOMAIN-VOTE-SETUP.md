# `topfan.vote` on GitHub Pages

Бренд: **TOP FAN VOTE** · репо: `pashavleon/vote`

Полный план использования домена: [TOPFAN-DOMAIN-PLAN.md](./TOPFAN-DOMAIN-PLAN.md)

---

## 1. GitHub Pages

1. Repo → **Settings → Pages**
2. **Custom domain:** `topfan.vote`
3. Дождаться DNS check → **Enforce HTTPS**
4. Файл `CNAME` в репо (содержимое: `topfan.vote`) — не удалять

## 2. DNS у регистратора

DNS для `topfan.vote` сейчас на **share-dns.com** (Spaceship / аналог). Apex **должен** иметь A-записи — без них GitHub пишет *«Domain is not eligible for HTTPS»* и сайт не открывается.

### Apex `topfan.vote` (@) — обязательно 4 A-записи

| Type | Host | Value |
|------|------|--------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Опционально те же 4 AAAA (IPv6):

| Type | Host | Value |
|------|------|--------|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

### Удалить / не оставлять

- Parking A на `@` (GoDaddy `park`, регистратор «website builder»)
- CNAME на apex `@` (для apex только A/AAAA или ALIAS → `pashavleon.github.io`)
- Дублирующие A/CNAME на `@`, которые не ведут на GitHub Pages

### Опционально `www`

| Type | Host | Value |
|------|------|--------|
| CNAME | `www` | `pashavleon.github.io` |

Редирект `www` → apex на стороне DNS/Cloudflare.

Проверка (должны быть Answer, не только SOA):

```bash
nslookup topfan.vote 8.8.8.8
```

Актуальный список IP: [GitHub Docs — Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

---

## 2b. «Domain is not eligible for HTTPS»

GitHub включает HTTPS только когда DNS **уже** указывает на Pages и Let's Encrypt может выдать сертификат.

| Причина | Что делать |
|---------|------------|
| Нет A на apex (только SOA) | Добавить 4 A выше; проверить `nslookup` |
| Одна A вместо четырёх | Добавить все 4 IPv4 |
| Parking / лишние записи на `@` | Удалить, оставить только GitHub |
| CAA без `letsencrypt.org` | Добавить CAA: `0 issue "letsencrypt.org"` |
| DNS обновили после Pages | Убрать custom domain в Settings → Pages → снова вписать `topfan.vote` |
| Сертификат в процессе | Подождать до **1 часа** после корректного DNS |

После DNS: Settings → Pages → галочка **Enforce HTTPS**.

Файл `CNAME` в репо (`topfan.vote`) должен быть в `main` — без него домен может слетать после деплоя.

## 3. Canonical URL в коде

Все страницы и `js/site.js` используют **`https://topfan.vote/`** (корень, без `/vote/`).

| Файл | Роль |
|------|------|
| `js/site.js` | `TFV_SITE.url`, `TFV_SITE.name` |
| `sitemap.xml`, `robots.txt` | индексация |
| `js/share.js`, `js/hub-share.js` | шаринг |

## 4. Google Search Console

1. Property: `https://topfan.vote/`
2. Submit: `https://topfan.vote/sitemap.xml`
3. Request indexing: `/`, `winner.html`, `matches.html`

Legacy `github.io/vote` можно оставить для мониторинга 2–3 месяца.

## 5. Чеклист

- [ ] Custom domain + HTTPS в GitHub
- [ ] `https://topfan.vote/` открывается
- [ ] Голосование Supabase работает
- [ ] GSC + sitemap
- [ ] Favorite poll SQL (опционально): `supabase/patch-wc-2026-favorite-poll.sql`
