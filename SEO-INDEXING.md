# Индексация в Google

**World Cup 2026:** keyword map, titles, FAQ — [SEO-WC-2026.md](./SEO-WC-2026.md)

## Search Console — property

Property (URL prefix):

`https://topfan.vote/`

(с `https://` и с `/` в конце — как в GSC при создании)

Verify: `https://topfan.vote/googlea68bc1e7bd7bab2b.html` (уже в репо).

### Change of address — обычно НЕ нужен

**Важно:** инструмент **Change of address** в GSC работает только для property **на уровне домена** (`example.com`), а не для пути (`github.io/vote/`). Сообщение *«set up 301 redirects»* часто появляется, когда инструмент не подходит к вашему случаю.

Миграция `pashavleon.github.io/vote/` → `topfan.vote/`:

| Шаг | Действие |
|-----|----------|
| 301 | GitHub Pages уже редиректит (проверка ниже) |
| GSC новый | Property `https://topfan.vote/` — sitemap + Request indexing |
| GSC старый | Оставить 2–3 месяца для сравнения, **Change of address не использовать** |
| Canonical | Уже `https://topfan.vote/...` на всех страницах |

Проверка 301 (должен быть `301` и `Location: https://topfan.vote/...`):

```bash
curl -I https://pashavleon.github.io/vote/
curl -I https://pashavleon.github.io/vote/winner.html
curl -I https://pashavleon.github.io/vote/matches.html
```

Ожидаемый результат:

- `https://pashavleon.github.io/vote/` → `https://topfan.vote/`
- `https://pashavleon.github.io/vote/winner.html` → `https://topfan.vote/winner.html`
- `https://pashavleon.github.io/vote/matches.html` → `https://topfan.vote/matches.html`

Редиректы держать **минимум 180 дней** (рекомендация Google).

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
