# Delivery Hub Execution Ledger Evidence Bundle Packaging Convention

> Статус: canonical docs-only packaging and naming convention для manual/offline delivery-hub execution-ledger evidence bundle handoff.
>
> Posture: intake-deterministic, authority-preserving, metadata-only, runtime-unwired, activation-blocked.
>
> Этот документ определяет только один canonical packaging/naming convention для reviewer intake и offline/manual handoff. Он не меняет readiness authority, не меняет fixture-contract authority, не меняет validator semantics, не меняет activation authority, не создаёт второй semantic authority и не ослабляет hard blocker в [`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119).

---

## 1. Purpose and preserved authorities

Этот convention materializes ровно один canonical docs-only packaging and naming convention для evidence bundle и attached validator artifacts вокруг already approved contour:

`artifact_defined -> manual_application_external -> snapshot_verification_available -> activation_blocked`

Convention purpose only:

- stabilize evidence bundle identity for manual/offline handoff;
- make attachment naming deterministic for operator and reviewer;
- reduce ambiguity during reviewer intake;
- preserve existing authority boundaries and final posture `activation_blocked`.

Canonical authorities remain unchanged:

- readiness authority: [`buildDeliveryHubExecutionLedgerRepositoryAssemblyReadiness()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:229)
- exact contour wording authority: [`DeliveryHubExecutionLedgerRepositoryAssemblyPersistenceReadinessContour`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold.ts:161)
- manual workflow authority: [`delivery_hub_execution_ledger_manual_runbook.md`](./delivery_hub_execution_ledger_manual_runbook.md)
- evidence package authority: [`delivery_hub_execution_ledger_manual_evidence_template.md`](./delivery_hub_execution_ledger_manual_evidence_template.md)
- reviewer intake authority: [`delivery_hub_execution_ledger_evidence_submission_checklist.md`](./delivery_hub_execution_ledger_evidence_submission_checklist.md)
- fixture-contract authority: [`validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:184) and [`delivery_hub_execution_ledger_snapshot_fixture_contract.md`](./delivery_hub_execution_ledger_snapshot_fixture_contract.md)
- offline validator evidence authority when used: [`runDeliveryHubExecutionLedgerLocalOfflineValidator()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts:99) and [`validateDeliveryHubExecutionLedgerSnapshot()`](../medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts:11)
- hard blocker authority: [`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119)

This convention must not be read as:

- a second readiness source of truth;
- a second fixture-contract authority;
- a validator-spec authority;
- a runtime activation approval;
- a repository enablement signal.

Validator output remains evidence-only JSON and does not imply runtime activation, repository activation, runtime DB verification, runtime DDL, manual-step bypass or fulfillment enablement.

Fixture-contract authority remains only with [`delivery_hub_execution_ledger_snapshot_fixture_contract.md`](./delivery_hub_execution_ledger_snapshot_fixture_contract.md) and [`validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:184).

[`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119) remains hard-blocked.

---

## 2. Canonical evidence bundle identity

Each reviewer handoff package must use exactly one canonical package identity string.

### 2.1 Identity format

Canonical package ID format:

`delivery-hub-execution-ledger-evidence__<environment-label>__<utc-timestamp>__<revision-suffix>`

Required segments:

1. fixed family prefix `delivery-hub-execution-ledger-evidence`
2. sanitized environment label
3. UTC timestamp
4. revision suffix

Example shape only:

`delivery-hub-execution-ledger-evidence__prod-like__20260422T151428Z__r1`

This package ID is organizational metadata for bundle correlation and intake determinism only. It is not a second semantic authority and does not replace artifact identity, readiness state, validator semantics, fixture semantics or activation posture.

### 2.2 Sanitized environment label convention

Environment label must be sanitized, secret-free and stable within one submission.

Allowed style:

- lowercase letters
- digits
- single hyphen separators
- short organizational classification only

Recommended examples:

- `prod-like`
- `staging-like`
- `preprod`
- `shared-platform`
- `vendor-managed`

Not allowed in the label:

- hostnames
- DSNs
- credentials
- real region identifiers if they expose infrastructure details
- ticket text containing secrets
- whitespace
- slash separators
- ad hoc punctuation beyond hyphen

If environment nuance is needed beyond the sanitized label, place it in the evidence document narrative, not in bundle identity.

### 2.3 UTC timestamp convention

Timestamp segment must use UTC only in compact sortable form:

`YYYYMMDDTHHMMSSZ`

Example shape only:

`20260422T151428Z`

Rules:

- use UTC only, never local time or timezone abbreviations;
- use one timestamp string as the canonical bundle timestamp;
- keep it stable across the bundle folder name and attachment names for the same submission revision.

### 2.4 Revision suffix convention

Revision suffix is mandatory and records resubmission order.

Canonical form:

`r<number>`

Examples:

- `r1`
- `r2`
- `r3`

Rules:

- first submission for a package identity family uses `r1`;
- resubmission that corrects naming, completeness or attachment issues increments the suffix;
- do not encode reviewer outcome semantics into the suffix;
- do not replace the timestamp when the intent is a corrected resubmission of the same handoff package family unless the organization intentionally treats it as a brand-new package.

---

## 3. Canonical folder and filename convention

## 3.1 Bundle root folder

Canonical bundle root folder name must equal the canonical package ID exactly.

Example shape only:

`delivery-hub-execution-ledger-evidence__prod-like__20260422T151428Z__r1`

Folder name is organizational metadata only. It must not be treated as an authority stronger than the attached document contents and approved references.

## 3.2 Canonical attachment naming table

Every attachment in the package must begin with the same canonical package ID, followed by the canonical attachment role label.

Canonical filename pattern:

`<package-id>__<attachment-role>.<ext>`

| Attachment role | Required status | Canonical filename pattern | Notes |
| --- | --- | --- | --- |
| Evidence package document | Mandatory | `<package-id>__evidence-package.md` | Canonical narrative container, normally based on [`delivery_hub_execution_ledger_manual_evidence_template.md`](./delivery_hub_execution_ledger_manual_evidence_template.md) |
| Artifact review attachment | Mandatory | `<package-id>__artifact-review.<ext>` | May be markdown, pdf, or another reviewer-readable format |
| Manual external application confirmation | Mandatory | `<package-id>__manual-application-confirmation.<ext>` | Must evidence manual external application outside runtime |
| Snapshot artifact or redacted equivalent | Mandatory | `<package-id>__snapshot-artifact.<ext>` | Use redacted equivalent when raw snapshot cannot be shared |
| Validator JSON envelope | Conditional | `<package-id>__validator-envelope.json` | Attach only when offline validator evidence is used |
| Mismatch appendix | Conditional | `<package-id>__mismatch-appendix.<ext>` | Required when mismatches are declared |
| Verification review attachment | Mandatory | `<package-id>__verification-review.<ext>` | Human-readable verdict summary or review memo |

Attachment-role labels above are canonical and should not be replaced with ad hoc synonyms such as `results`, `misc`, `notes-final`, `review2`, `screenshot`, or `attachment-a`.

## 3.3 Extension flexibility

This convention fixes attachment role labels and package identity binding, but not one universal document format for every attachment.

Allowed principle:

- use a reviewer-readable extension appropriate to the artifact;
- keep the canonical role label unchanged;
- do not use extension changes to hide the artifact role.

Examples:

- `<package-id>__artifact-review.md`
- `<package-id>__artifact-review.pdf`
- `<package-id>__manual-application-confirmation.md`
- `<package-id>__snapshot-artifact.json`
- `<package-id>__snapshot-artifact.pdf`

---

## 4. Canonical bundle layout

Canonical bundle layout:

```text
<package-id>/
  <package-id>__evidence-package.md
  <package-id>__artifact-review.<ext>
  <package-id>__manual-application-confirmation.<ext>
  <package-id>__snapshot-artifact.<ext>
  <package-id>__verification-review.<ext>
  <package-id>__validator-envelope.json          optional
  <package-id>__mismatch-appendix.<ext>          optional
```

## 4.1 Mandatory attachments

The following attachments are always mandatory:

1. evidence package document
2. artifact review attachment
3. manual external application confirmation
4. snapshot artifact or redacted equivalent
5. verification review attachment

## 4.2 Conditional attachments

The following attachments are conditional:

1. validator JSON envelope when [`runDeliveryHubExecutionLedgerLocalOfflineValidator()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts:99) or [`validateDeliveryHubExecutionLedgerSnapshot()`](../medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts:11) was used as evidence input
2. mismatch appendix when mismatches are declared in the evidence package or verification review

## 4.3 Snapshot artifact and redacted equivalent rule

Exactly one of the following must be present as the mandatory snapshot attachment role:

- snapshot artifact
- redacted equivalent of the snapshot artifact

If a redacted equivalent is used, the evidence package document must explicitly state that the attachment is a redacted equivalent and why full raw content is not included.

---

## 5. Metadata-only rule and semantic authority guardrail

Filenames, folder labels and package IDs are organizational metadata only.

They are used to:

- correlate attachments in one bundle;
- make reviewer intake deterministic;
- reduce ambiguity during handoff.

They are **not** used to:

- define readiness state;
- define validator semantics;
- define fixture-contract semantics;
- define compatibility verdict semantics;
- define activation approval;
- define repository activation or runtime wiring.

If naming metadata and document contents conflict, reviewer must rely on the approved authority surfaces and the actual document content, not the filename alone.

---

## 6. Submission and reference binding rules

All artifacts in one bundle must reference the same canonical package ID.

Binding rules:

1. the bundle root folder name must equal the package ID;
2. the evidence package document must state the same package ID in its metadata section;
3. each attachment filename must begin with the same package ID;
4. verification review text, mismatch appendix and validator envelope references must use the same package ID when they mention bundle identity;
5. resubmissions must update the revision suffix consistently across folder name, evidence document metadata and every attachment filename.

No attachment may mix two different package IDs.

No package may contain attachment names with a missing prefix, alternate environment label, alternate timestamp, or alternate revision suffix.

---

## 7. Reviewer packaging checks

Reviewer intake should check packaging determinism before semantic review.

Mandatory reviewer packaging checks:

- package contains exactly one canonical package ID;
- root folder name matches the package ID used in the evidence package document;
- all attachment filenames start with the same package ID;
- canonical attachment role labels are used without ad hoc synonyms;
- mandatory attachments are present;
- conditional attachments are present when their triggering condition is declared;
- revision suffix is present and syntactically valid;
- timestamp is UTC-formatted as `YYYYMMDDTHHMMSSZ`;
- environment label is sanitized and secret-free;
- filenames do not imply stronger semantics than the approved authorities;
- final package still preserves exact contour `artifact_defined -> manual_application_external -> snapshot_verification_available -> activation_blocked` and final posture `activation_blocked`.

## 7.1 Return triggers for ambiguous or incomplete naming

Package must be returned for correction before semantic review when any of the following is true:

- package ID is missing from the evidence document metadata;
- root folder name does not match the package ID used inside the package;
- one or more attachments use a different environment label, timestamp, or revision suffix;
- one or more attachments omit the package ID prefix;
- canonical attachment role cannot be determined from the filename;
- ambiguous filenames such as `final`, `latest`, `review`, `misc`, `notes`, `attachment1`, `artifact-new` or similar are used instead of canonical role labels;
- validator evidence is claimed but the attachment is not named as the canonical validator envelope role;
- mismatches are declared but no canonical mismatch appendix is present;
- snapshot attachment is missing or named so ambiguously that reviewer cannot determine whether it is the snapshot artifact or redacted equivalent;
- evidence package naming implies runtime activation, repository activation, fixture authority replacement or validator authority replacement.

Return disposition remains documentation-level intake handling only and does not imply a failed activation review. Final posture remains `activation_blocked`.

---

## 8. Relationship to existing docs surfaces

This convention is meant to be used together with the existing docs stack:

- use [`delivery_hub_execution_ledger_manual_runbook.md`](./delivery_hub_execution_ledger_manual_runbook.md) for the manual sequence and stop-state expectations;
- use [`delivery_hub_execution_ledger_manual_evidence_template.md`](./delivery_hub_execution_ledger_manual_evidence_template.md) for the canonical narrative content of the evidence package document;
- use [`delivery_hub_execution_ledger_evidence_submission_checklist.md`](./delivery_hub_execution_ledger_evidence_submission_checklist.md) for completeness, return conditions and reviewer dispositions;
- use [`delivery_hub_execution_ledger_snapshot_fixture_contract.md`](./delivery_hub_execution_ledger_snapshot_fixture_contract.md) and [`validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:184) for fixture-contract authority;
- use [`runDeliveryHubExecutionLedgerLocalOfflineValidator()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold.ts:99) and [`validateDeliveryHubExecutionLedgerSnapshot()`](../medusa-agency-boilerplate/src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts:11) for offline validator evidence semantics only.

Nothing in this convention changes validator behavior, fixture authority, readiness authority, runtime state or activation posture.

---

## 9. Truthful end state

The only truthful end state after applying this convention is:

- exactly one canonical docs-only packaging and naming convention exists for evidence bundles;
- reviewer intake becomes more deterministic through stable package identity and attachment role labels;
- filenames and folder names remain organizational metadata only;
- validator output remains evidence-only JSON and does not imply runtime activation;
- fixture-contract authority remains with [`delivery_hub_execution_ledger_snapshot_fixture_contract.md`](./delivery_hub_execution_ledger_snapshot_fixture_contract.md) and [`validateDeliveryHubExecutionLedgerSuppliedSchemaSnapshotFixtureContract()`](../medusa-agency-boilerplate/src/modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold.ts:184);
- canonical contour remains exactly `artifact_defined -> manual_application_external -> snapshot_verification_available -> activation_blocked`;
- final posture remains `activation_blocked`;
- [`createFulfillment()`](../medusa-agency-boilerplate/src/modules/deliveryhub.ts:119) remains hard-blocked;
- no code or runtime capability has been added.
