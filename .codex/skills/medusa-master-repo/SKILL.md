---
name: medusa-master-repo
description: Use when working in this medusa-agency-boilerplate repository on planning, implementation, architecture, integrations, storefront strategy, Delivery Hub, or status tracking. This skill defines the local source-of-truth documents, current confirmed reality, and mandatory doc-update rules.
---

# Medusa Master Repo

Use this skill for substantial work in this repository.

## First Read

Read documents in this order:

1. `Docs/current_work.md`
   - Canonical operational status: what is current, what is next, and what must not be reopened.
2. `Docs/delivery_hub_documentation_index.md`
   - Required when working on Delivery Hub. Defines current, historical, and evidence-only Delivery Hub docs.
3. `Docs/delivery_hub_rework_plan.md`
   - Accepted Delivery Hub phase plan.
4. `Docs/master_repo_plan_v2.md`
   - Main repository roadmap and long-term direction.
5. `Docs/plan_analysis.md`
   - Historical audit and factual gap analysis. Treat old sections as audit history when `current_work.md` is newer.
6. `Docs/env_contract.md`
   - Read when working on startup, ports, env files, orchestration, or delivery/payment/notification env behavior.
7. Relevant code, tests, package scripts, and config.
   - Verified repository state wins over narrative docs.
8. `Docs/master_repo_guide.md`, `Docs/medusa_project_summary.md`, and `Docs/Medusa.md`
   - Background only. Do not use their status tables as canonical.

## Current Known Reality

Before making claims, keep these verified facts in mind:

- The repository is a Russian-market Medusa template.
- Canonical local startup remains:
  - `cp .env.example .env`
  - `npm run bootstrap`
  - `npm run preflight`
  - `npm run dev`
- Baseline region/currency are `ru` / `rub`.
- Root `package.json` and `scripts/` are the canonical entrypoint for bootstrap, preflight, dev, build, smoke, and permission repair.
- `scripts/preflight.sh` only allows runtime reuse where it explicitly supports compose-owned services.
- Dirty local ports `9000` or `8000` from unrelated processes are expected local failure modes outside the canonical clean-start path.
- Backend generated directories may inherit bad ownership from old container runs; `npm run permissions:fix` repairs them.
- Notification baseline is local-provider safe. UniSender and VK messaging are opt-in integration paths.
- The authenticated notification smoke path uses a fresh secret admin API key and Basic auth. Do not claim old secret reuse is canonical.
- Payment baseline is YooKassa-first for this repository's default market.
- The hosted YooKassa checkout return path was validated through review, order placement, and confirmed order page.
- Historical legacy delivery/provider-aware work existed and may matter for history, but it is not the fresh-template default delivery contour.
- Delivery Hub/direct Yandex is the selected delivery contour for fresh templates.
- Old local/staging databases may contain historical delivery rows/provider ids. Treat them as operator-approved cleanup work, not active template behavior.
- The preset-driven storefront customization stack is closed. Do not reopen it without new regression evidence.

## Delivery Hub Reality

Delivery Hub is governed by:

- `Docs/current_work.md`
- `Docs/delivery_hub_documentation_index.md`
- `Docs/delivery_hub_rework_plan.md`
- `Docs/delivery_hub_spec.md`

Current Delivery Hub status:

- Phases 0/1 through 8 are implemented and reviewed.
- Phase 8 has one non-blocking follow-up: isolate advanced diagnostic Store API fetches more fully from the ordinary checkout network flow.
- Latest relevant commits:
  - `fbf7a6d feat(delivery-hub): harden gated shipment execution`
  - `aedaa6f test(delivery-hub): restore browser smoke coverage`
- Browser-smoke gap is closed:
  - `npm run smoke:delivery-hub-cutover:browser` PASS
  - `npm run smoke:delivery-hub-rollback:browser` PASS
  - `npm run typecheck` PASS
  - `git diff --check` PASS
- Phase 8 focused storefront utility/source test: `node --test src/lib/util/delivery-hub.spec.ts` PASS (`146/146`).
- Shopper default mode is `warehouse_to_pickup_point`.
- `dropoff_point_to_pickup_point` remains admin/diagnostic or advanced until explicitly validated for the intended live contour.
- Customer-facing delivery price is separate from provider operational quote.
- Checkout origin/warehouse resolution belongs to backend/admin settings, not public storefront env.
- `Settings -> Delivery` is merchant setup plus advanced diagnostics, not the normal order shipment console.
- Order shipment operations belong to the order admin surface.
- Direct Yandex shipment execution remains gated and default-off through `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=false`.

Do not treat old prompt files or old preview/cutover prose as current Delivery Hub instructions. Completed prompt artifacts were removed during the 2026-05-01 documentation cleanup.

## Working Rules

- Code and verified runtime behavior win over docs.
- Do not mark work complete unless its Definition of Done and validation evidence are satisfied.
- Do not copy stale statuses from historical docs into current reports.
- Do not describe closed workstreams as open without new evidence.
- Do not expose or write real credentials, tokens, auth headers, ciphertext, raw provider request/response bodies, raw Yandex DTOs, raw quote keys, raw offer ids, publishable key values, or secret admin keys into docs, logs, tests, admin responses, or storefront responses.
- Do not silently flip local/dev provider traffic to live.
- Do not enable `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=true` by default.
- Do not reintroduce a legacy delivery fallback as an active checkout path.
- Do not patch or fork official Medusa Admin unless explicitly scoped.
- For unstable integration claims, verify against code, tests, official docs, or current runtime evidence.
- Keep the distinction clear between:
  - confirmed repository state;
  - project decisions;
  - historical evidence;
  - hypotheses still requiring validation.

## Documentation Roles

- `Docs/current_work.md`
  - Short operational source of truth.
- `Docs/delivery_hub_documentation_index.md`
  - Delivery Hub doc map: current, historical, evidence-only, and removed prompt artifacts.
- `Docs/delivery_hub_rework_plan.md`
  - Delivery Hub accepted phase plan.
- `Docs/delivery_hub_spec.md`
  - Detailed Delivery Hub architecture/reference. Older preview/cutover sections may be historical.
- `Docs/master_repo_plan_v2.md`
  - Main repository roadmap.
- `Docs/plan_analysis.md`
  - Audit and historical reality check.
- `Docs/env_contract.md`
  - Env/startup/runtime contract.
- `Docs/template_readiness_regression.md`
  - Canonical regression-pack for template readiness.
- `.codex/skills/medusa-master-repo/SKILL.md`
  - Fast onboarding context for Codex agents.

## Mandatory Updates After Meaningful Changes

Update `Docs/current_work.md` when:

- the active phase changes;
- the current concrete workstream changes;
- a blocker is added or removed;
- validation status materially changes;
- the answer to "what should the next agent do first?" changes.

Update `Docs/delivery_hub_documentation_index.md` when:

- Delivery Hub document roles change;
- a Delivery Hub document is archived, removed, or becomes current;
- historical/evidence-only classification changes.

Update `Docs/delivery_hub_rework_plan.md` when:

- a Delivery Hub phase starts, is re-scoped, or is completed;
- the phase order, Definition of Done, or validation policy changes.

Update `Docs/master_repo_plan_v2.md` when:

- the repository roadmap changes;
- a major phase starts, is re-scoped, or is completed;
- a new architectural decision is made.

Update `Docs/plan_analysis.md` when:

- a previous audit statement becomes false;
- a major blocker is resolved;
- a reassessment of current reality is needed.

Update `Docs/env_contract.md` when:

- env variables, startup behavior, ports, secrets policy, or orchestration behavior changes.

Update this skill when:

- the source-of-truth document set changes;
- document roles change;
- repo structure changes in a way that affects navigation;
- current known reality becomes outdated;
- canonical regression commands or smoke paths change;
- a new mandatory rule for Codex agents is introduced.

## Default Answering Behavior

When the user asks what is done, what is next, where to look, or asks for a prompt:

1. Answer from `Docs/current_work.md`.
2. Use `Docs/delivery_hub_documentation_index.md` for Delivery Hub doc roles.
3. Use `Docs/delivery_hub_rework_plan.md` or `Docs/master_repo_plan_v2.md` for direction.
4. Use `Docs/plan_analysis.md` only for audit/history.
5. Verify code/tests before making fresh technical claims.

Current default next step after Phase 8 is the non-blocking Delivery Hub follow-up: isolate advanced diagnostic Store API fetches more fully from the ordinary checkout network flow while preserving the accepted one-flow shopper checkout.
