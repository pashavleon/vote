# TOP FAN VOTE — план использования `topfan.vote`

Бренд: **TOP FAN VOTE** · домен: **https://topfan.vote/**

---

## 1. Роль домена

| URL | Назначение |
|-----|------------|
| `https://topfan.vote/` | Главная: quick ballot + portal chips |
| `https://topfan.vote/winner.html` | Кто выиграет турнир (48 команд) |
| `https://topfan.vote/matches.html` | Прогнозы по матчам группового этапа |
| `https://topfan.vote/arch.html` | Архив опросов |
| `https://topfan.vote/ucl.html` | Архив UCL Final 2026 |

**Не использовать** путь `/vote/` на кастомном домене — сайт живёт в **корне** `topfan.vote`.

---

## 2. DNS и GitHub Pages (сделать вручную)

### GitHub

1. Repo `pashavleon/vote` → **Settings → Pages**
2. **Custom domain:** `topfan.vote`
3. Дождаться проверки DNS → **Enforce HTTPS**
4. В репо есть файл `CNAME` с `topfan.vote` — не удалять

### DNS (у регистратора)

A/AAAA на IP GitHub Pages (актуальный список: [GitHub Docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)).

Опционально:

| Type | Name | Value |
|------|------|--------|
| CNAME | `www` | `pashavleon.github.io` |

Редирект `www.topfan.vote` → `topfan.vote` (через регистратор или Cloudflare).

---

## 3. SEO и Search Console

| Шаг | Действие |
|-----|----------|
| Canonical | Все страницы → `https://topfan.vote/...` (уже в коде) |
| Sitemap | `https://topfan.vote/sitemap.xml` |
| GSC | Новое property **URL prefix** `https://topfan.vote/` |
| Verify | DNS TXT или HTML (GitHub Pages) |
| Submit | sitemap + Request indexing: `/`, `winner.html`, `matches.html` |
| Legacy | Оставить property `github.io/vote` 2–3 месяца для сравнения |

**Ключевые кластеры:** `world cup 2026 fan vote`, `vote wc 2026`, `top fan vote`, match predictions.

---

## 4. Брендинг в текстах

| Контекст | Форма |
|----------|--------|
| Логотип / шапка | **TOP FAN VOTE** |
| Title страниц | `… | TOP FAN VOTE` |
| OG `site_name` | TOP FAN VOTE |
| Share текст | «TOP FAN VOTE — World Cup 2026 fan vote» |
| Дисклеймер | «TOP FAN VOTE is not affiliated with FIFA» |
| Коротко в постах | «topfan.vote» |

Не смешивать с «FanVote» в публичных текстах — только legacy в git history.

---

## 5. Маркетинг и UTM

Базовый шаблон:

```text
https://topfan.vote/matches.html?utm_source=reddit&utm_medium=social&utm_campaign=opener-mex-rsa
```

| Канал | `utm_source` | Landing |
|-------|--------------|---------|
| Reddit | `reddit` | `/` или `/matches.html` |
| Telegram | `telegram` | `/` |
| X / Threads | `x`, `threads` | `/` |
| Share из сайта | без UTM | текущая страница |

Посты: **Mexico vs South Africa** → `matches.html` (Group A), не только home.

---

## 6. Техническое

| Компонент | Заметка |
|-----------|---------|
| `js/site.js` | `TFV_SITE.url` — единый canonical |
| Supabase | URL в БД не хранится — **config.js без смены** |
| Share / OG images | `https://topfan.vote/assets/...` |
| Favorite poll | SQL `patch-wc-2026-favorite-poll.sql` в Supabase |

---

## 7. Чеклист «домен живой»

- [ ] `https://topfan.vote/` открывается с TLS
- [ ] Quick ballot + голосование работают
- [ ] `https://topfan.vote/sitemap.xml` доступен
- [ ] canonical на home = `https://topfan.vote/`
- [ ] GSC property добавлен, sitemap submitted
- [ ] Первый пост (Reddit/Telegram) с UTM на opener match

---

## 8. Дальше (phase 2)

См. **[VOTE-TYPES-PLAN.md](./VOTE-TYPES-PLAN.md)** — три типа голосования (Winner · Favorite · Matches), удаление quick ballot, `favorite.html`.

- `matches.html?group=A` — deep link для кампаний
- OG dynamic % после голоса (сложнее на static hosting)
- Email / newsletter на домене — не нужен для v1

См. также: [DOMAIN-VOTE-SETUP.md](./DOMAIN-VOTE-SETUP.md)
