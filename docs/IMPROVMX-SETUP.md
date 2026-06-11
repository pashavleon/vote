# ImprovMX — почта для topfan.vote

Пошаговая настройка forwarding `hello@topfan.vote` и `partners@topfan.vote` на ваш личный ящик (Gmail и т.п.).

DNS домена сейчас на **share-dns.com** (Spaceship). MX добавляются там же, где A-записи для GitHub Pages.

---

## 1. Регистрация и домен в ImprovMX

1. Откройте [improvmx.com](https://improvmx.com) → **Sign up** (бесплатный план — до 25 алиасов).
2. **Add domain** → введите `topfan.vote`.
3. ImprovMX покажет нужные DNS-записи — оставьте вкладку открытой.

---

## 2. DNS у регистратора (Spaceship)

Панель: **Domains → topfan.vote → DNS / Nameservers**.

### Удалить старые MX (если есть)

Удалите все существующие MX-записи для `@` — одновременно может работать только один почтовый провайдер.

### Добавить MX

| Type | Host | Value / Mail server | Priority | TTL |
|------|------|---------------------|----------|-----|
| MX | `@` | `mx1.improvmx.com` | **10** | 3600 (или Auto) |
| MX | `@` | `mx2.improvmx.com` | **20** | 3600 |

> В Spaceship поле Host может называться **Name** — для корня домена укажите `@` или оставьте пустым (зависит от UI).

### Добавить SPF (TXT)

| Type | Host | Value |
|------|------|--------|
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` |

**Важно:** у домена может быть только **одна** SPF-запись. Если TXT с `v=spf1` уже есть — не создавайте вторую, а **объедините**:

```text
v=spf1 include:spf.improvmx.com include:_spf.google.com ~all
```

(второй `include` — если планируете отправку через Gmail SMTP).

Сохраните изменения.

---

## 3. Алиасы в ImprovMX

В дашборде ImprovMX → **Aliases**:

| Alias | Forward to |
|-------|------------|
| `hello` | ваш Gmail (например `you@gmail.com`) |
| `partners` | тот же или отдельный ящик для спонсоров |

Нажмите **Check DNS** / дождитесь статуса **Email forwarding active** (обычно 15 мин – 2 ч, редко до 24 ч).

Проверка снаружи: [inspector.improvmx.com](https://inspector.improvmx.com) → введите `topfan.vote`.

---

## 4. Тест входящей почты

1. С телефона или другого ящика отправьте письмо на `hello@topfan.vote`.
2. Должно прийти на Gmail в течение 1–2 минут.
3. Повторите для `partners@topfan.vote`.

Если не приходит — проверьте Spam, MX в Inspector, нет ли старых MX.

---

## 5. Ответ с @topfan.vote (опционально)

Forwarding только **принимает** почту. Чтобы **отвечать** как `hello@topfan.vote`:

### Вариант A — Gmail «Send mail as»

1. Gmail → **Settings → Accounts → Send mail as → Add**.
2. Имя: `TOP FAN VOTE`, адрес: `hello@topfan.vote`.
3. Gmail отправит код подтверждения на `hello@` → он придёт в Gmail через forwarding.
4. Для SMTP (если спросит): в ImprovMX **Premium** есть SMTP; на бесплатном плане ответы можно отправлять с личного ящика с Reply-To `hello@topfan.vote`.

### Вариант B — ImprovMX SMTP (платный Light/Premium)

Включите SMTP в ImprovMX → добавьте DKIM/DMARC по инструкции в дашборде → настройте клиент или Gmail SMTP.

Для старта достаточно **forwarding + Reply-To** в ответах.

---

## 6. DKIM / DMARC — когда нужны

| Задача | Нужно? |
|--------|--------|
| Принимать письма на `hello@` / `partners@` | Только MX + SPF |
| Отправлять через ImprovMX SMTP | DKIM + DMARC (в дашборде) |
| Форма на сайте → email | Resend/SendGrid со своим SPF (позже) |

На этапе запуска сайта **DKIM не обязателен** — только MX и SPF.

---

## 7. Чеклист

- [ ] Домен `topfan.vote` добавлен в ImprovMX
- [ ] MX: `mx1.improvmx.com` (10), `mx2.improvmx.com` (20)
- [ ] TXT SPF: `v=spf1 include:spf.improvmx.com ~all`
- [ ] Алиасы `hello` и `partners` → ваш Gmail
- [ ] Статус ImprovMX: **active**
- [ ] Тестовое письмо на `hello@topfan.vote` получено
- [ ] На сайте ссылки `mailto:` в футере работают

---

## Ссылки

- [Generic DNS Configuration](https://improvmx.com/guides/generic-dns-configuration/)
- [Combining SPF records](https://improvmx.com/guides/combining-spf-records/)
- [DNS not validating](https://improvmx.com/guides/why-arent-my-dns-records-validating/)
- [DOMAIN-VOTE-SETUP.md](./DOMAIN-VOTE-SETUP.md) — DNS для GitHub Pages (A-записи не трогать)
