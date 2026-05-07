# Stitch → Frontend gap-log

Дата обновления: 2026-05-08

Статус: финальный аудит после последней подгонки header/catalog/product под Stitch и после проверки текущего git working tree. Документ фиксирует не только что было перенесено из Stitch, но и что в коде storefront осталось сильнее интерфейса, а что в UI/Stitch пока является presentation layer без отдельной backend/business-логики.

## 1. Использованные Stitch-макеты и локальные reference материалы

Stitch-проект: `projects/4992179067643403016` — DesignStore / StudioPro.

| Назначение | Stitch screen | Локальные материалы | Текущий frontend scope |
| --- | --- | --- | --- |
| Главная | `projects/4992179067643403016/screens/38433652139c4292992849e48ac94e56` — «Главная: Блок конверсии добавлен» | `.stitch/designs/home.html`, `.stitch/designs/home.png` | `/[countryCode]`: hero, trust/architecture/process/CTA surfaces поверх real collection/product rails. |
| Каталог | `projects/4992179067643403016/screens/ac9e421eb307491984a94b5875aae13e` — «Каталог: Сортировка добавлена»; ранний reference `9b4fe4edf6c64872a64d42a1c779f37d` — «Каталог: Выберите ваш сайт» | `.stitch/designs/catalog.html`, `.stitch/designs/catalog.png` | `/[countryCode]/store`: warm canvas, hero, quick-launch card, category pills, inline sort, bento grid, trust block. |
| Product / offer | `projects/4992179067643403016/screens/54b9fa578e6049c499ca22a3cff339ce` — «Предложение: Выбор ниши (Вариант 2)» | `.stitch/designs/offer.html`, `.stitch/designs/offer.png` | `/[countryCode]/products/[handle]`: two-column offer layout, real image/product info/actions, niche pills, benefits, tabs, related products. |
| Header/style references | Те же актуальные StudioPro screens, в первую очередь каталог и contacts/product screenshots | `.stitch/designs/catalog.png`, `.stitch/designs/contacts.png`, `.stitch/designs/offer.png` | Sticky cream header-card, rounded bottom, StudioPro brand, Russian desktop nav, account, real cart icon/count/dropdown, contacts CTA. |
| Контакты | `projects/4992179067643403016/screens/2b1365d85ad34f88a8ed0b6407589248` — «Контакты: Обсудим ваш проект» | `.stitch/designs/contacts.html`, `.stitch/designs/contacts.png` | `/[countryCode]/contacts`: contact hero/form shell, channels, principles, supporting cards. |
| Checkout | `projects/4992179067643403016/screens/122e60398aa7437eb1c8e8aa44ee64e5` — «Оформление заказа» | `.stitch/designs/checkout.html`, `.stitch/designs/checkout.png` | `/[countryCode]/checkout`: warm shell/summary styling вокруг real Medusa checkout steps. |
| Editorial/CMS surfaces | Общая визуальная система Stitch, не отдельный буквальный screen | n/a | `/[countryCode]/[slug]`, `/[countryCode]/news`, `/[countryCode]/news/[slug]`: Payload pages/news в Stitch-compatible tokens/cards/CTA. |

## 2. Что уже закрыто последними frontend правками

| Область | Итоговое состояние | Сохранённая core-логика |
| --- | --- | --- |
| Header/menu | Desktop header приведён к StudioPro style: warm canvas, cream card `68px`, width `1280px`, `StudioPro`, русские пункты `Каталог / О нас / Акции / Доставка и оплата / Контакты`, `Аккаунт`, CTA `Контакты`, mobile side menu. | Links проходят через localized routing; account и cart не заменены статикой; side menu сохраняет region/language/content links. |
| Real cart icon/count/dropdown | Desktop header получил compact real cart icon, badge/count и dropdown; mobile/offcanvas cart flow сохранён. | Используется существующий `CartButton`/`CartDropdown`, real cart retrieval, line items, subtotal, link to cart/checkout. |
| Catalog layout | `/store` приведён к актуальному Stitch catalog: hero без лишней white-card shell, quick-launch card, category pills, inline sort, bento product grid, trust block. | Product grid строится из Medusa products; region-aware prices, product links, pagination и `listProductsWithSort` сохранены. |
| Catalog sort | Inline sort из Stitch подключён к реальной логике. | `sortBy` query-param сбрасывает `page` и вызывает существующий сортировочный/pagination flow. |
| Equal card heights | Featured/compact cards выровнены до общего height target; image/placeholder зоны фиксированы. | Карточки всё ещё используют реальные title/description/thumbnail/images/prices/handles. |
| Product offer page | Product page приведена к Stitch offer-макету: left info/actions/support, right image/niche/benefits, `1280px` container, warm canvas, offer card. | Product fetch, `v_id`, variant selection, inventory/backorder checks, price region logic и add-to-cart сохранены. |
| Product add-to-cart | Stitch-styled CTA `Start Setup Process` вызывает существующее добавление товара в cart. | Используется `addToCart`, selected variant, countryCode, real cart update. |
| Checkout shell | Checkout получил Stitch-compatible shell, summary card и warm typography. | Address/shipping/payment/review, YooKassa return handling, discount code, cart totals и provider flow сохранены. |
| Contacts page | Добавлена real route `/contacts` с Stitch contact surface. | Это presentation/contact-entry surface без нового backend submit endpoint. |
| Marketing/editorial surfaces | Home, content pages, news list/post и rich text получили общий StudioPro/Stitch styling. | Payload CMS fetch/render flow и Medusa commerce core не форкались. |

## 3. Есть в коде/логике storefront, отсутствует или частично выражено в текущем интерфейсе

| Code/business capability | Где в коде/flow | UI-gap / слабое выражение | Риск / следующий шаг |
| --- | --- | --- | --- |
| Account dashboard, profile, orders, addresses, order transfer | `/account`, `/account/orders`, `/account/addresses`, `/account/profile`, order transfer pages | Header даёт вход в аккаунт, но сами account screens в основном сохраняют starter/Medusa utility UI и не приведены к StudioPro/Stitch card language на уровне главной/каталога/product. | В отдельной задаче сделать Stitch-compatible account system: dashboard cards, order states, address forms, profile/marketing preferences, transfer request UX. |
| Region/country/locale selection | `SideMenu`, `CountrySelect`, `LanguageSelect`, region-aware routes/prices | Region selector в основном спрятан в mobile/side-menu; desktop header не показывает country/currency selector. Currency не объясняется пользователю как часть коммерческого контекста. | Добавить аккуратный desktop region/currency affordance, не ломая localized routes и Medusa region lookup. |
| Full checkout delivery/payment state machine | Checkout components: address, delivery/shipping, payment, review, YooKassa, provider map | Shell стилизован, но внутренние provider-specific states остаются частично starter-like; не все loading/error/empty/disabled states визуально доведены до StudioPro. | Провести отдельный checkout UX pass: provider-specific cards, pending/error banners, unavailable rates, payment redirects, post-return states. |
| Promo/discount logic | `DiscountCode`, cart totals, promotions on cart | Discount UI есть в cart/checkout summary, но маркетинговые `Акции` в header ведут на потенциальную content route; между promo page/content governance и реальной promotion eligibility нет явной связки. | Описать и реализовать promotion governance: источники контента, условия, disclaimers, связь с Medusa promotions. |
| Empty/error/loading states | Cart empty, skeleton grids, notFound, component-level errors | Есть базовые states, но они не полностью покрыты Stitch language: product/category empty, Store API unavailable, cart dropdown empty, account no-orders, checkout provider errors выглядят неоднородно. | Сделать inventory of all states и унифицировать их через StudioPro tokens/components. |
| Search/filter/category/collection logic | Categories, collections, pagination, `RefinementList`, product/category/collection routes | Catalog screen показывает category pills как presentation-only buttons; полноценный search/filter UI не выведен. Category/collection pages существуют, но не все визуально подогнаны к свежему catalog макету. | Связать category pills с реальными category/collection routes или явно скрыть как декоративные; добавить search/filter при наличии требований. |
| CMS pages/blog/news | Payload content pages, news list/post, block renderer/rich text | CMS/editorial UI стилизован, но нет полного content governance для routes вроде `about`, `promotions`, `delivery-and-payment`; часть header links зависит от наличия Payload pages. | Seed/validate обязательные pages и fallback copy; добавить smoke для ключевых CMS routes. |
| Shipping/payment provider-specific UI | ApiShip/Gorgo/YooKassa/Medusa payment surfaces в checkout/backend | Product/support copy говорит о delivery/payment, но provider-specific customer UI не раскрывает все тарифы/ПВЗ/ошибки/ограничения на уровне Stitch. | Отдельный delivery/payment UX audit после финализации provider baseline; не смешивать с визуальной Stitch интеграцией. |
| Marketing preferences / VK link / notification flows | Account profile marketing preferences, VK link components, notification baseline | В StudioPro marketing UI эти возможности почти не видны. | Решить, нужны ли они в клиентском интерфейсе StudioPro или остаются account utility surfaces. |

## 4. Есть в UI/Stitch, но требует backend/content/config поддержки

| UI/Stitch element | Текущая реализация | Что нужно для production-grade поддержки |
| --- | --- | --- |
| Marketing CTA «Бесплатная консультация», «Отправить запрос», contact form | Presentation-only form/button на contacts/home/product surfaces; submit endpoint не добавлялся. | Backend/API или CRM integration, validation, consent text, spam protection, email/notification pipeline, success/error states. |
| Header links `О нас`, `Акции`, `Доставка и оплата` | Real localized links в header; зависят от content pages / fallback content routes. | Обязательные Payload seed pages или static routes, SEO metadata, content ownership, smoke checks. |
| Category pills в catalog hero | Static Stitch-derived pills из `mockData`, первый pill active visually; не фильтруют список. | Маппинг на реальные categories/collections/search filters или смена semantics на non-clickable labels. |
| Quick launch / quality / trust claims | Текстовые cards в style Stitch. | Content governance: кто утверждает claims, доказательства, legal review, локализация, обновление при изменении SLA. |
| Niche selector/value props на product page | Формируется из product tags/categories или fallback; часть benefits static. | Реальная продуктовая таксономия, governance для value props, связь с offer/package metadata. |
| Process/portfolio/pricing style sections | Process timeline есть на home; `Portfolio/Pricing` как старый StudioPro reference не закреплены как реальные страницы; текущий header использует русские links. | Если нужны как nav/routes — добавить content pages или полноценные modules с owner/content model. |
| Contact channels | В contact surface часть contacts static и отличается от `storefrontConfig.contact`. | Свести к единому config/CMS source, убрать placeholder-like данные перед production. |
| Visual badges (`Popular`, `Launch-ready`, `500+ компаний`) | Presentation badges из Stitch/client config. | Подтверждение claims, возможность отключения/редактирования через config/CMS. |
| External Stitch visual assets | Next image host разрешён; assets используются как visual references. | Проверить лицензии/источник, заменить placeholder assets на production-owned media, добавить media governance. |

## 5. Элементы, добавленные в UI из-за требований текущей логики

- Real cart icon/count/dropdown в desktop header: актуальный Stitch-header изначально был marketing-first, но storefront требует доступ к корзине и cart feedback после add-to-cart.
- Account link в header и side menu: нужен для существующих account/orders/address flows.
- Localized routes и countryCode wrapper для всех ключевых CTA/nav links: без этого ломаются region-aware Medusa routes.
- Inline sort control в каталоге: Stitch показывал сортировку, поэтому она подключена к реальному `sortBy`, а не оставлена декоративной.
- Pagination/product grid на реальных товарах: static cards из Stitch заменены data-driven Medusa cards.
- Product variant selector, price, stock state и add-to-cart внутри offer shell: static lead-form из Stitch не вводился как новая бизнес-логика.
- Product tabs, support highlights, related products и technical specs: добавлены как мост между offer storytelling и реальными product/commerce requirements.
- Checkout summary/discount/shipping/payment states внутри Stitch shell: static checkout visual не заменял Medusa checkout state machine.
- Footer category/collection/content links: сохранены, потому что footer в storefront работает как реальная навигация по Medusa/Payload данным.

## 6. Что из Stitch не перенесено буквально и почему

- Static catalog cards не скопированы один-в-один: они заменены real Medusa product cards, иначе потерялись бы handles, prices, region logic, pagination и stock/cart flow.
- Static product offer lead form не введён как новая бизнес-фича: его visual shell оборачивает существующие `ProductActions`, чтобы сохранить variants/add-to-cart.
- Checkout form из Stitch не заменил Medusa checkout: сохранены address/shipping/payment/review/YooKassa/discount/order flows.
- Header несколько раз корректировался по актуальному StudioPro reference и пользовательскому фидбеку: финальное состояние — русская навигация и real cart, а не буквальная английская nav без commerce affordance.
- Category pills пока не фильтруют товары: они перенесены как visual taxonomy, потому что real filter/search scope не входил в текущую задачу.
- Contacts form не отправляет данные: backend/CRM endpoint не добавлялся, чтобы не расширять business scope аудита.
- Footer не копировался из Stitch буквально: сохранены region-aware category/collection/content links.
- Portfolio/pricing/process anchors из ранних StudioPro references не форсировались в header как реальные routes: без content/model они были бы dead links.

## 7. Backlog / что осталось на потом

1. Account UI pass: привести `/account`, orders, addresses, profile, marketing preferences и transfer request к StudioPro/Stitch components.
2. Checkout inner-state pass: delivery/payment provider cards, ApiShip/YooKassa-specific states, loading/error/disabled/return banners, unavailable rates.
3. Real catalog filtering/search: решить semantics category pills, добавить search/filter UI только после утверждения data model.
4. CMS route readiness: обеспечить Payload pages для `about`, `promotions`, `delivery-and-payment`, content ownership и smoke checks.
5. Contact form backend: подключить submit endpoint/CRM/notifications/consent/success-error states или явно заменить form на mailto/brief CTA.
6. Region/currency UX: вывести desktop-friendly selector и пояснение валюты/региона без нарушения localized routing.
7. Unified empty/error/loading states: storefront-wide state components в StudioPro style.
8. Content/claims governance: заменить placeholder contacts, проверить `500+`, `Popular`, trust badges, delivery/payment claims и media rights.
9. Category/collection pages parity: проверить, насколько pages за пределами `/store` соответствуют свежему catalog/product visual direction.
10. Production media policy: заменить Stitch/reference images на owned assets или задокументировать лицензионный источник.

## 8. Проверки и audit evidence

| Проверка | Результат |
| --- | --- |
| Git status/diff перед аудитом | Working tree содержит крупный набор незакоммиченных frontend, scripts, docs и Delivery Hub-related изменений; staged files отсутствовали. Мусорные PNG/reference screenshots и generated-images присутствуют как untracked и не должны попадать в коммиты без явной необходимости. |
| Code/UI audit | Проверены header, catalog, product, checkout, contacts, home/editorial surfaces, storefront config, account/category/collection/cart/checkout capabilities через чтение кода и search. |
| Scope guard | Новые UI-фичи не добавлялись; аудит ограничен документацией и подготовкой коммитов. Backend/migrations/env не менялись в рамках финального Stitch audit. |
| `npm --prefix ./medusa-agency-boilerplate-storefront run lint` | Успешно, exit code 0. Остался известный warning `react-hooks/exhaustive-deps` в `src/modules/checkout/components/shipping/index.tsx:245`. |
| `npm run storefront:build` | Успешно, exit code 0. Next.js production build завершён, static product paths включают `/ru/products/test-product` и другие handles. |
| `npm --prefix ./medusa-agency-boilerplate-storefront run typecheck` | Не прошёл, exit code 2, только на известной unrelated ошибке `src/lib/util/delivery-hub.spec.ts(72,8): Cannot find module './delivery-hub-preview.ts' or its corresponding type declarations.` Ошибка не исправлялась, потому что не относится к Stitch/frontend UI. |

## 9. План коммитов

Финальная группировка должна оставаться логической, а не одним большим commit:

1. `feat(storefront): align Stitch storefront surfaces` — только storefront UI/Stitch integration и локальные `.stitch/designs` reference материалы, без screenshots/generated images и без unrelated backend Delivery Hub work.
2. `chore(scripts): add storefront production preview controls` — root script alias, `scripts/manage.sh`, `scripts/storefront-start.sh`, `scripts/MANAGE.md` и связанные launch/manage changes, если они ещё не закоммичены.
3. `docs: record Stitch storefront audit` — `Docs/stitch_frontend_gap_log.md` и релевантные operational docs, включая результаты проверок/commit hashes после создания коммитов.
4. Delivery Hub/backend изменения, если пользователь решит их коммитить отдельно, должны идти отдельным смысловым коммитом и не смешиваться со Stitch/frontend UI. В текущем Stitch audit они рассматриваются как unrelated working-tree residue.

## 10. Текущий статус после аудита

- Header/catalog/product основные gaps по Stitch закрыты для проверяемых storefront pages.
- Крупнейшие оставшиеся gaps: account UI, provider-specific checkout states, region/currency desktop UX, real search/filter semantics, CMS route readiness, contact form backend, governance для marketing claims/assets.
- Untracked screenshots/reference PNG и `generated-images/` считаются временными audit artifacts; их нельзя добавлять в git-коммиты без отдельного решения.
