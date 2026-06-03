# Индексация в Google

**World Cup 2026:** keyword map, titles, FAQ — [SEO-WC-2026.md](./SEO-WC-2026.md)

## Search Console — как добавить sitemap

**Важно:** property должен быть именно:

`https://pashavleon.github.io/vote/`

(с `https://` и с `/` в конце — как в GSC при создании)

### Вариант A (рекомендуется)

1. GSC → **Indexing → Sitemaps**
2. В поле «Add a new sitemap» введите только: **`sitemap.xml`**
3. Submit

Не вставляйте полный URL, если property уже `.../vote/`.

### Вариант B — text sitemap

Если XML всё ещё пишет «Could not be read», добавьте: **`sitemap.txt`**

### Если ошибка «Sitemap could not be read»

1. Откройте в браузере — должно открыться XML, не HTML:
   - https://pashavleon.github.io/vote/sitemap.xml
   - https://pashavleon.github.io/vote/sitemap.txt
2. GSC → **URL Inspection** → вставьте URL sitemap → **Test live URL**
   - Если Live test = OK, а Sitemaps = error → подождите 24–48 ч (часто кэш GSC после старого 500)
3. Удалите старую запись sitemap в GSC и добавьте заново
4. **Request indexing** (после деплоя SEO):
   - `https://pashavleon.github.io/vote/`
   - `https://pashavleon.github.io/vote/winner.html`
   - `https://pashavleon.github.io/vote/matches.html`

## Файлы на сайте

| URL | Назначение |
|-----|------------|
| `/vote/robots.txt` | разрешает обход + ссылки на sitemap |
| `/vote/sitemap.xml` | XML sitemap |
| `/vote/sitemap.txt` | text sitemap (запасной) |
| `/vote/.nojekyll` | отключает Jekyll (иначе XML давал 500) |
