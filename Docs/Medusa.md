# 🚀 Medusa.js — Полный гид для фриланс-магазинов

> **Historical/deprecated snapshot (2026-05-11):** this document is a historical planning snapshot and must not be used as the current operational source of truth. Use [`README.md`](../README.md), [`Docs/architecture.md`](./architecture.md), [`Docs/production_runbook.md`](./production_runbook.md), [`Docs/local_development.md`](./local_development.md), [`Docs/staging_runbook.md`](./staging_runbook.md), and [`Docs/troubleshooting.md`](./troubleshooting.md) for current operations.


## 🎯 ЦЕЛЬ
Open source основа интернет-магазинов для кастома дизайна под клиентов (не WooCommerce/PrestaShop).

## ✅ ВЫБОР: MEDUSA.JS (Node.js/Next.js/Headless)
**Почему идеально**:
- MIT лицензия: полный код, self-hosted бесплатно.
- `npx create-medusa-app` = backend + admin + storefront за 15 минут.
- Headless API + любой фронт (Next.js / Vue / Svelte).
- PageSpeed 95+ благодаря SSR/SSG.

## 🏗️ АРХИТЕКТУРА
Express API → Workflows → Modules → Postgres/Redis/S3
├── Admin UI (React): localhost:7001
├── Storefront (Next.js): historical local example: localhost:3000
├── REST/GraphQL API: localhost:9000
└── File Service (S3/MinIO)

## 📦 ИЗ КОРОБКИ
✅ Backend: продукты / заказы / клиенты / склад / платежи
✅ Admin: RBAC роли, дашборды, аналитика, inventory
✅ Storefront: главная + hero + продукты + корзина + checkout
✅ Inventory: мультисклад, резервы, low-stock алерты
✅ SEO: Metadata API + SSR/SSG + Schema.org

## 💰 РОССИЯ ИНТЕГРАЦИИ
🔥 ЮKassa: `npm i historical package example: medusa-payment-yookassa` (54-ФЗ чеки)
🔄 1C: XML CommerceML sync каждые 5-15 минут (gorgo/medusa-1c beta)
📦 Склад: Inventory Module + остатки из 1C

## 🎨 КАСТОМИЗАЦИЯ
ФРОНТ: `src/components/*.tsx` + Tailwind config
Главная: hero slider + featured carousel + collections grid
SEO: `generateMetadata()` + `sitemap.xml` + JSON-LD
Темы: нет theme-marketplace, правка кодом

## 🚀 ПРОЦЕСС РАЗРАБОТКИ
`npx create-medusa-app` → ЮKassa → дизайн → VPS 300₽ + Vercel → клиент

## 📈 МОДУЛИ / ПЛАГИНЫ
⭐ Отзывы: `@lambdacurry/medusa-product-reviews` (текст + фото/видео)
🔍 Поиск: Meilisearch plugin
🤖 AI RAG: Vercel AI SDK + Medusa API
🎨 Главная: Builder.io drag-drop

## ⚖️ ПЛЮСЫ И МИНУСЫ
✅ Бесплатно
✅ PageSpeed 95+
✅ Docker/K8s
✅ 100+ plugins
✅ AI-ready

❌ Нет theme-marketplace
❌ API базовые фильтры
❌ 1C не real-time
❌ Node.js learning curve
❌ Русскоязычное комьюнити маленькое

## 💸 БИЗНЕС МОДЕЛЬ
15-50к₽ за магазин за 2-5 дней
VPS 300₽/мес + домен 200₽/год
Support: 3-5к₽/мес за обновления и поддержку

## 🎯 ВЕРДИКТ
ИДЕАЛЬНО: tech-фрилансеры с JS/React
НЕ ДЛЯ: новичков и 1-click решений

## 🚀 СТАРТ
```bash
npx create-medusa-app@latest my-store
cd my-store && npm run dev