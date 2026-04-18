# Storefront Core Baseline v1

[`medusa-agency-boilerplate-storefront/`](medusa-agency-boilerplate-storefront/) is the Next.js storefront baseline for the Medusa template backend in [`medusa-agency-boilerplate/`](medusa-agency-boilerplate/).

## Scope

This storefront baseline covers the core commerce entrypoints:

- home
- catalog
- category
- collection
- product
- cart
- checkout
- account
- confirmed order

The goal of this workstream is baseline consistency for runtime, shopper-facing copy, and provider-aware checkout presentation. It does not introduce new backend APIs or new feature tracks.

## Runtime contract

Local baseline assumptions:

- backend: [`http://localhost:9000`](http://localhost:9000)
- storefront: [`http://localhost:8000`](http://localhost:8000)
- default region: [`ru`](medusa-agency-boilerplate-storefront/.env.local.example)
- optional locales must not break runtime
- [`NEXT_PUBLIC_YOOKASSA_ENABLED`](medusa-agency-boilerplate-storefront/.env.local.example) stays opt-in
- Stripe-compatible variables remain optional compatibility inputs only

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Required storefront variables:

```env
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=REPLACE_WITH_ROOT_BOOTSTRAP
NEXT_PUBLIC_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_REGION=ru
```

Optional compatibility variables:

```env
NEXT_PUBLIC_YOOKASSA_ENABLED=false
NEXT_PUBLIC_STRIPE_KEY=
NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY=
NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID=
```

## Install and run

Install dependencies:

```bash
npm install
```

Start local development:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

## Checkout baseline

Storefront presentation assumes:

- YooKassa-first hosted checkout flow when that provider is enabled in backend and selected in checkout
- manual payment fallback remains available
- Stripe-compatible card presentation is supported only when compatible publishable variables are provided
- ApiShip storefront presentation shows the cheapest available quote for the selected shipping option

The storefront does not redefine backend payment or shipping logic.

## Validation

Recommended baseline verification for this storefront:

```bash
npm run lint
npm run build
```

If TypeScript is run directly in this package, existing deprecation warnings from [`tsconfig.json`](medusa-agency-boilerplate-storefront/tsconfig.json) may appear. Those warnings are outside this storefront baseline workstream unless they block lint or build.

## Non-goals

This storefront baseline intentionally does not include:

- VK ID
- MTS Exolve
- Payload CMS
- marketing layer
- client-specific branding system
- theme engine
- translation-management layer
- new backend APIs
- multi-quote shipping UX
- future provider-specific extensions such as `providerConnectId` or `extraParams`
