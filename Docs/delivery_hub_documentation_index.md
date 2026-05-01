# Delivery Hub Documentation Index

> Status updated: `2026-05-01`.
>
> Purpose: define which Delivery Hub documents are current source of truth, which are reference material, and which are historical/evidence-only. This prevents old preview/cutover wording from being treated as active product guidance.

---

## Current Sources Of Truth

Use these documents for current Delivery Hub work:

1. [current_work.md](./current_work.md)
   - Current operational status and next action.
   - This is the first document for a new agent.

2. [delivery_hub_rework_plan.md](./delivery_hub_rework_plan.md)
   - Accepted phase plan for the Delivery Hub rework.
   - Phases 0/1 through 8 are implemented and reviewed; the Phase 8 diagnostic-fetch isolation follow-up is implemented.

3. [delivery_hub_spec.md](./delivery_hub_spec.md)
   - Detailed architecture/reference material.
   - Older preview, shadow, pre-cutover, and legacy-provider sections must be read as historical/dev-diagnostic context unless the rework plan/current status confirms they are active.

4. [delivery_hub_manual_testing_plan.md](./delivery_hub_manual_testing_plan.md)
   - Operator validation commands and manual testing contours.
   - Product-flow smokes should use shopper delivery hooks; diagnostic labels are dev/admin-only and must not be required for the active checkout path.

5. [env_contract.md](./env_contract.md)
   - Delivery Hub env and startup contract.
   - `DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED=false` remains the committed default/baseline.

---

## Historical Or Evidence-Only Docs

These documents are useful, but they are not the current product-flow source of truth:

- [delivery_hub_checkout_cutover_plan.md](./delivery_hub_checkout_cutover_plan.md)
  Historical/default-off cutover governance evidence. Do not use it to reintroduce shopper-visible cutover language.

- [delivery_hub_cutover_go_no_go_index.md](./delivery_hub_cutover_go_no_go_index.md)
  Historical approval/evidence index for cutover rehearsals.

- [delivery_hub_cutover_evidence_bundle.md](./delivery_hub_cutover_evidence_bundle.md)
  Historical evidence-bundle contract for controlled cutover decision inputs.

- [delivery_hub_cutover_decision_record_template.md](./delivery_hub_cutover_decision_record_template.md)
  Historical operator decision artifact template.

- [delivery_hub_staging_unblock_handoff_runbook.md](./delivery_hub_staging_unblock_handoff_runbook.md)
  Historical staging/unblock handoff context. Re-check against current code before using.

- [delivery_hub_yandex_provider_contract_validation_evidence_20260424.md](./delivery_hub_yandex_provider_contract_validation_evidence_20260424.md)
  Provider-contract validation evidence from a specific date.

- [delivery_hub_yandex_provider_contract_validation_runbook.md](./delivery_hub_yandex_provider_contract_validation_runbook.md)
  Manual/provider validation runbook. Use only when explicitly preparing provider validation.

- [delivery_hub_yandex_other_day_api_diagnostics_20260427.md](./delivery_hub_yandex_other_day_api_diagnostics_20260427.md)
  Date-specific Yandex diagnostic evidence.

- [yandex_delivery_test_api_summary.md](./yandex_delivery_test_api_summary.md)
  Research/reference summary for Yandex Delivery API behavior.

---

## Execution Ledger Evidence Docs

The execution-ledger docs remain relevant for gated shipment execution review and external evidence handling. They do not imply runtime activation by themselves.

Use this entry point first:

- [delivery_hub_execution_ledger_release_handoff_index.md](./delivery_hub_execution_ledger_release_handoff_index.md)

Supporting docs:

- [delivery_hub_execution_ledger_operator_reviewer_quickstart.md](./delivery_hub_execution_ledger_operator_reviewer_quickstart.md)
- [delivery_hub_execution_ledger_manual_runbook.md](./delivery_hub_execution_ledger_manual_runbook.md)
- [delivery_hub_execution_ledger_manual_evidence_template.md](./delivery_hub_execution_ledger_manual_evidence_template.md)
- [delivery_hub_execution_ledger_evidence_submission_checklist.md](./delivery_hub_execution_ledger_evidence_submission_checklist.md)
- [delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md](./delivery_hub_execution_ledger_evidence_bundle_packaging_convention.md)
- [delivery_hub_execution_ledger_snapshot_fixture_contract.md](./delivery_hub_execution_ledger_snapshot_fixture_contract.md)

Current posture remains: evidence and verification support only; no automatic database activation or production shipment execution.

---

## Removed Completed Prompt Artifacts

One-off agent prompt files for completed Delivery Hub phases were removed during documentation cleanup. They were useful while executing earlier phases, but they duplicated completed status and caused agents to treat historical instructions as current work.

Removed prompt artifacts:

- `Docs/delivery_hub_agent_prompt.md`
- `Docs/delivery_hub_rework_agent_prompt.md`
- `Docs/delivery_hub_rework_phase2_agent_prompt.md`
- `Docs/delivery_hub_rework_phase3_agent_prompt.md`
- `Docs/delivery_hub_rework_phase4_agent_prompt.md`
- `Docs/delivery_hub_rework_phase5_agent_prompt.md`

Future prompts should be short-lived conversation artifacts unless the operator explicitly asks to commit a reusable planning document.

---

## Phase 8 Status

Phase 8 is accepted after review:

- shopper-facing docs describe one Delivery Hub delivery flow, not preview/cutover mechanics;
- admin docs distinguish merchant setup, order shipment operations, and advanced diagnostics;
- historical approval/evidence docs stay clearly labeled as historical or evidence-only;
- fresh-template docs do not require legacy delivery env or runtime routes;
- remaining `preview`, `shadow`, `cutover`, and legacy terms in current docs must be interpreted as historical/evidence/admin/dev-only unless explicitly attached to the active shopper checkout flow.

Follow-up status: advanced diagnostic Store API fetches are now isolated from the ordinary checkout product-flow effect. They load only after diagnostics are explicitly requested, while shopper UI, docs, and product-flow smokes remain independent from diagnostic labels.
