---
name: medusa-master-repo
description: Use when working in this medusa-agency-boilerplate repository on planning, implementation, architecture, integrations, storefront strategy, or status tracking. This skill tells Codex which local documents are the source of truth, what project state is already confirmed, and which docs must be updated after meaningful changes.
---

# Medusa Master Repo

Use this skill for any substantial work in this repository.

## First Read

Read documents in this order:

1. `Docs/current_work.md`
   This is the canonical answer to: what are we doing now, where is the current work happening, and what should an agent do first with empty context.
2. `Docs/master_repo_plan_v2.md`
   This is the main roadmap and the canonical project plan.
3. `Docs/plan_analysis.md`
   This is the audit of what is actually done, partially done, blocked, or overstated.
4. `Docs/env_contract.md`
   Read this when working on local startup, ports, env files, or root orchestration.
5. Relevant code and config files
   Trust the repository state over narrative documents.
6. `Docs/master_repo_guide.md`
   Use only for older business framing and historical context. Do not trust its status table as canonical.
7. `Docs/medusa_project_summary.md` and `Docs/Medusa.md`
   Use as background and reference only.

## Current Known Reality

Before making claims, remember these points were already verified:

- Root `package.json` and `scripts/` are now the canonical entrypoint for bootstrap, preflight, dev, build, smoke, and permission repair.
- This master repo is built for the Russian market by default; market-fit for a typical RF store is a higher-priority filter than first-party convenience.
- The clean-state onboarding path `cp .env.example .env` → `npm run bootstrap` → `npm run preflight` → `npm run dev` is confirmed.
- The canonical root startup contract must be read literally as `bootstrap` → `preflight` → `dev`, not as a generic wrapper over arbitrary already-running local services.
- [`scripts/preflight.sh`](../../../scripts/preflight.sh) only allows runtime reuse for compose-owned PostgreSQL, Redis, and backend where that path is explicitly supported.
- Busy local `9000` or `8000` ports from unrelated processes remain an expected failure mode outside the canonical clean-start path.
- After bootstrap, the confirmed baseline includes `ru` region, `rub` as baseline currency, a publishable API key, a sales channel, and a minimal shipping skeleton.
- The baseline no longer depends on a mandatory demo-catalog bootstrap.
- Gate A, Phase 1, and Phase 2 are confirmed closed for the verified clean-state path.
- Notification v1 is already confirmed as the first integration slice of Phase 3.
- That confirmed notification slice currently means:
  - Notification Module;
  - local provider for dev;
  - `UniSender` path for production;
  - provider-agnostic workflow;
  - admin smoke route;
  - opt-in helper for on-demand secret admin API key generation.
- Notification hardening v1 is also confirmed as closed.
- That confirmed notification hardening result means:
  - baseline-safe mode without external notification secrets is verified;
  - `NOTIFICATION_EMAIL_PROVIDER=local` remains the baseline-default;
  - `unisender` without `UNISENDER_API_KEY` does not break startup, build, or runtime and falls back to the local provider;
  - the authenticated smoke path is verified through a fresh secret admin API key and Basic auth;
  - helper [`createSecretAdminApiKey()`](../../../medusa-agency-boilerplate/src/scripts/create-secret-admin-api-key.ts:22) must create a fresh `sk_*` key for the canonical smoke path and must not rely on reusing a previously read token;
  - route [`POST()`](../../../medusa-agency-boilerplate/src/api/admin/notifications/smoke/route.ts:26) returns a stable response shape with `ok`, `request`, `auth`, `provider`, and `notification` blocks;
  - workflow [`sendNotificationSmokeWorkflow`](../../../medusa-agency-boilerplate/src/workflows/send-notification-smoke.ts:60) and runtime helper [`getNotificationEmailRuntime()`](../../../medusa-agency-boilerplate/src/modules/notification-email.ts:45) are aligned on requested and resolved provider semantics.
- Payment v1 is already confirmed for the current YooKassa-first scope.
- That current payment slice means:
  - provider registration;
  - session initiation;
  - hosted redirect and return path;
  - webhook and status handling;
  - minimal storefront provider-aware adaptation.
- The integration env-contract was expanded with opt-in variables:
  - `NOTIFICATION_EMAIL_PROVIDER`;
  - `NOTIFICATION_EMAIL_FROM`;
  - `UNISENDER_API_KEY`;
  - `UNISENDER_BASE_URL`;
  - `YOOKASSA_SHOP_ID`;
  - `YOOKASSA_SECRET_KEY`;
  - `YOOKASSA_RETURN_URL`;
  - `YOOKASSA_STOREFRONT_RETURN_ORIGINS`;
  - `YOOKASSA_WEBHOOK_URL`;
  - `YOOKASSA_WEBHOOK_SECRET`;
  - `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS`;
  - `NEXT_PUBLIC_YOOKASSA_ENABLED`;
  - `APISHIP_TOKEN`;
  - `APISHIP_TEST_MODE`.
- Shipping v1 is now confirmed for the current ApiShip-first scope.
- That current shipping slice means:
  - opt-in provider registration in [`medusa-config.ts`](../../../medusa-agency-boilerplate/medusa-config.ts);
  - fulfillment provider in [`src/modules/apiship.ts`](../../../medusa-agency-boilerplate/src/modules/apiship.ts);
  - store route for rate lookup in [`src/api/store/apiship/rates/route.ts`](../../../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts);
  - seed path for the shipping option in [`src/scripts/seed.ts`](../../../medusa-agency-boilerplate/src/scripts/seed.ts);
  - storefront data layer in [`src/lib/data/apiship.ts`](../../../medusa-agency-boilerplate-storefront/src/lib/data/apiship.ts) and [`src/lib/data/cart.ts`](../../../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts);
  - checkout shipping selection in [`src/modules/checkout/components/shipping/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx);
  - safe-by-default live/test behavior via `APISHIP_TEST_MODE`, with test-mode as the fallback default unless live is explicitly enabled;
  - root orchestration is aligned to the same rule: [`scripts/env-sync.sh`](../../../scripts/env-sync.sh) must sync `APISHIP_TEST_MODE=true` into backend env when root env does not define it, so missing orchestration input never silently enables live;
  - the confirmed runtime path `2026-04-18` used a production token and explicit `APISHIP_TEST_MODE=false` for live validation;
  - ETA fallback support from legacy `daysMin/daysMax` to newer `workDays*` and `calendarDays*` fields in [`GET()`](../../../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts:67);
  - structured diagnostic hardening for request failures in [`request()`](../../../medusa-agency-boilerplate/src/modules/apiship.ts:216);
  - honest `cheapest_only_v1` semantics instead of a claimed multi-quote checkout;
  - targeted fixes in [`route.ts`](../../../medusa-agency-boilerplate/src/api/store/apiship/rates/route.ts) and [`seed.ts`](../../../medusa-agency-boilerplate/src/scripts/seed.ts) closed the actual blocker, and ApiShip/Yandex rates now return at runtime.
- Baseline verification still holds after the notification, payment, and first shipping slice:
  - [`npm run bootstrap()`](../../../package.json:14), [`npm run preflight()`](../../../package.json:8), and [`npm run dev()`](../../../package.json:24) still work without mandatory payment secrets, without mandatory `APISHIP_TOKEN`, and without mandatory external notification secrets;
  - canonical root orchestration now explicitly syncs YooKassa guardrails `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, optional `YOOKASSA_WEBHOOK_URL`, and safe default `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=false` into backend env before runtime starts;
  - notification runtime now has verified fallback semantics between requested and resolved provider;
  - ApiShip provider is only enabled when a token is present;
  - shipping option `ApiShip Courier to Address` appears after a repeat seed in an ApiShip-enabled environment;
  - storefront checkout `500` was separated as a cart and data-state issue, not a confirmed shipping code regression;
  - clean onboarding remains opt-in and baseline-safe for the added notification, payment, and shipping env.
- Checkout end-to-end validation v1 is now confirmed.
- That confirmed checkout path means:
  - the full runtime/E2E chain `shipping → hosted YooKassa payment → automatic return → review → order placement → confirmed order page` was actually completed;
  - the earlier `payment_collection` blocker is closed and should no longer be treated as the current issue;
  - targeted fix in [`payment-button/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) prevents calling [`placeOrder()`](../../../medusa-agency-boilerplate-storefront/src/lib/data/cart.ts:404) before hosted authorization finishes;
  - targeted fix in [`cookies.ts`](../../../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) changed [`setCartId()`](../../../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts:74) from `sameSite: "strict"` to `sameSite: "lax"` so cart state survives the cross-site return from hosted payment.
- Remaining validated limits must be stated honestly:
  - the ApiShip blocker for the current `cheapest_only_v1` slice is closed;
  - the confirmed runtime path used a production token with explicit live mode and now returns ApiShip/Yandex tariffs;
  - the first customer-facing post-order notification path is still not fully validated;
  - true multi-quote checkout and `providerConnectId` / `extraParams` support remain outside the current scope.
- Re-running `npm run bootstrap` on an already populated database is now **confirmed as idempotent** via runtime validation (`2026-04-17`): all baseline entities are reused, the same publishable key is emitted, no duplicates are created, and conflicting database state correctly triggers exit code 1 without updating storefront env.
- The storefront redirect edge-case in `medusa-agency-boilerplate-storefront/src/middleware.ts` was fixed and rechecked; the redirect-loop is no longer reproducible and normal middleware semantics were preserved.
- `docker-compose.yml` currently covers PostgreSQL, Redis, and backend, but not the storefront.
- Backend generated directories `.medusa` and `node_modules/.vite` may inherit bad ownership from older container runs; `npm run permissions:fix` repairs them.
- The next default workstream is no longer inside template-readiness formalization, and it is not `notification hardening v1`, `bootstrap idempotency hardening v1`, `choose a payment path`, `choose a shipping provider`, or `checkout end-to-end validation v1`.
- `Phase 7 / tranche 1` `client-init contract and placeholder-safe template baseline` is now truthfully closed by commit `a96aa81adfd655ddda9b6fea03dacf61c3174737` `feat(template): add client-init contract baseline`; the canonical contract is [`Docs/client_init_contract.md`](../../../Docs/client_init_contract.md), the blocking inconsistency for `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, and `NEXT_PUBLIC_DEFAULT_REGION` was remediated to match optional runtime semantics, and the repeated review verdict is **APPROVE**.
- The next default workstream after that closure stays inside `Phase 7` template/client packaging as the template release checklist, onboarding doc, and cleaned template release/package path, not as a re-opened Phase 6 or a premature Phase 8 rollout.
- `VK Community Messaging v1 foundation` is now implemented as an opt-in Notification Module expansion after the already completed `UniSender email migration v1` and `post-UniSender cleanup-step`.
- The immediate communication follow-up should build on the implemented VK foundation without silently expanding scope into `VK ID`, SMS, or marketing-layer tracks.
- Bootstrap idempotency hardening v1 is **confirmed via runtime validation** (`2026-04-17`) and no longer an open concern.
- The canonical template-readiness regression source of truth is [`Docs/template_readiness_regression.md`](../../../Docs/template_readiness_regression.md).
- The canonical local authenticated notification smoke path is `fresh secret admin API key` → `Basic auth` → `POST /admin/notifications/smoke`, with an allowed lightweight helper via [`npm run smoke:notification`](../../../package.json:23).
- The ApiShip return path is no longer `wait for external unblock`, and the checkout return path is no longer an open concern after the confirmed hosted YooKassa return.
- The shipping direction remains ApiShip-first unless the user explicitly changes market scope.
- Phase 6 storefront customization is no longer the current active implementation track, but it must be described truthfully as `initial closure claim → valid reopen → remediation → post-remediation re-closure`: the full sanctioned preset-driven stack is now closed only after the remediation cycle, the final cross-preset regression pass is recorded as **PASS**, and the readiness verdict is now `ready for the next roadmap stage`.
- The truthfully re-closed Phase 6 stack remains materialized on one shared storefront core through the unchanged central selector/config authority [`NEXT_PUBLIC_STOREFRONT_PRESET`](../../../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) and [`storefront-client-config.ts`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts), plus [`HomeSectionRenderer`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/home-section-renderer/index.tsx), typed shell boundary [`StorefrontShellConfig`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74), typed catalog shell boundary [`StorefrontCatalogShellConfig`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298), shell resolvers [`resolveNavShellSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:15), [`resolveSideMenuShellSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:18), [`resolveFooterShellSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/shell-surface-resolver.ts:21), catalog resolvers [`resolveStoreCatalogIntroSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:15), [`resolveStoreCatalogResultsSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:18), [`resolveCollectionCatalogResultsSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:21), [`resolveFeaturedRailCatalogShellSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-resolver.ts:24), shell consumers [`nav/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx:17), [`footer/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx:12), [`side-menu/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/layout/components/side-menu/index.tsx:50), browse consumers [`StoreCatalogIntroSurface`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:51), [`CatalogResultsShellSurface`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:104), [`FeaturedRailCatalogShellSurface`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/catalog-shell-surface.tsx:130), thin shell seam [`RootLayout`](../../../medusa-agency-boilerplate-storefront/src/app/layout.tsx:14), [`ProductSupportHighlights`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-support-highlights/index.tsx:16), preset-driven collection/content/post composition [`collection-landing-surface/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/collection-landing-surface/index.tsx) / [`content-page-surface/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/content-page-surface/index.tsx) / [`post-page-surface/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/post-page-surface/index.tsx), typed [`landingSurfaces`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317), typed adjacent [`productSurfaces.supportHighlights`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323), typed listing/card contract [`listingSurfaces.productCard`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324), and typed catalog shell contract [`catalogShell`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325).
- [`Preset-driven landing-surface contract v1`](../../../plans/preset-driven-landing-surface-contract-v1.md) is closed by commit `7e3266c1478ab81f4f6748d6ee6fa5612cf3eecd` `feat(storefront): add preset-driven landing surface contract`.
- [`adjacent-preset-rollout-product-support-highlights.md`](../../../plans/adjacent-preset-rollout-product-support-highlights.md) is now also closed by commit [`8c5451e854c31671e088110670879f69c895e4cf`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323) `feat(storefront): roll out typed productSurfaces supportHighlights preset contract`.
- [`preset-driven-listing-surface-contract-v1.md`](../../../plans/preset-driven-listing-surface-contract-v1.md) is now also closed by commit [`9b378f5af3d84a76545413a34c45d68b1bab8286`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324) `feat(storefront): roll out typed preset-driven listing surface contract`.
- [`preset-driven-global-shell-contract-v1.md`](../../../plans/preset-driven-global-shell-contract-v1.md) is now also closed by commit [`4ffc410180bf6d7084d8616713e62b1d51ed7779`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:74) `feat(storefront): roll out typed preset-driven global shell contract`.
- [`preset-driven-catalog-shell-contract-v1.md`](../../../plans/preset-driven-catalog-shell-contract-v1.md) is now also closed by commit [`c7d101ea506a6602e085be2aaaab5e1b20afac28`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325) `feat(storefront): roll out typed preset-driven catalog shell contract`.
- The landing-surface closure normalized `home`, `collectionLanding`, `contentPage`, and `postPage` under one typed landing registry in [`storefront-client-config.ts`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317), added the shared resolver boundary [`landing-surface-resolver.ts`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/landing-surface-resolver.ts), kept [`index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/collections/templates/index.tsx), [`content-page.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/content/templates/content-page.tsx), and [`post-page.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/content/templates/post-page.tsx) as thin sanctioned mount points, and preserved the one-switch guardrail [`NEXT_PUBLIC_STOREFRONT_PRESET`](../../../medusa-agency-boilerplate-storefront/src/lib/env.ts:21) without changing Store API or commerce-core contracts.
- The adjacent product-display closure extends that same sanctioned preset architecture from [`landingSurfaces`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:317) to [`productSurfaces.supportHighlights`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:323), adds the typed resolver boundary [`resolveProductSupportHighlightsSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-surface-resolver.ts:14), keeps shared [`ProductTemplate`](../../../medusa-agency-boilerplate-storefront/src/modules/products/templates/index.tsx:23) as a thin sanctioned mount point, and preserves adjacent product display surfaces as sanctioned extensions rather than template-level branches.
- The listing/card closure extends that same sanctioned preset architecture to [`listingSurfaces.productCard`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:324), adds typed resolver boundaries [`resolveDefaultProductCardSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:14) and [`resolveFeaturedProductCardSurface()`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/listing-surface-resolver.ts:17), keeps shared [`ProductPreview`](../../../medusa-agency-boilerplate-storefront/src/modules/products/components/product-preview/index.tsx:9) as the thin shared composition seam, and uses [`ProductCardSurface`](../../../medusa-agency-boilerplate-storefront/src/modules/storefront-customization/components/product-card-surface.tsx:55) as the sanctioned presentation consumer instead of template forks.
- The global-shell closure extends that same sanctioned preset architecture to typed shell surfaces [`shell.nav`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:75), [`shell.sideMenu`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:76), and [`shell.footer`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:77), keeps [`RootLayout`](../../../medusa-agency-boilerplate-storefront/src/app/layout.tsx:14) as the thin seam that exposes shell attributes, and keeps shared [`nav/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/layout/templates/nav/index.tsx:17), [`footer/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/layout/templates/footer/index.tsx:12), and [`side-menu/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/layout/components/side-menu/index.tsx:50) as sanctioned shell consumers without preset-name branching.
- The catalog-shell closure extends that same sanctioned preset architecture to typed browse framing surfaces [`catalogShell.store.intro`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:300), [`catalogShell.store.results`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:301), [`catalogShell.collection.results`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:304), and [`catalogShell.featuredRail`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:306), keeps shared [`store/templates/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/store/templates/index.tsx), [`collections/templates/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/collections/templates/index.tsx), and [`product-rail/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/home/components/featured-products/product-rail/index.tsx) as thin sanctioned browse seams, and preserves browse customization as presentation-only rather than query or template branching.
- Validation for the catalog-shell closure remains source-of-truth as [`npx tsc --noEmit`](../../../medusa-agency-boilerplate-storefront/package.json) PASS, [`npm run build`](../../../medusa-agency-boilerplate-storefront/package.json:12) PASS, [`git diff --check`](../../../.gitignore) PASS, and review verdict APPROVE.
- The original whole-Phase-6 closure claim was later reopened on valid evidence and must not be flattened away: the reopened gaps were category browse outside sanctioned [`catalogShell`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:325), related products outside sanctioned listing surface contract, and loading/skeleton state outside the card/listing contract.
- Those reopened gaps are now documented as remediated by commits `adb8df25ed64d9540e36588ee91dc5ff24951009` `fix(storefront): route category browse through catalogShell contour`, `275dc4d823b8203bd1d49364ba4d02211bf42799` `fix(storefront): move related products to sanctioned listing surface contract`, and `97a4837c483b054d25511f216ee487bf150306b4` `fix(storefront): align skeleton loading states with card surface contract`.
- Final truthful closure for the whole Phase 6 stack is source-of-truth as the post-remediation cross-preset regression/readiness checkpoint **PASS** for preset matrix `atelier|market`: category browse is routed through sanctioned `catalogShell`, related products are routed through the sanctioned listing surface contract, loading/skeleton state is aligned with the sanctioned card/listing contract, and cross-preset typecheck/build succeed without blockers.
- Accepted non-blocking baseline observations for that final truthful closure are limited to controlled Store API warnings during static params generation; storefront [`npm run lint`](../../../medusa-agency-boilerplate-storefront/package.json:14) now passes cleanly after the lint-stack and hook-dependency remediation, and those warnings are not part of the reopened gaps.
- Do not describe Phase 6 as `not started`, `only the next step`, `still active implementation`, or as equivalent to Phase 7 template automation.
- Do not describe Phase 6 as if it stops at landing surfaces, adjacent product detail copy, listing/card presentation, or global shell; source of truth includes the fully closed catalog-shell contract [`StorefrontCatalogShellConfig`](../../../medusa-agency-boilerplate-storefront/src/lib/storefront-client-config.ts:298) and the final readiness checkpoint for the whole preset-driven stack.
- Payload CMS is now part of the canonical roadmap as a separate `Phase 5.5` content-layer track after storefront core, not as current active implementation work.
- Root `.env.example` and the current root `.env` are aligned to backend `9000` and storefront `8000`; stale workstation-specific `9001` notes are no longer source-of-truth.

Re-verify any of these if the code has changed.

## Working Rules

- Do not mark an item as done unless its Definition of Done is actually satisfied.
- Do not copy old statuses from `master_repo_guide.md` into new planning.
- Do not describe Gate A, Phase 1, or Phase 2 as open if the topic is the verified clean local onboarding and template-ready baseline.
- Do not describe the first Phase 3 step as `still at decision stage` when referring to notifications; that slice is already implemented and confirmed.
- Do not describe notification hardening v1 as open, pending, or the next default step unless there is new evidence of regression.
- Do not describe payments as `not started` or as `only at decision stage`; the YooKassa-first path is already confirmed for the current scope.
- Do not describe the current payment state as a fully production-ready checkout beyond what was actually verified.
- Do not propose Stripe or another non-RF payment provider as the default v1 path for this repository unless the user explicitly changes the market scope.
- Do not describe shipping as `not started` or as `only at decision stage`; the first ApiShip-first rate-selection slice is already implemented.
- Do not claim that the current repo has a fully productized post-order lifecycle just because the checkout path is now validated through `review`, `order placement`, and the confirmed order page.
- Do not describe the closed ApiShip blocker for `cheapest_only_v1` as still pending or deferred.
- Do not describe the current shipping checkout as a full multi-quote UX; the source of truth is `cheapest_only_v1` until the scope is explicitly expanded.
- Do not silently flip local/dev ApiShip traffic to live; safe-by-default test-mode must remain the default unless live is explicitly enabled.
- Do not re-open the storefront checkout `500` as the current blocker when the verified issue was an absent or invalid cart rather than a confirmed shipping code regression.
- Do not state or copy any real `APISHIP_TOKEN`, `UNISENDER_API_KEY`, credential-bearing `UNISENDER_BASE_URL`, `sk_*` secret key, or other user secret into markdown documentation.
- Do not claim that the canonical authenticated smoke path can reuse an old secret token; the source of truth requires a fresh generated secret admin API key.
- Do not describe the YooKassa return route as a redirect to an arbitrary safe `http/https` URL; the source of truth is allowlist origin policy via `YOOKASSA_STOREFRONT_RETURN_ORIGINS`, with fallback only to configured allowlisted origin(s), `STORE_CORS`, or controlled local development fallback.
- Do not describe an empty `YOOKASSA_WEBHOOK_SECRET` as allowing unsigned webhooks by default; unsigned acceptance is only valid with explicit `YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS=true` in development/test.
- Do not start the shipping track from an arbitrary provider when the task is still this repository's Russian-market template; default to ApiShip-first investigation and validation.
- Do not start `payload-cms`, block-renderer, or publish and revalidate implementation while the repo is still on the active Phase 3 and template-hardening track unless the user explicitly re-scopes the project.
- Treat bootstrap hardening on dirty databases as a confirmed and closed result of runtime validation, not as an open concern.
- Do not describe bootstrap idempotency hardening v1 as open, pending, or the next default step; it was confirmed via runtime validation on `2026-04-17`.
- Treat the notification auth helper as opt-in local smoke support, not as an expanded baseline requirement.
- Treat the added notification, YooKassa, and ApiShip env variables as opt-in integration config, not as baseline startup requirements.
- When working near region, bootstrap, or storefront routing behavior, preserve the already verified clean onboarding path and the fixed middleware semantics.
- For unstable or integration-specific claims, verify against official Medusa docs or the actual package and provider source.
- Keep the distinction clear between:
  - confirmed repo state;
  - project decisions;
  - hypotheses still requiring validation.

## Documentation Roles

- `Docs/current_work.md`
  Canonical operational status: what we are doing now, where the active work surface is, and what an empty-context agent should do first.
- `Docs/master_repo_plan_v2.md`
  Main roadmap, phases, gates, target architecture, and documentation policy.
- `Docs/plan_analysis.md`
  Audit and factual gap analysis.
- `Docs/env_contract.md`
  Env and startup contract for root orchestration, backend runtime, storefront runtime, and the canonical notification smoke path.
- `Docs/template_readiness_regression.md`
  Canonical regression-pack for template readiness, including local commands, expected results, and failure signals for the already confirmed critical paths.
- `Docs/master_repo_guide.md`
  Older executive and business narrative; update only if we intentionally keep it aligned.
- `Docs/medusa_project_summary.md`
  Broader technical summary and background notes.
- `Docs/Medusa.md`
  High-level Medusa notes and collected observations.
- `.codex/skills/medusa-master-repo/SKILL.md`
  Fast onboarding context for Codex working in this repo.

## Mandatory Updates After Meaningful Changes

Update `Docs/current_work.md` when:

- the active phase changes;
- the current concrete workstream changes;
- the answer to `what are we doing right now` changes;
- the current work surface changes;
- a current blocker is added or removed.

Update `Docs/master_repo_plan_v2.md` when:

- a phase starts, is re-scoped, or is completed;
- a blocker is added or removed;
- a new architectural decision is made;
- an integration path is approved or rejected;
- documentation policy or rollout order changes.

Update `Docs/plan_analysis.md` when:

- a previous audit statement becomes false;
- a major blocker is resolved;
- the actual status of completed and partial work materially changes;
- a reassessment of current reality is needed.

Update this skill when:

- the source-of-truth document set changes;
- document roles change;
- the repo structure changes in a way that affects agent navigation;
- the Current Known Reality section becomes outdated;
- there is a new mandatory rule for how Codex should work in this repo;
- the canonical regression-pack or its helper commands change.

Update `Docs/master_repo_guide.md` only when:

- we intentionally want the business-facing summary to stay aligned with the canonical plan.

## Default Behavior

When the user asks `what is done / what is next / where to look`, answer from:

1. `Docs/current_work.md` for the live operational answer;
2. `Docs/master_repo_plan_v2.md` for direction;
3. `Docs/plan_analysis.md` for reality;
4. code and config for final verification.

Default orientation after the current status update:
- treat clean onboarding and the Phase 2 baseline replacement as confirmed baseline;
- treat the canonical root startup path as `bootstrap` → `preflight` → `dev`;
- keep the distinction clear between canonical root orchestration and ad-hoc local debug via direct `npx medusa develop` plus a separate storefront runtime;
- treat notification v1 as the confirmed first integration slice of Phase 3;
- treat notification hardening v1 as closed and verified;
- treat the canonical local authenticated notification smoke path as `fresh secret admin API key` → `Basic auth` → `POST /admin/notifications/smoke`, with [`npm run smoke:notification`](../../../package.json:23) as the minimal helper command;
- treat payment v1 as a confirmed YooKassa-first path for the current scope;
- treat shipping v1 as an implemented ApiShip-first opt-in and baseline-safe rate-selection slice with safe-by-default test-mode and honest `cheapest_only_v1` semantics;
- treat checkout end-to-end validation v1 as closed, including hosted YooKassa return, review step, order placement, and confirmed order page;
- treat the targeted fixes in [`payment-button/index.tsx`](../../../medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx) and [`cookies.ts`](../../../medusa-agency-boilerplate-storefront/src/lib/data/cookies.ts) as part of the source of truth for the confirmed checkout path;
- treat `providerConnectId` / `extraParams` support and true multi-quote checkout as deferred until the user explicitly expands scope;
- treat `bootstrap idempotency hardening v1` as confirmed via runtime validation and closed;
- treat [`Docs/template_readiness_regression.md`](../../../Docs/template_readiness_regression.md) as the canonical regression-pack/source-of-truth for local template-readiness checks and for the accepted non-blocking baseline observations of the final Phase 6 closure;
- treat the Phase 6 preset-driven storefront stack as truthfully closed only after the recorded reopen/remediation cycle: sanctioned preset selector, landing surfaces, adjacent product support highlights, listing surfaces, global shell, and catalog shell are all completed, the three reopened gaps are remediated, and the stack is regression-synced;
- treat the final cross-preset regression/readiness pass as PASS for `atelier|market` without blockers, while keeping the historical reopen/remediation context visible in source-of-truth docs;
- treat `VK Community Messaging v1 foundation` as implemented on top of the already confirmed ApiShip + YooKassa + checkout slices;
- treat `VK ID` as a later optional identity-linking layer, not as a prerequisite for the first VK transport rollout and not as part of the already delivered VK transport foundation;
- keep future communication sequencing on top of the implemented VK foundation rather than re-opening whether the VK transport itself should exist;
- treat Stripe and similar official Medusa providers as reference patterns only unless the user explicitly changes the project market;
- mention the storefront redirect-loop only as a closed regression unless the user is explicitly asking about middleware history;
- mention the storefront checkout `500` only as a separated false blocker tied to cart and data-state unless the user is explicitly asking about that incident;
- mention dirty-DB bootstrap behavior as a confirmed idempotent result unless the user is explicitly asking about regression or new edge cases;
- orient next-step sequencing after this status update to **Phase 7** template/client packaging, with **Phase 8** release-grade checks and readiness remaining after that.

When these disagree, code and verified repo state win.
