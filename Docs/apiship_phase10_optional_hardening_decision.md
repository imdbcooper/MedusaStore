# ApiShip/Gorgo Migration Phase 10 — Optional Hardening Decision

> Status: Phase 10 closed as decision/evidence only.
>
> Source plan: [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md).
>
> Decision date: 2026-05-05.

---

## Phase 10 scope

The current Phase 10 in [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md) is **Optional boilerplate-grade hardening**.

Phase 10 does not authorize another default runtime cutover. It asks the project to decide whether provider-neutral hardening should be added after the direct ApiShip/Gorgo cutover is stable.

This phase is therefore closed as a narrow decision/evidence artifact. No large architecture changes, package changes, live shipment enablement, checkout rewrites, provider-registration changes, bootstrap changes, or physical Delivery Hub file deletion are included.

---

## Decision

Keep the first baseline simple:

- ApiShip/Gorgo remains the fresh-template delivery baseline.
- Buyer checkout remains pickup-point/PVZ-first through plugin-specific `/store/apiship/*` endpoints.
- The selected delivery remains committed through the standard Medusa cart shipping-method flow with `data.apishipData`.
- Live ApiShip shipment execution remains default-off and requires a separate explicit opt-in phase before any production-like shipment execution parity work.
- Delivery Hub runtime residue remains quarantined/historical unless a later cleanup task explicitly scopes safe physical deletion.

No optional hardening item is promoted into the baseline by Phase 10.

---

## Optional hardening backlog

The following items remain allowed only as separately scoped post-cutover tasks:

| Candidate | Phase 10 decision | Guardrail |
| --- | --- | --- |
| Backend readiness wrapper | Already covered by the ApiShip checkout readiness guard for the current pickup-point baseline; do not add another provider-neutral wrapper now. | Revisit only if checkout needs a stable provider-neutral contract again. |
| Provider-neutral Store API facade | Not needed for the first baseline. | Do not reintroduce `/store/delivery/*` as a first-version ApiShip facade. |
| Richer pricing policy | Not needed for the first baseline. | Keep customer-facing shipping price equal to the ApiShip tariff until a pricing-policy requirement is approved. |
| Courier delivery mode | Not needed for the first baseline. | Keep courier out of baseline until UI/API/product requirements are explicitly added. |
| ApiShip admin/operator diagnostics | Useful later, but not part of Phase 10. | Add only in a separate diagnostics task; do not expose credentials, auth headers, labels, documents, or live execution by default. |

---

## Smoke/evidence posture

Phase 10 is documentation/evidence scope, so the verification target is baseline posture rather than a new runtime feature:

- The active checkout baseline remains ApiShip/Gorgo pickup-point through `/store/apiship/*`.
- The first baseline remains direct and simple, without a new provider-neutral `/store/delivery/*` facade.
- ApiShip shipment execution remains guarded by `APISHIP_SHIPMENT_EXECUTION_ENABLED=true` and is not enabled by default.
- Historical Delivery Hub material remains previous-baseline evidence and must not be used as proof of the current ApiShip checkout path.

Relevant non-destructive checks for this phase:

- Documentation/link check for this decision artifact and the Phase 10 source section.
- `git diff --check` / `git diff --cached --check` whitespace checks.
- Targeted typecheck/test commands may be run as smoke evidence if they do not require package changes or live external shipment execution.

Post-Phase 10 baseline smoke evidence is recorded in [apiship_baseline_smoke_evidence.md](./apiship_baseline_smoke_evidence.md). Its targeted unit smoke checks ApiShip provider registration, contour `apiship_gorgo`, provider id `apiship_apiship`, seed shipping option data id `apiship_doortopoint`, checkout readiness guard behavior, and default-off shipment execution guard without requiring credentials, running services, browser automation, or external ApiShip calls.

---

## Exit criteria mapping

| Plan exit criterion | Phase 10 result |
| --- | --- |
| Any hardening is scoped as a separate post-cutover task. | Satisfied: all hardening candidates remain backlog items requiring separate scoped tasks. |
| The first baseline remains simple: ApiShip/Gorgo pickup-point checkout through `/store/apiship/*`. | Satisfied: Phase 10 makes no runtime changes and explicitly keeps the direct ApiShip pickup-point baseline. |

---

## Remaining work after Phase 10

Only separately approved follow-up tasks remain:

- optional provider-neutral abstractions, if multi-provider needs appear;
- optional courier delivery, if product requirements are added;
- optional pricing-policy work, if tariff passthrough is no longer sufficient;
- optional ApiShip admin/operator diagnostics;
- optional physical cleanup of quarantined Delivery Hub residue with explicit safe scope and operator approval.
