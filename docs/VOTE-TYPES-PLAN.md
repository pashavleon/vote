# TOP FAN VOTE — три типа голосования (план доработки)

Статус: **подготовка** · целевая модель продукта

Связано: [TOPFAN-DOMAIN-PLAN.md](./TOPFAN-DOMAIN-PLAN.md), [DOMAIN-VOTE-SETUP.md](./DOMAIN-VOTE-SETUP.md)

---

## 1. Модель продукта

Три **равноправных** типа голосования — три страницы, три poll в Supabase, три сценария для пользователя и промо.

| # | Тип | Вопрос пользователю | URL | Poll ID | `poll_type` |
|---|-----|---------------------|-----|---------|-------------|
| 1 | **Tournament winner** | Кто выиграет Кубок мира 2026? | `/winner.html` | `wc-2026-winner` | `outright` / winner |
| 2 | **Favorite team** | За какую команду болеете? | `/favorite.html` | `wc-2026-favorite` | `favorite` |
| 3 | **Match polls** | Кто выиграет матч X? | `/matches.html` | `wc-2026-match-*` (72+) | `match_winner` |

**Правило:** один тип = одна страница = один сценарий. Не смешивать winner + favorite в одной форме.

Пример: Mexico (favorite) + Brazil (winner) — два независимых голоса.

---

## 2. Текущее состояние vs цель

| Область | Сейчас | Цель |
|---------|--------|------|
| Главная | Quick ballot (2 select) + 2 portal chips | Портал **3 chips**, без quick ballot |
| Winner | `winner.html` — grid 48, live % | Без изменений по UX |
| Favorite | Только select на главной; без SQL — localStorage | `favorite.html` — grid как winner |
| Matches | `matches.html` | Без изменений по модели |
| Nav | Winner \| Matches | **Winner \| Favorite \| Matches** |
| Share | Смешанный текст home/winner | Тексты по типу poll |
| SEO | 2 landing-кластера | + favorite team keywords |
| Sitemap | 5 URL | + `favorite.html` |

---

## 3. IA — главная (wireframe)

```
┌─────────────────────────────────────────┐
│  TOP FAN VOTE          Archive          │
├─────────────────────────────────────────┤
│         [ trophy ]                      │
│   World Cup 2026 Fan Vote               │
│   Three ways to vote · unofficial       │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Winner   │ │ Favorite │ │ Matches  │ │
│  │ Who wins │ │ Who you  │ │ Group    │ │
│  │ 48 teams │ │ support  │ │ stage    │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                         │
│  FAQ · SEO · disclaimer                 │
└─────────────────────────────────────────┘
```

**Убрать:** блок `#quick-ballot` (Cast your vote).

**Опционально (phase 2):** мини-превью «Your votes: ✓ Winner · ✗ Favorite · 12/72 matches» из `localStorage` + API.

---

## 4. Страница `favorite.html`

Клон паттерна `winner.html` с другими текстами и poll ID.

| Элемент | Winner | Favorite |
|---------|--------|----------|
| `data-page` | `winner` | `favorite` |
| H1 | Who will win World Cup 2026? | Who do you support at World Cup 2026? |
| Sub | one pick · live vote share | your favorite · live fan support |
| Grid id | `#hub-winner-grid` | `#hub-favorite-grid` (или общий `#hub-team-grid`) |
| Poll | `wc-2026-winner` | `wc-2026-favorite` |
| OG image | `winner-silhouettes-1280.jpg` | TBD — переиспользовать или новый asset |
| SEO lead | winner predictions | favorite team / who fans support |

---

## 5. Supabase (обязательно до prod favorite)

**Файл:** `supabase/patch-wc-2026-favorite-poll.sql`

Расширяет check constraint (`poll_type` + `favorite`) и создаёт poll. Если ошибка `polls_poll_type_check` — вы запускали старую версию patch; используйте актуальный файл из репо.

**Чеклист после patch:**

- [ ] `get_poll_detail('wc-2026-favorite')` возвращает 48 choices
- [ ] `cast_vote` работает (один голос на `voter_token`)
- [ ] На `favorite.html` видны live %

**Миграция localStorage:** пользователи с `fan_vote_favorite_wc-2026` без глобального голоса — phase 2: one-time prompt «Submit your favorite to global poll».

---

## 6. Рефакторинг `js/hub.js`

Сейчас winner — монолит (`loadWinner`, `renderWinnerGrid`, `castWinnerChoice`). Цель — **общий модуль team-grid poll**.

### 6.1 Registry (новый файл или константа в hub.js)

```javascript
var TEAM_GRID_POLLS = {
  winner: {
    page: 'winner',
    pollIdKey: 'winnerPollId',
    gridSel: '#hub-winner-grid',
    totalSel: '#winner-total',
    messageSel: '#winner-message',
    expandId: 'winner-expand',
    choiceAttr: 'data-winner-choice',
  },
  favorite: {
    page: 'favorite',
    pollIdKey: 'favoritePollId',
    gridSel: '#hub-favorite-grid',
    totalSel: '#favorite-total',
    messageSel: '#favorite-message',
    expandId: 'favorite-expand',
    choiceAttr: 'data-favorite-choice',
  },
};
```

### 6.2 Обобщённые методы

| Было | Станет |
|------|--------|
| `initWinner()` | `initTeamGridPoll('winner')` |
| — | `initTeamGridPoll('favorite')` |
| `loadWinner()` | `loadTeamGridPoll(kind)` |
| `renderWinnerGrid()` | `renderTeamGridPoll(kind)` |
| `castWinnerChoice()` | `castTeamGridChoice(kind, choiceId)` |
| `initHome()` + quick ballot | `initHome()` — только hero + optional stats |

### 6.3 `data-page` values

```
home | winner | favorite | matches | arch
```

`init()` switch: добавить `case 'favorite': this.initTeamGridPoll('favorite')`.

### 6.4 Удалить

- `initQuickBallot`, `submitQuickBallot`, `quickBallotChoices`
- CSS `.quick-ballot*` в `hub.css` (после удаления HTML)

---

## 7. Навигация

Единый блок `topnav-polls` на **winner**, **favorite**, **matches**:

```html
<div class="topnav-polls">
  <a href="winner.html">Winner</a>
  <a href="favorite.html">Favorite</a>
  <a href="matches.html">Matches</a>
</div>
```

Active class по текущей странице.

---

## 8. CSS — три portal chips

Сейчас: `portal-chip--winner` (left), `portal-chip--matches` (right).

**Вариант A (рекомендуется):** три chips в ряд на desktop, stack на mobile.

- `portal-chip--winner` → `winner.html`
- `portal-chip--favorite` → `favorite.html` (новый, центр или left)
- `portal-chip--matches` → `matches.html`

Asset для favorite: пока `winner-silhouettes` или `groups-tilted` — позже отдельный арт.

---

## 9. Share (`hub-share.js`)

| Страница | Default share text |
|----------|-------------------|
| `home` | Three fan polls — winner, favorite team, match predictions |
| `winner` | I picked [team] to win World Cup 2026 |
| `favorite` | I'm supporting [team] at World Cup 2026 |
| `matches` | Match predictions + live fan votes |

- `PAGE_URLS.favorite = SITE + 'favorite.html'`
- `fan-vote-cast` с `pollId === favoritePollId` → favorite share template
- Убрать зависимость от `localStorage fan_vote_favorite_wc-2026`

---

## 10. SEO

### Новые keywords (favorite)

- world cup 2026 favorite team
- which team do fans support world cup 2026
- world cup 2026 fan support poll

### Файлы

| Файл | Изменение |
|------|-----------|
| `favorite.html` | title, canonical, OG, FAQ, JSON-LD |
| `index.html` | H1/meta — «three fan polls»; FAQ про favorite |
| `sitemap.xml` | + `https://topfan.vote/favorite.html` priority 0.9 |
| `robots.txt` | без изменений |
| `SEO-WC-2026.md` | строка favorite в page map |
| `scripts/gen_wc_teams_seo.py` | опция `page=favorite` → ссылки на `favorite.html`, текст «fan support» |

### JSON-LD

`WebPage` + при необходимости `ItemList` 48 teams (как на winner).

---

## 11. Фазы реализации

### Phase 0 — подготовка (сейчас)

- [x] Этот документ
- [ ] Запустить `patch-wc-2026-favorite-poll.sql` в Supabase
- [ ] Закоммитить/задеплоить ребрендинг TOP FAN VOTE + CNAME (если ещё не на main)

### Phase 1 — Favorite page (MVP)

1. `favorite.html` (скопировать shell из `winner.html`)
2. `hub.js`: `initTeamGridPoll('favorite')` — можно сначала дублировать winner-код, потом обобщить
3. Nav: Winner \| Favorite \| Matches
4. `sitemap.xml` + meta
5. Smoke test vote on prod

### Phase 2 — Home portal

1. Удалить quick ballot с `index.html`
2. Третий portal chip Favorite
3. Обновить hero copy + FAQ
4. CSS layout для 3 chips

### Phase 3 — Refactor & polish

1. Обобщить winner/favorite в `loadTeamGridPoll`
2. Share templates по poll type
3. `gen_wc_teams_seo.py` для favorite
4. Home «progress» badges (optional)

### Phase 4 — Promo

- UTM landing: favorite vs winner vs matches
- GSC: request indexing `favorite.html`

---

## 12. Acceptance criteria

- [ ] Три chips на главной ведут на три разные страницы
- [ ] Quick ballot удалён
- [ ] Winner и Favorite — независимые голоса, оба с live %
- [ ] Можно выбрать разные команды в winner и favorite
- [ ] Nav одинаковый на winner / favorite / matches
- [ ] Share тексты различаются по типу
- [ ] `favorite.html` в sitemap и GSC
- [ ] Нет ссылок на `pashavleon.github.io/vote/` в canonical

---

## 13. Риски

| Риск | Митигация |
|------|-----------|
| Favorite poll не создан в Supabase | Phase 1 blocked — patch SQL first |
| Потеря SEO quick ballot на home | H1 + FAQ + три chips с keyword-rich captions |
| Дублирование кода winner/favorite | Phase 3 refactor; допустимо кратковременно |
| Пользователи голосовали favorite только local | Мягкий prompt на favorite.html |

---

## 14. Оценка трудозатрат

| Phase | Объём |
|-------|--------|
| 0 SQL + doc | 15 min |
| 1 favorite page | 2–3 h |
| 2 home portal | 1–2 h |
| 3 refactor + SEO script | 2 h |
| **Итого** | ~1 рабочий день |

---

## 15. Следующий шаг

1. **Вы:** запустить `supabase/patch-wc-2026-favorite-poll.sql`
2. **Разработка:** Phase 1 — `favorite.html` + hub init
3. **Deploy:** вместе с ребрендингом TOP FAN VOTE (если ещё не на prod)

Скажите «делай Phase 1» — начнём с `favorite.html` и hub.
