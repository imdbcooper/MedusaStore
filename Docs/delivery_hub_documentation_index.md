# Delivery Hub Documentation Index

> Status updated: `2026-05-05`.
>
> Purpose: identify Delivery Hub documents as previous-baseline historical/evidence material after the ApiShip/Gorgo baseline migration. This prevents old preview/cutover wording from being treated as active product guidance.

---

## Current Sources Of Truth

Do not start new Delivery Hub product-flow work from these documents. The current delivery baseline source of truth is [apiship_direct_migration_plan.md](./apiship_direct_migration_plan.md), with ApiShip/Gorgo as the active fresh-template delivery contour.

Delivery Hub runtime endpoints, checkout helpers, scripts, smokes, and docs are previous-baseline residue after the ApiShip/Gorgo migration. Use the documents below only when reviewing historical evidence or a later explicitly scoped cleanup task.

---

## Historical Or Evidence-Only Docs

These documents are previous-baseline references and are not the current product-flow source of truth:

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

The execution-ledger docs remain historical evidence for the previous Delivery Hub contour and external evidence handling. They do not imply runtime activation by themselves.

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

## ApiShip migration Phase 9 status

Delivery Hub is no longer the active fresh-template delivery baseline:

- ApiShip/Gorgo is the current delivery baseline for fresh templates.
- Delivery Hub runtime endpoints are quarantined from normal Store/Admin execution instead of physically deleted in this phase.
- Historical docs remain available as previous-baseline evidence only.
- Delivery Hub scripts, smokes, and runtime code must not be treated as required baseline proof for the ApiShip checkout path.
- Physical deletion and any local/staging data cleanup remain separate later cleanup work and require explicit scope/operator approval.
