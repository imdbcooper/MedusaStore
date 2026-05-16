# Почтовые серверы проекта

_Updated 2026-05-16_

В проекте задействованы **два независимых почтовых сервера**:

1. **`smtpserv`** ([Секции 1–10](#1-сервер-и-доступ)) — outbound SMTP-relay на базе [`docker-mailserver`](https://github.com/docker-mailserver/docker-mailserver), отправляет всё исходящее (transactional + marketing). MX зоны на него не указывает.
2. **`TGPT`** ([Секция 11](#11-mailslavxru-tgpt--inbound-mx-для-slavxru)) — inbound mail-сервер `mail.slavx.ru` (MX зоны `slavx.ru`) на базе [Mox](https://www.xmox.nl/) в Docker, обслуживает приём почты для `*@slavx.ru`. Хостит DMARC-алиас `dmarc@slavx.ru`.

Single relay, single outbound SMTP-аккаунт; сегментация — на уровне доменов отправителя и DKIM-селекторов.

## 1. Сервер и доступ

| Параметр | Значение |
|---|---|
| ssh-алиас | `smtpserv` |
| FQDN / HELO | `smtp.slavx.ru` |
| Внешний IPv4 | `77.83.92.194` |
| PTR | `smtp.slavx.ru.` (совпадает с HELO — OK для DMARC alignment) |
| ОС | Ubuntu 22.04.5 LTS (Jammy) |
| Mail stack | `ghcr.io/docker-mailserver/docker-mailserver:latest`, контейнер `mailserver` |
| Compose | [`/opt/mailserver/docker-compose.yml`](docker-compose.yml:1) (на сервере) |
| Конфиг (mount) | `/opt/mailserver/config/` → `/tmp/docker-mailserver/` внутри контейнера |
| Логи | `/opt/mailserver/docker-data/dms/mail-logs/` (host) ↔ `/var/log/mail/` (контейнер) |
| Бэкапы | `/opt/mailserver/backups/` (manual snapshots `*.tgz`; cron не настроен) |
| Порты наружу | 25, 465, 587 (только эти; IMAP/POP3 не публикуются) |
| TLS-сертификат | Let's Encrypt (`smtp.slavx.ru`, выдан 2026-05-12, валиден до 2026-08-10), `SSL_TYPE=manual`, файлы в `/opt/mailserver/config/ssl/`. Renewal — ручной (`certbot` cron на хосте отсутствует, требует операторской процедуры). |

## 2. Активные сервисы внутри контейнера

| Сервис | Роль | Статус |
|---|---|---|
| `postfix` | SMTP relay, приём и доставка | RUNNING |
| `dovecot` | SASL-аутентификация SMTP-клиентов (IMAP/POP3 наружу выключены через `ENABLE_IMAP=0`, `ENABLE_POP3=0`) | RUNNING |
| `opendkim` | DKIM-подписание исходящих | RUNNING |
| `opendmarc` | DMARC-проверка входящих | RUNNING |
| `policyd-spf` | SPF-проверка входящих (`ENABLE_POLICYD_SPF=1`) | RUNNING (через postfix) |
| `rsyslog` | Сбор логов в `/var/log/mail/mail.log` | RUNNING |
| `cron` / `update-check` / `changedetector` | Внутренние таймеры DMS | RUNNING |
| `rspamd`, `spamassassin`, `amavis`, `clamav`, `fail2ban`, `postgrey`, `postsrsd`, `saslauthd_*` | **Не активированы** (`ENABLE_*=0` в `mailserver.env`) | STOPPED |

Антиспам-фильтрация и антивирус выключены. Fail2ban тоже выключен — защита от brute-force на SMTP сейчас отсутствует на уровне контейнера. См. секцию 7.

## 3. Обслуживаемые домены

| Домен | DKIM селектор | Назначение | From-адрес | Откуда отправляется |
|---|---|---|---|---|
| `notify.slavx.ru` | `mail` | Транзакционные письма (verification, password reset, order/payment events) | `noreply@notify.slavx.ru` | Medusa backend через [`notification-smtp.ts`](medusa-agency-boilerplate/src/modules/notification-smtp.ts:1) |
| `slavx.ru` | `mail` | Корневой домен. Подписан DKIM-ключом для совместимости (relaxed alignment с `notify.*` / `news.*`); основной MX зоны (`mail.slavx.ru`) обслуживает обычную почту вне этого VPS. **Через Medusa код напрямую с `*@slavx.ru` не отправляет**. | — | резервно (postmaster@slavx.ru используется как DMARC `rua` для `notify`) |
| `news.slavx.ru` | `mail` | Маркетинговые рассылки (broadcast, double opt-in) | `news@news.slavx.ru` (когда задан `MARKETING_EMAIL_FROM`) или fallback на `SMTP_FROM` | Medusa backend, триггер из Payload UI коллекции `marketing-campaigns` |

KeyTable / SigningTable: оба файла в `/opt/mailserver/config/opendkim/`, подписывают `*@<domain>` каждым своим ключом.

## 4. Что именно отправляется через этот сервер

Полный inventory триггеров. Все workflows публикуют через Medusa Notification Module → провайдер `notification-smtp` ([`notification-smtp.ts`](medusa-agency-boilerplate/src/modules/notification-smtp.ts:1)). Резолвер runtime — [`getNotificationEmailRuntime()`](medusa-agency-boilerplate/src/modules/notification-email.ts:165). Шаблоны рендерятся через [`renderBrandedEmail()`](medusa-agency-boilerplate/src/modules/email-template.ts:734).

### 4.1. Транзакционные (через `notify.slavx.ru`, from `noreply@notify.slavx.ru`)

- **Email verification при регистрации** — событие `customer.created` → подписчик [`customer-created-email-verification.ts`](medusa-agency-boilerplate/src/subscribers/customer-created-email-verification.ts:128) → workflow [`send-email-verification.ts`](medusa-agency-boilerplate/src/workflows/send-email-verification.ts:312) → template `customer-email-verification-v1` ([`email-verification.ts:13`](medusa-agency-boilerplate/src/modules/email-verification.ts:13)). VK-зарегистрированные клиенты пропускаются.
- **Email verification по запросу** — POST `/store/customers/me/request-email-verification` → тот же workflow (см. middleware [`api/middlewares.ts:303`](medusa-agency-boilerplate/src/api/middlewares.ts:303)).
- **Password reset (storefront)** — POST `/store/customers/forgot-password` ([`forgot-password/route.ts:7`](medusa-agency-boilerplate/src/api/store/customers/forgot-password/route.ts:7)) → workflow [`send-password-reset.ts`](medusa-agency-boilerplate/src/workflows/send-password-reset.ts:331) → template `customer-password-reset-v1` ([`password-reset.ts:10`](medusa-agency-boilerplate/src/modules/password-reset.ts:10)).
- **Password reset (admin re-issue)** — POST `/admin/customers/:id/send-password-reset` ([`send-password-reset/route.ts:6`](medusa-agency-boilerplate/src/api/admin/customers/[id]/send-password-reset/route.ts:6)) → тот же workflow.
- **Order placed** — событие `order.placed` → [`order-placed-notification.ts`](medusa-agency-boilerplate/src/subscribers/order-placed-notification.ts:33) → workflow [`send-order-placed-notification.ts`](medusa-agency-boilerplate/src/workflows/send-order-placed-notification.ts:317) → template `order-placed-v1` ([`notification-email.ts:47`](medusa-agency-boilerplate/src/modules/notification-email.ts:47)).
- **Order shipped** — событие `shipment.created` → [`order-shipped-notification.ts`](medusa-agency-boilerplate/src/subscribers/order-shipped-notification.ts:40) → workflow [`send-order-shipped-notification.ts`](medusa-agency-boilerplate/src/workflows/send-order-shipped-notification.ts:396) → template `order-shipped-v1`.
- **Order canceled** — событие `order.canceled` → [`order-canceled-notification.ts`](medusa-agency-boilerplate/src/subscribers/order-canceled-notification.ts:33) → workflow [`send-order-canceled-notification.ts`](medusa-agency-boilerplate/src/workflows/send-order-canceled-notification.ts:323) → template `order-canceled-v1`.
- **Payment failed** — событие `payment_session.failed.customer.notification_requested` → [`payment-failed-notification.ts`](medusa-agency-boilerplate/src/subscribers/payment-failed-notification.ts:50) → workflow [`send-payment-failed-notification.ts`](medusa-agency-boilerplate/src/workflows/send-payment-failed-notification.ts:505) → template `payment-failed-v1`.
- **Marketing double opt-in confirmation** — клиент включает email-подписку → workflow [`send-marketing-confirmation.ts`](medusa-agency-boilerplate/src/workflows/send-marketing-confirmation.ts:394) → template `marketing-double-optin-confirmation-v1`. Адрес отправителя — `MARKETING_EMAIL_FROM` (если задан); т.е. это пограничное письмо, может уйти и через `news.slavx.ru`.
- **Admin notification smoke** — POST `/admin/notifications/smoke` ([`smoke/route.ts:14`](medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:14)) → workflow [`send-notification-smoke.ts`](medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:73). Используется операторами для ручной диагностики канала.

### 4.2. Маркетинговые (через `news.slavx.ru`, from `news@news.slavx.ru`)

- **Marketing broadcast campaign** — оператор создаёт кампанию в Payload-коллекции `marketing-campaigns` ([`MarketingCampaigns/index.ts`](payload-cms/src/collections/MarketingCampaigns/index.ts:1)) и нажимает Launch ([`launch-endpoint.ts`](payload-cms/src/collections/MarketingCampaigns/launch-endpoint.ts:1)) → backend workflow [`send-marketing-campaign.ts`](medusa-agency-boilerplate/src/workflows/send-marketing-campaign.ts:773) → template из поля `template` кампании. Trigger type `marketing.campaign.manual_send_requested` ([`marketing-layer.ts:32`](medusa-agency-boilerplate/src/modules/marketing-layer.ts:32)). От Phase 1 поддерживается только канал `email`. List-Unsubscribe header (https + опц. mailto) подставляется автоматически.

### 4.3. Payload admin

[`payload.config.ts`](payload-cms/src/payload.config.ts:1) **не подключает email provider**. Сброс пароля и приглашения в админку Payload через email отключены. Логин админов работает по паролю в БД, в коллекции [`Users.ts`](payload-cms/src/collections/Users.ts:1).

### 4.4. Storefront

[`medusa-agency-boilerplate-storefront/`](medusa-agency-boilerplate-storefront:1) напрямую SMTP-каналом не пользуется — все письма проходят через backend. Подтверждено grep'ом по `nodemailer|smtp|SMTP`: совпадений ноль.

## 5. Аутентификация писем (SPF / DKIM / DMARC)

Состояние записей в DNS (проверено `dig` 2026-05-16):

| Домен | SPF | DKIM (selector `mail`) | DMARC |
|---|---|---|---|
| `notify.slavx.ru` | `v=spf1 mx ip4:77.83.92.194 -all` | published | `p=none; rua=postmaster@slavx.ru; adkim=s; aspf=s` |
| `slavx.ru` | `v=spf1 mx ip4:77.232.42.136 ~all` (другой VPS, обычная почта) | published | `p=none; rua=admin@slavx.ru` |
| `news.slavx.ru` | `v=spf1 ip4:77.83.92.194 ~all` | published 2026-05-16 | `p=none; rua=dmarc@slavx.ru; adkim=r; aspf=r` |

Все три домена подписываются и проходят DKIM. Все три DMARC-политики в режиме `p=none` (мониторинг, без блокировки). Для `news.*` алиаса `dmarc@slavx.ru` пока не существует — см. секцию 6.

## 6. SMTP-учётки и алиасы

Mailbox'ы (`docker exec mailserver setup email list`):

- `noreply@notify.slavx.ru` — единственный реальный аккаунт. Используется и для transactional, и для marketing отправок (см. TODO в секции 10).

Алиасы: файл `postfix-virtual.cf` отсутствует, алиасов на сервере **не настроено**.

SMTP-клиент Medusa авторизуется как `noreply@notify.slavx.ru` (env `SMTP_USER`, см. [`.env.example:67`](.env.example:67)).

### DMARC `rua`-mailto

`rua=mailto:` — это адрес, на который Gmail/Yandex/Mail.ru присылают агрегированные XML-отчёты раз в сутки (кто отправлял с домена, как прошёл SPF/DKIM, сколько писем пришло, как оценили). Все три rua-адреса находятся в зоне `slavx.ru` и обслуживаются inbound-сервером **TGPT** (см. секцию 11), потому что MX `slavx.ru` указывает именно туда:

| Домен | rua-target | Статус на TGPT (Mox) |
|---|---|---|
| `notify.slavx.ru` | `postmaster@slavx.ru` | **аккаунта нет** — отчёты теряются |
| `slavx.ru` | `admin@slavx.ru` | существует (Mox account `admin`, Inbox) — отчёты доходят |
| `news.slavx.ru` | `dmarc@slavx.ru` | **создан 2026-05-16** как дополнительный destination аккаунта `admin` — отчёты падают в Inbox `admin@slavx.ru` |

Подробности по созданию `dmarc@slavx.ru`, бэкапу и команде отката — в секции 11.3.

`postmaster@slavx.ru` всё ещё отсутствует. Варианты что делать (вне scope этой итерации):

1. Аналогично создать алиас на TGPT: `docker exec mox mox config address add postmaster@slavx.ru admin`.
2. Поменять `rua` в DNS у `notify.slavx.ru` на `admin@slavx.ru` — отчёты пойдут туда же, куда и для корневого домена.
3. Оставить как есть. На доставку не влияет, только пропадает наблюдаемость по `notify.*`.

## 7. Безопасность и анти-абуз

- TLS на 465/587: `TLS_LEVEL=modern` (TLSv1.2+, modern cipher suites). Postfix `smtpd_tls_security_level=may` (STARTTLS опционально на 25, обязателен на 465/587 через submission).
- Сертификат Let's Encrypt, валиден до 2026-08-10. **Renewal не автоматизирован** (на хосте нет certbot cron / systemd timer). Перед expire оператор должен запустить процедуру обновления вручную и положить новые `*-cert.pem` / `*-key.pem` в `/opt/mailserver/config/ssl/`.
- `SPOOF_PROTECTION=1` — Postfix запрещает SMTP-клиенту отправлять с чужого From, не совпадающего с залогиненным mailbox.
- `smtpd_relay_restrictions=permit_mynetworks permit_sasl_authenticated defer_unauth_destination` — open relay закрыт, отправка только после SASL.
- `PERMIT_DOCKER=none` — внутренние docker bridge сети не получают автоматический trust.
- Fail2ban / rspamd / spamassassin / amavis / clamav **выключены**. Brute-force защиты SMTP-AUTH сейчас нет на уровне DMS; пароль mailbox'а должен быть достаточно сильным, IPS — на уровне VPS-провайдера.
- POSTFIX message size limit = 20 MB.

## 8. Бэкапы и восстановление

- Каталог бэкапов: `/opt/mailserver/backups/`. Содержит manual snapshots каталога `config/opendkim/` (например `opendkim-pre-news-20260516T071957Z.tgz`) и pre-LE снимок (`pre-le-20260512T050506Z.tgz`).
- **Cron не настроен** — бэкапы делаются вручную перед изменениями DKIM / TLS.
- Mail-store (`docker-data/dms/mail-data/`) и `mailserver.env` отдельно не бэкапятся. Поскольку аккаунт один и реальной inbox-почты нет (входящие сюда не приходят, MX зоны указывает на другой сервер), это приемлемо.
- Откат DKIM/конфига: `cd /opt/mailserver && sudo tar xzf backups/<имя>.tgz -C config/` затем `sudo docker exec mailserver supervisorctl restart opendkim`.

## 9. Связь с проектом

Env-переменные на стороне Medusa (контракт — [`Docs/env_contract.md`](Docs/env_contract.md:163), шаблон — [`.env.example`](.env.example:57)):

- `NOTIFICATION_EMAIL_PROVIDER=smtp` (`local` / `unisender` / `smtp`).
- `NOTIFICATION_EMAIL_FROM` — generic sender для smoke и fallback.
- `SMTP_HOST=smtp.slavx.ru`, `SMTP_PORT=587`, `SMTP_SECURE=false` (STARTTLS), `SMTP_USER=noreply@notify.slavx.ru`, `SMTP_PASSWORD` (operator-only).
- `SMTP_FROM=noreply@notify.slavx.ru`, `SMTP_FROM_NAME`, `SMTP_REPLY_TO`.
- `SMTP_TLS_REJECT_UNAUTHORIZED=true` (для production с trusted cert).
- `MARKETING_EMAIL_FROM=news@news.slavx.ru`, `MARKETING_EMAIL_FROM_NAME`, `MARKETING_EMAIL_REPLY_TO`, `MARKETING_UNSUBSCRIBE_MAILTO`.
- `BRAND_*` — брендирование шаблонов в [`renderBrandedEmail()`](medusa-agency-boilerplate/src/modules/email-template.ts:734).

При локальной разработке проще запускать `NOTIFICATION_EMAIL_PROVIDER=local` (Medusa logger вместо реальной отправки) или поднимать Mailpit; в этом репо отдельного docker-compose для Mailpit нет.

Маркетинговый UI и контракт публикации описаны в [`Docs/marketing_ui_status.md`](Docs/marketing_ui_status.md:1).

## 10. Текущий статус (2026-05-16)

- DKIM добавлен для `news.slavx.ru` (selector `mail`), DNS опубликован и виден в `dig`.
- Verification, password reset, order/payment events, marketing confirmation, marketing campaigns — все workflows работают через единый SMTP-relay.
- TLS-сертификат до 2026-08-10. Перед expire требуется ручной renew (cron не настроен).

Известные риски / TODO:

- Один SMTP-аккаунт `noreply@notify.slavx.ru` физически отправляет и transactional, и marketing. Bounce-репутация смешивается. Фикс — отдельный mailbox `news-mailer@news.slavx.ru` и переключение marketing-workflows на отдельные креды; см. operator task в [`Docs/env_contract.md:167`](Docs/env_contract.md:167).
- DMARC `rua` для `news.slavx.ru` (`dmarc@slavx.ru`) — **2026-05-16 создан как destination аккаунта `admin` на TGPT-сервере**, отчёты доходят в Inbox `admin@slavx.ru`. Для `notify.slavx.ru` (`postmaster@slavx.ru`) ящика всё ещё нет — см. секцию 6 / секцию 11.4.
- Fail2ban на SMTP-AUTH выключен. Антиспам/антивирус на входящих тоже выключены — некритично, пока MX зоны не указывает на этот VPS, но при включении IMAP это станет блокером.
- Bounce-handling и suppression list для маркетинга не реализованы (Phase 5 marketing plan, [`Docs/marketing_ui_status.md`](Docs/marketing_ui_status.md:69)).
- LE renewal не автоматизирован.

## 11. `mail.slavx.ru` (TGPT) — inbound MX для `slavx.ru`

Этот сервер **независим** от `smtpserv`: он не отправляет рассылок проекта, а только принимает входящую почту для домена `slavx.ru` (включая DMARC aggregate-репорты от Gmail/Yandex/Mail.ru). Управляется отдельно командой `telepost`.

### 11.1. Сервер и доступ

| Параметр | Значение |
|---|---|
| ssh-алиас | `TGPT` |
| FQDN / HELO | `mail.slavx.ru` |
| Внешний IPv4 | `77.232.42.136` |
| MX-запись | `slavx.ru. MX 10 mail.slavx.ru.` (публично резолвится в `77.232.42.136`) |
| ОС | Ubuntu 22.04.5 LTS (Jammy) |
| Mail stack | [Mox](https://www.xmox.nl/) (Go single-binary mailserver), образ `r.xmox.nl/mox:latest`, контейнер `mox` |
| Compose | `/opt/telepost/docker-compose.prod.yml` (на сервере) |
| Конфиги | `/opt/telepost/config/mox.conf`, `/opt/telepost/config/domains.conf` |
| Данные | `/opt/telepost/mox-data/` (mailbox storage + DMARC/TLS-RPT базы) |
| Порты наружу | 25 (SMTP-in), 587 (submission), 993 (IMAP-secure). 80/443 уходят в `nginx-proxy` для Web Admin. |
| Сопутствующие сервисы | `proxy` (nginx-proxy), `ssl-gen` (acme-companion), `telepost-app` (Telegram bridge на `app.slavx.ru`), `telepost-postgres`. |

Mox обрабатывает DMARC-репорты нативно — XML складываются в `mox-data/dmarcrpt.db` и доступны через Web Admin на `https://mail.slavx.ru/admin/`.

### 11.2. Аккаунты и адреса (домен `slavx.ru`)

Единственный обслуживаемый домен: `slavx.ru`. Аккаунты получены из `docker exec mox mox config account list`:

| Account | Адреса (Destinations) | Назначение |
|---|---|---|
| `admin` | `admin@slavx.ru` (Inbox), `dmarc@slavx.ru` (Inbox) | DMARC `rua` для `slavx.ru` и `news.slavx.ru` |
| `lida` | `lida@slavx.ru` | Telegram-bridge через `IncomingWebhook → http://app:3000/api/webhook/email` |
| `smirnoff` | `smirnoff@slavx.ru` | Telegram-bridge (тот же webhook) |

Алиасов в Mox-смысле (`mox config alias list slavx.ru`) — нет. Дополнительные адреса добавляются как Destinations к существующим аккаунтам — функциональный эквивалент алиаса без отдельного пароля и mailbox-storage.

### 11.3. Создание `dmarc@slavx.ru` (2026-05-16)

Цель: `news.slavx.ru` DMARC-политика публикует `rua=mailto:dmarc@slavx.ru`, ящик нужно было материализовать чтобы агрегатные XML-отчёты Gmail/Yandex не уходили в bounce.

**Процедура (выполнено):**

```bash
ssh TGPT

# 1. Бэкап конфига
TS=$(date -u +%Y%m%d-%H%M%S)
cp -av /opt/telepost/config/domains.conf /opt/telepost/config/domains.conf.bak.$TS
# → /opt/telepost/config/domains.conf.bak.20260516-082029

# 2. Добавить адрес как destination существующего аккаунта admin (нативный CLI Mox)
docker exec mox mox config address add dmarc@slavx.ru admin
# → "address added"

# 3. Валидация
docker exec mox mox config test     # → "config OK"
```

Mox применяет изменение конфига **горячо**, без рестарта контейнера. Логи (`docker logs mox`) показали `m="address added" pkg=admin address=dmarc@slavx.ru account=admin`.

**Smoke-проверка (SMTP probe на 127.0.0.1:25 от внешнего домена `gmail.com`):**

- RCPT TO `dmarc@slavx.ru` → принят (`250 2.1.0 now on the list`).
- DATA-фаза дошла до reputation analysis с `rcptto=dmarc@slavx.ru` (был отвергнут только из-за поддельного MAIL FROM gmail.com и SPF softfail — ожидаемо для тестового подключения; реальные рапорты приходят с валидной SPF/DKIM-подписью своих доменов и пройдут).

**Команда отката (если потребуется):**

```bash
ssh TGPT
# Вариант 1 (предпочтительный): убрать только адрес
docker exec mox mox config address rm dmarc@slavx.ru

# Вариант 2: восстановить весь файл из бэкапа и перезагрузить
cp -av /opt/telepost/config/domains.conf.bak.20260516-082029 /opt/telepost/config/domains.conf
docker exec mox mox config test
docker restart mox
```

### 11.4. Известные ограничения / следующие шаги

- DMARC-отчёты теперь падают в Inbox аккаунта `admin@slavx.ru`. Читать их можно через Mox Web Admin (`https://mail.slavx.ru/`) либо IMAP-клиентом (порт 993). Mox также сам парсит входящие DMARC XML и складывает агрегаты в `mox-data/dmarcrpt.db` — Web Admin показывает их в нормализованном виде.
- `postmaster@slavx.ru` (rua для `notify.slavx.ru`) на TGPT всё ещё **не создан**. Аналогично можно сделать `docker exec mox mox config address add postmaster@slavx.ru admin`, либо поменять DNS-запись `_dmarc.notify.slavx.ru` на `rua=mailto:admin@slavx.ru` или `rua=mailto:dmarc@slavx.ru` — см. секцию 6.
- Inbox `admin@slavx.ru` сейчас читает только владелец сервера. Если нужно командное чтение DMARC-отчётов — настроить пересылку или общий ящик отдельно (вне scope этой итерации).
- PTR `77.232.42.136 → janegold.ru` устаревший (исторический hostname). Для inbound-only сервера (MX-приём, без исходящих рассылок проекта) некритично — outbound DMARC alignment проверяется на `smtpserv` (`77.83.92.194`). Поправка PTR — на стороне VPS-провайдера TGPT, вне scope этого репо.
- TGPT обслуживается командой `telepost` ([`/opt/telepost/`](/opt/telepost) — отдельный продукт, telegram-mail bridge); любые крупные изменения конфига Mox согласовывать с этим pipeline.
