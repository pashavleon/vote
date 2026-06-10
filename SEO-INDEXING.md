# Индексация в Google

**World Cup 2026:** keyword map, titles, FAQ — [SEO-WC-2026.md](./SEO-WC-2026.md)

## Search Console — property

Property (URL prefix):

`https://topfan.vote/`

(с `https://` и с `/` в конце — как в GSC при создании)

Verify: `https://topfan.vote/googlea68bc1e7bd7bab2b.html` (уже в репо).

### Change of address (legacy)

Если есть property `https://pashavleon.github.io/vote/`:

1. GSC → старое property → **Settings → Change of address**
2. Указать `https://topfan.vote/`
3. Оставить оба property 2–3 месяца для сравнения

## Sitemap

1. GSC → **Indexing → Sitemaps**
2. В поле «Add a new sitemap» введите только: **`sitemap.xml`**
3. Submit

Запасной вариант: **`sitemap.txt`**

### Если ошибка «Sitemap could not be read»

1. Откройте в браузере — должно открыться XML, не HTML:
   - https://topfan.vote/sitemap.xml
   - https://topfan.vote/sitemap.txt
2. GSC → **URL Inspection** → URL sitemap → **Test live URL**
   - Live test OK, Sitemaps error → подождите 24–48 ч (кэш GSC)
3. Удалите старую запись sitemap в GSC и добавьте заново
4. Убедитесь, что в корне репо есть **`.nojekyll`** (без Jekyll XML иногда отдавал 500)

## Request indexing (после каждого SEO-деплоя)

GSC → **URL Inspection** → **Request indexing**:

| URL | Запрос / страница |
|-----|-------------------|
| `https://topfan.vote/` | WC 2026 vote hub |
| `https://topfan.vote/winner.html` | who will win |
| `https://topfan.vote/favorite.html` | favorite team |
| `https://topfan.vote/matches.html` | match predictions |

## Файлы на сайте

| URL | Назначение |
|-----|------------|
| `/robots.txt` | Allow + ссылки на sitemap |
| `/sitemap.xml` | XML sitemap |
| `/sitemap.txt` | text sitemap (запасной) |
| `/.nojekyll` | отключает Jekyll на GitHub Pages |

## GSC — отслеживать запросы

- `wc 2026 vote`
- `world cup 2026 fan poll`
- `who will win world cup 2026`
- `world cup 2026 match predictions`
