---
name: medusa-master-repo
description: Use when working in this medusa-agency-boilerplate repository on planning, implementation, architecture, integrations, storefront strategy, ApiShip/Gorgo delivery baseline, Delivery Hub historical context, or status tracking. This skill defines the local source-of-truth documents, current confirmed reality, and mandatory doc-update rules.
---

# Medusa Master Repo

Use this skill for substantial work in this repository.

## First Read

Read documents in this order:

1. `Docs/current_work.md`
   - Canonical operational status: what is current, what is next, and what must not be reopened.
2. `Docs/apiship_direct_migration_plan.md`
   - Accepted ApiShip/Gorgo direct baseline plan and canonical Store API decision.
3. `Docs/apiship_baseline_smoke_evidence.md`
   - Final deterministic evidence for the current ApiShip/Gorgo delivery baseline.
4. `Docs/delivery_hub_physical_cleanup_manifest.md`
   - Cleanup/quarantine manifest for previous Delivery Hub runtime residue.
5. `Docs/delivery_hub_documentation_index.md`
   - Delivery Hub historical/evidence documentation map.
6. `Docs/master_repo_plan_v2.md`
   - Main repository roadmap and long-term direction.
7. `Docs/plan_analysis.md`
   - Historical audit and factual gap analysis. Treat old sections as audit history when `current_work.md` is newer.
8. `Docs/env_contract.md`
   - Read when working on startup, ports, env files, orchestration, or delivery/payment/notification env behavior.
9. Relevant code, tests, package scripts, and config.
   - Verified repository state wins over narrative docs.
10. `Docs/master_repo_guide.md`, `Docs/medusa_project_summary.md`, and `Docs/Medusa.md`
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
- Current delivery baseline is ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship`; direct `/store/apiship/*` is the canonical Store API contract for normal checkout.
- Delivery Hub/direct Yandex is previous-baseline/historical/quarantined context, not the fresh-template baseline. Old local/staging databases may contain historical delivery rows/provider ids. Treat them as operator-approved cleanup work, not active template behavior.
- The preset-driven storefront customization stack is closed. Do not reopen it without new regression evidence.

## Delivery Baseline Reality

Current ApiShip/Gorgo baseline is governed by:

- `Docs/current_work.md`
- `Docs/apiship_direct_migration_plan.md`
- `Docs/apiship_baseline_smoke_evidence.md`
- `Docs/env_contract.md`

Current delivery status:

- Delivery Hub -> ApiShip/Gorgo migration is completed and confirmed for the committed baseline.
- ApiShip/Gorgo via `@gorgo/medusa-fulfillment-apiship` is the fresh-template delivery baseline.
- Direct `/store/apiship/*` endpoints are the canonical Store API contract for normal checkout; do not reintroduce `/store/delivery/*` as the first-version facade.
- `APISHIP_SHIPMENT_EXECUTION_ENABLED=false` is the safe default. Live external shipment execution requires the exact opt-in value `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` plus the existing readiness/idempotency guardrails.
- Final baseline evidence is `Docs/apiship_baseline_smoke_evidence.md`.

Delivery Hub previous-baseline status:

- Delivery Hub/direct Yandex is historical/quarantined context, not current fresh-template guidance.
- Runtime residue cleanup is recorded in `Docs/delivery_hub_physical_cleanup_manifest.md`.
- Historical doc roles are indexed in `Docs/delivery_hub_documentation_index.md`.
- Older Delivery Hub plans/specs/evidence may remain useful for audit history, but must not be copied as current operational instructions.

## Working Rules

- Code and verified runtime behavior win over docs.
- Do not mark work complete unless its Definition of Done and validation evidence are satisfied.
- Do not copy stale statuses from historical docs into current reports.
- Do not describe closed workstreams as open without new evidence.
- Do not expose or write real credentials, tokens, auth headers, ciphertext, raw provider request/response bodies, raw Yandex DTOs, raw quote keys, raw offer ids, publishable key values, or secret admin keys into docs, logs, tests, admin responses, or storefront responses.
- Do not silently flip local/dev provider traffic to live.
- Do not enable `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` by default; the only live-shipment opt-in is the exact value `true`.
- Do not reintroduce Delivery Hub/direct Yandex or `/store/delivery/*` as an active checkout path.
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
- `Docs/apiship_direct_migration_plan.md`
  - Accepted ApiShip/Gorgo baseline migration plan and direct Store API decision.
- `Docs/apiship_baseline_smoke_evidence.md`
  - Final deterministic baseline smoke/evidence for ApiShip/Gorgo.
- `Docs/delivery_hub_physical_cleanup_manifest.md`
  - Cleanup/quarantine manifest for removed Delivery Hub runtime residue.
- `Docs/delivery_hub_documentation_index.md`
  - Delivery Hub historical/evidence doc map.
- `Docs/delivery_hub_rework_plan.md`
  - Previous-baseline Delivery Hub accepted phase plan; historical unless explicitly referenced for audit.
- `Docs/delivery_hub_spec.md`
  - Detailed previous-baseline Delivery Hub architecture/reference. Treat as historical unless a current doc says otherwise.
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

- Delivery Hub historical/evidence document roles change;
- a Delivery Hub document is archived, removed, quarantined, or reclassified;
- historical/evidence-only classification changes.

Update `Docs/apiship_direct_migration_plan.md` / `Docs/apiship_baseline_smoke_evidence.md` when:

- ApiShip/Gorgo baseline decisions, Store API shape, evidence, or validation policy changes.

Update Delivery Hub historical docs only when previous-baseline evidence/classification changes; do not make them current runtime guidance.

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
2. Use `Docs/apiship_direct_migration_plan.md` and `Docs/apiship_baseline_smoke_evidence.md` for current delivery baseline direction/evidence.
3. Use `Docs/delivery_hub_physical_cleanup_manifest.md` and `Docs/delivery_hub_documentation_index.md` for Delivery Hub quarantine/history.
4. Use `Docs/master_repo_plan_v2.md` for broader roadmap direction.
5. Use `Docs/plan_analysis.md` only for audit/history.
6. Verify code/tests before making fresh technical claims.

Current default delivery answer after the migration is: ApiShip/Gorgo is the baseline, direct `/store/apiship/*` is canonical, Delivery Hub is previous-baseline/quarantined, and live ApiShip shipment execution stays default-off unless `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` is explicitly set.
