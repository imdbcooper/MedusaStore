# Stitch → Frontend: gap-log

**Обновлено:** 2026-05-11
**Статус:** актуальный итог после интеграции Stitch-макетов в storefront и staging/docs sync.

Этот документ коротко фиксирует:

- какие Stitch-макеты использованы;
- что уже перенесено во frontend;
- что есть в коде, но пока слабо выражено в интерфейсе;
- что есть в интерфейсе, но требует backend/CMS/config поддержки;
- что осталось сделать позже.

---

## 1. Использованные макеты

| Область | Stitch reference | Где применено во frontend |
| --- | --- | --- |
| Главная | «Главная: Блок конверсии добавлен» | [`/[countryCode]`](medusa-agency-boilerplate-storefront/src/app/[countryCode]/page.tsx) |
| Каталог | «Каталог: Сортировка добавлена» | [`/[countryCode]/store`](medusa-agency-boilerplate-storefront/src/modules/store/templates/index.tsx) |
| Страница товара | «Предложение: Выбор ниши (Вариант 2)» | [`/[countryCode]/products/[handle]`](medusa-agency-boilerplate-storefront/src/modules/products/templates/index.tsx) |
| Header / меню | StudioPro references из каталога/product/contacts | [`nav/index.tsx`](medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx) |
| Контакты | «Контакты: Обсудим ваш проект» | [`contacts/page.tsx`](medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/contacts/page.tsx) |
| Checkout | «Оформление заказа» | [`checkout/page.tsx`](medusa-agency-boilerplate-storefront/src/app/[countryCode]/(checkout)/checkout/page.tsx) |
| CMS / новости | Общая StudioPro визуальная система | [`content`](medusa-agency-boilerplate-storefront/src/modules/content) |

Локальные reference-файлы Stitch лежат в [`.stitch/designs`](.stitch/designs).

---

## 2. Что уже сделано

### Header / меню

- Header приведён к StudioPro-стилю.
- Верхние углы без скругления, нижние — со скруглением.
- Ширина синхронизирована с основным контейнером контента.
- Меню содержит русские пункты: `Каталог`, `О нас`, `Акции`, `Доставка и оплата`, `Контакты`, `Аккаунт`.
- Корзина подключена к реальной логике: real count, dropdown и переход в cart.

### Каталог

- Каталог приведён к Stitch-макету.
- Добавлены hero, quick-launch card, category pills, inline-сортировка и trust-блок.
- Сортировка работает через реальный `sortBy` query-param.
- Карточки товаров используют реальные Medusa products.
- Высота карточек унифицирована: изображение или placeholder больше не растягивают карточку.

### Страница товара

- Product page приведена к offer-макету Stitch.
- Сохранены реальные product data, images, variants, prices и add-to-cart.
- CTA в стиле Stitch вызывает существующее добавление товара в корзину.
- Product tabs, related products и support blocks оформлены в StudioPro-стиле.

### Checkout

- Checkout получил тёплую StudioPro-оболочку.
- Сохранены реальные шаги Medusa checkout: address, shipping, payment, review, discounts и totals.

### Контакты и маркетинговые страницы

- Добавлена отдельная страница контактов.
- Home, CMS pages, news list/post и rich text получили общий StudioPro visual language.

---

## 3. Есть в коде, но пока слабо видно в интерфейсе

| Возможность в коде | Что сейчас не до конца раскрыто в UI | Что сделать позже |
| --- | --- | --- |
| Account / orders / addresses / profile | Аккаунт пока выглядит ближе к starter utility UI | Сделать полноценный StudioPro account dashboard |
| Region / currency mechanics | На desktop не видно удобного выбора региона/валюты | Добавить аккуратный selector в header или utility-зоне |
| Checkout provider states | Внутренние payment/shipping states частично starter-like | Довести loading/error/disabled/provider states до StudioPro-стиля |
| Promo / discounts | Discount logic есть, но страница `Акции` не связана с реальными promotions | Связать CMS/content и Medusa promotions |
| Empty / error / loading states | Базовые states есть, но визуально неоднородны | Сделать единые StudioPro state-компоненты |
| Category / collection / search logic | Category pills в каталоге пока больше визуальные | Привязать pills к реальным categories/collections или заменить на labels |
| CMS pages / news | Payload integration и seed pages материализованы; `about`, `promotions`, `delivery-and-payment`, `loyalty` являются Payload-контентом при `PAYLOAD_ENABLED=true` | Проверять тексты, SEO metadata, publish-state и fallback при выключенном/пустом Payload |
| Delivery/payment provider UI | Backend/checkout paths есть, но не всё раскрыто визуально | Сделать отдельный UX-pass по доставке и оплате |

---

## 4. Есть в UI, но требует поддержки логикой или контентом

| UI-элемент | Сейчас | Что нужно для production |
| --- | --- | --- |
| Contact form / consultation CTA | Визуальная форма есть, но отправка заявки пока не подключена | Нужен backend/CRM: куда отправлять заявку, как валидировать форму, что показывать после успеха или ошибки |
| `О нас`, `Акции`, `Доставка и оплата`, `Лояльность` | Ссылки/маршруты есть, страницы грузятся через Payload при включенном content layer | Считать пункт закрытым по маршрутам; позже стоит проверить production copy, SEO metadata, publish-state и fallback на случай пустого Payload |
| Category pills | В каталоге это пока визуальные кнопки-категории | Нужно решить: они должны реально фильтровать товары, вести на категории/коллекции или остаться просто подсказками |
| Trust claims / badges | Плашки доверия и маркетинговые цифры выглядят готовыми | Нужно подтвердить, что обещания и цифры можно использовать публично, и определить, кто их редактирует |
| Niche selector / value props | Блоки пользы и выбора ниши частично собираются из данных товара, частично из fallback-текста | Нужно завести понятные поля/таксономию для офферов, чтобы эти блоки не были случайным текстом |
| Static contact channels | Часть контактов и способов связи задана статично | Нужно хранить контакты в одном месте — config или Payload, чтобы они не расходились на разных страницах |
| Stitch/reference images | Используются изображения/reference assets из Stitch | Нужно заменить их на собственные production-изображения или подтвердить права на использование |

---

## 5. Что добавлено сверх буквального макета

Эти элементы добавлены не случайно — они нужны реальному storefront:

- real cart icon/count/dropdown в desktop header;
- account link;
- localized routes с `countryCode`;
- рабочая сортировка каталога;
- реальные product cards вместо статичных Stitch-карточек;
- variants, price, stock state и add-to-cart на странице товара;
- checkout summary, discount, shipping/payment states;
- footer/content/category links из реальных данных.

---

## 6. Что из Stitch не перенесено буквально

- Static catalog cards заменены реальными Medusa product cards.
- Static product lead form не стал новой бизнес-фичей — вместо него используется существующий add-to-cart flow.
- Checkout из Stitch не заменил Medusa checkout state machine.
- Header адаптирован под commerce-задачи: русское меню, account и real cart.
- Category pills пока не фильтруют товары.
- Contact form пока не отправляет данные.
- Footer сохранён как реальная навигация, а не буквальная копия макета.

---

## 7. Backlog

1. Привести account pages к StudioPro-стилю.
2. Доработать checkout inner states: delivery/payment/loading/error/return.
3. Решить, чем должны быть category pills: фильтры, ссылки или labels.
4. Проверить production copy, SEO metadata и publish-state для Payload pages (`about`, `promotions`, `delivery-and-payment`, `loyalty`).
5. Подключить backend/CRM для contact form или заменить форму на простой CTA.
6. Добавить desktop region/currency selector.
7. Унифицировать все empty/error/loading states.
8. Проверить маркетинговые claims, badges и права на изображения.
9. Довести category/collection pages до уровня `/store`.
10. Заменить reference media на production-owned assets.

---

## 8. Проверки

| Проверка | Статус |
| --- | --- |
| `npm --prefix ./medusa-agency-boilerplate-storefront run lint` | Последний зафиксированный pass был успешным; при изменениях frontend запускать заново. |
| `npm run storefront:build` | Production build должен допускать Store API warnings во время static params collection, но dynamic product route требует runtime smoke. |
| `npm --prefix ./medusa-agency-boilerplate-storefront run typecheck` | Старые delivery legacy ссылки считать stale: актуальный файл для checkout utility tests — [`delivery-checkout.spec.ts`](../medusa-agency-boilerplate-storefront/src/lib/util/delivery-checkout.spec.ts). |
| Product runtime smoke | Для существующего товара `/ru/products/<handle>` должен отвечать `200`; dynamic rendering не подтверждается одним build/static params pass. |

---

## 9. Коммиты по Stitch/frontend работе

- `84122ab` — `feat(storefront): align Stitch storefront surfaces`
- `2fb96d6` — `chore(scripts): add storefront production preview controls`
- `5367fd5` — `docs: record Stitch storefront audit`
- `d597f19` — `chore(repo): ignore local generated artifacts`
- `9caeeb6` — `docs(stitch): add storefront design prompt`

---

## 10. Текущий итог

Основная визуальная интеграция Stitch закрыта для:

- header/menu;
- каталога;
- страницы товара;
- контактов;
- checkout shell;
- home/editorial surfaces.

Главные оставшиеся зоны — account, глубокие checkout states, contact form backend, region/currency UX и production-ready content/media governance. CMS route availability больше не считается открытым blocker: Payload staging production-mode container, Caddy `/payload/*`, seeded content pages и storefront content rendering materialized; оставшийся риск — качество/актуальность launch content и publish/DB state.
