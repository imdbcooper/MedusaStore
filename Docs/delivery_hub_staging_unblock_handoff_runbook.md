# Delivery Hub external staging dry-run unblock handoff

> Status: operator-facing handoff/runbook to unblock a real external staging dry-run after the repo-only blocker recorded in commit `91dda4f`.
>
> Current gate: **NO-GO for real staging and production checkout source-of-truth** until an operator supplies the safe staging inputs below and reviewed green staging evidence is attached.
>
> Scope: docs-only handoff. This runbook does not provide secrets, does not execute staging, does not enable production, does not create/cancel/status/retry shipments, and does not replace the canonical cutover/readiness documents.

Related references:

- Cutover readiness plan: [`delivery_hub_checkout_cutover_plan.md`](./delivery_hub_checkout_cutover_plan.md)
- Go/no-go review index: [`delivery_hub_cutover_go_no_go_index.md`](./delivery_hub_cutover_go_no_go_index.md)
- Evidence bundle convention: [`delivery_hub_cutover_evidence_bundle.md`](./delivery_hub_cutover_evidence_bundle.md)
- Current work ledger: [`current_work.md`](./current_work.md)
- Generic staging deploy path: [`staging_deploy_path.md`](./staging_deploy_path.md)
- Generic staging rollback runbook: [`staging_rollback_runbook.md`](./staging_rollback_runbook.md)

---

## 1. Purpose

The repository has local key-backed Store quote/selection evidence for both first-tranche Delivery Hub modes, but the real external staging dry-run remains blocked because this workspace does not contain a safe external staging target, deploy/restart configuration, credential handoff procedure, or rollback/redeploy procedure.

This handoff tells an operator exactly what to provide and how to run the staging dry-run without exposing secrets or treating local green evidence as staging/production approval.

---

## 2. Required safe inputs from the operator

Provide these inputs through the approved release channel, not by pasting secrets into chat, docs, commits, screenshots, or issue comments.

| Input | Required safe form | Notes |
| --- | --- | --- |
| Staging backend URL | Hostname/origin only, for example an HTTPS origin string without auth material | Used for backend/admin readiness checks and Store API smoke routing. |
| Staging storefront URL | Hostname/origin only | Used for browser checkout dry-run and rollback verification. |
| Deploy/restart command owner/procedure | Owner name/team plus a procedure reference or approved run instruction | The operator or platform owner must run it; this repo does not invent a platform command. |
| Safe credential handoff method | Reference to the secret manager / one-time secure channel / platform variable owner | Do not disclose token values. Confirm only that the value was applied and validated. |
| Rollback/redeploy method | Owner plus exact flag-off redeploy/restart procedure reference | Must be executable before flag-on staging dry-run starts. |
| Staging Delivery Hub connection readiness | Safe status summary only: connection exists, enabled, active/sealed, warehouse/source mapping present, destination PVZ and dropoff origin inputs available | Do not include credential values, encrypted values, provider raw payloads, raw quote keys, raw offer ids, or raw quote-reference ids. |
| Staging cutover flag plan | Confirm the target storefront deployment can set `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=true` for staging only and later return it to `false` | Do not commit a `true` default. Do not set production. |

If any required input is missing or ambiguous, stop and keep the verdict **NO-GO for real staging dry-run**.

---

## 3. Explicit secret and evidence boundaries

Never paste, print, screenshot, commit, or attach these values:

- Yandex token or any provider credential value;
- auth headers or bearer/basic credential material;
- ciphertext or encrypted credential blobs;
- token fingerprints, token length, key fingerprints, or secret-derived identifiers;
- publishable key value;
- raw provider request/response body;
- raw Yandex DTO/body;
- raw quote keys;
- raw provider offer ids;
- raw quote-reference ids;
- backend execution references/tokens;
- full environment files or unredacted platform variable dumps.

Allowed evidence is limited to safe summaries: HTTP status category, pass/fail status, quote counts, saved/not-saved selection status, checkout source-of-truth posture, safe correlation id if already designed as safe, sanitized screenshots after manual review, and operator notes that contain no secret-like fields.

Generated local evidence under `.delivery-hub-cutover-evidence/` is environment-specific and must remain uncommitted.

---

## 4. Operator checklist for real staging dry-run

### 4.1 Pre-flight: repository/local evidence

1. Confirm the intended repo commit is the reviewed candidate and that unrelated workspace artifacts are not included.
2. Run the local no-network staging evidence guard:

   ```bash
   npm run evidence:delivery-hub-staging-dry-run:check
   ```

3. Run the local mock cutover smoke before touching external staging:

   ```bash
   npm run smoke:delivery-hub-cutover:browser
   ```

4. Run the local mock rollback smoke before touching external staging:

   ```bash
   npm run smoke:delivery-hub-rollback:browser
   ```

Expected pre-flight result: local guard and mock smokes pass, but this still does **not** equal staging or production GO.

### 4.2 Backend/admin staging readiness

1. Confirm staging backend is reachable at the operator-provided backend URL.
2. Confirm Admin authentication works through the normal operator path without sharing credentials.
3. Open Admin `Settings -> Delivery` and confirm the Delivery Hub/Yandex connection safe status:
   - connection present;
   - enabled;
   - active/sealed or equivalent safe ready status;
   - default warehouse/source mapping present;
   - destination PVZ and dropoff origin inputs available for the two supported modes.
4. Run Admin `Test connection` from the staging Admin UI.
5. Run Admin `Test quote` for `warehouse_to_pickup_point`.
6. Run Admin `Test quote` for `dropoff_point_to_pickup_point`.
7. Record only sanitized outcomes: PASS/FAIL, quote count if returned, safe correlation id if available, and high-level error category if failed.

Do not copy provider response bodies, request bodies, Yandex DTOs, headers, tokens, ciphertext, raw offer ids, raw quote keys, or raw quote-reference ids.

### 4.3 Store API staging smoke

Run or perform a staging Store smoke for both first-tranche modes using the operator-provided staging backend/storefront routing and safe staging test cart inputs:

1. `warehouse_to_pickup_point`:
   - request neutral quote;
   - verify quote HTTP success and nonzero safe quote count;
   - save neutral selection;
   - verify selection save success;
   - verify checkout source-of-truth remains controlled and no raw provider data is exposed.
2. `dropoff_point_to_pickup_point`:
   - request neutral quote with an approved dropoff origin point;
   - verify quote HTTP success and nonzero safe quote count;
   - save neutral selection;
   - verify selection save success;
   - verify checkout source-of-truth remains controlled and no raw provider data is exposed.

Evidence to collect: mode name, PASS/FAIL, HTTP status category, quote count, selection saved yes/no, checkout source-of-truth posture, and safe correlation id only if it is already intentionally safe.

### 4.4 Browser checkout cutover smoke on staging

1. Confirm production remains untouched and committed templates still keep `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false`.
2. Through the approved staging deploy/restart procedure, set `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=true` only for the intended staging storefront deployment.
3. Redeploy/restart staging storefront using the operator-approved procedure.
4. Open the staging storefront and run one controlled operator-approved checkout path using Delivery Hub:
   - quote/select through the neutral Delivery Hub UI;
   - verify the guarded commit CTA appears only after a ready candidate maps to a Delivery Hub Medusa shipping option;
   - commit only the mapped Delivery Hub shipping option;
   - do not perform shipment lifecycle create/cancel/status/retry operations;
   - stop at the agreed dry-run boundary if order placement is not explicitly approved for staging.
5. Record only sanitized result: PASS/FAIL, selected mode, quote count, selection saved, guarded commit attempted yes/no, guarded commit succeeded yes/no, checkout source-of-truth posture, no-secret review completed yes/no.

### 4.5 Evidence bundle

After the staging run, generate the local sanitized evidence bundle with operator assertions. Example shape:

```bash
npm run evidence:delivery-hub-staging-dry-run -- \
  --cutover-smoke-status PASS \
  --rollback-smoke-status PASS \
  --staging-flag-state false \
  --manual-staging-note "sanitized staging dry-run outcome only" \
  --rollback-verification-note "sanitized flag-off rollback verification only"
```

Use `FAIL` or `NOT_RUN` truthfully where applicable. Keep generated files under `.delivery-hub-cutover-evidence/staging-dry-run/` uncommitted. Attach only after manual redaction review.

### 4.6 Rollback verification

1. Set `NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false` in the staging storefront deployment config.
2. Redeploy/restart staging storefront using the operator-approved rollback method.
3. Verify the staging storefront no longer exposes the cutover commit path.
4. Run the local rollback smoke again for regression confidence:

   ```bash
   npm run smoke:delivery-hub-rollback:browser
   ```

5. Verify no legacy delivery fallback is required or reintroduced and no Delivery Hub shipment lifecycle operation was triggered.
6. Record sanitized rollback evidence: flag-off redeploy completed, storefront verified, rollback smoke status, no-secret review completed.

---

## 5. GO/NO-GO gate

Default verdicts remain:

- Local green quote/selection evidence is **not** staging GO.
- Local mock browser cutover/rollback smokes are **not** staging GO.
- Staging green evidence is **not** production GO.
- Production checkout source-of-truth remains **NO-GO** unless a separate reviewed production rollout approval explicitly says otherwise.

Real staging dry-run may move from **NO-GO** to **reviewable staging evidence** only when all of the following are true:

1. Required safe inputs from section 2 are provided.
2. Secret boundaries from section 3 are respected.
3. Backend/admin readiness passes.
4. Admin `Test connection` passes.
5. Admin `Test quote` passes for both supported modes.
6. Store quote/selection smoke passes for both supported modes.
7. Staging browser checkout cutover smoke passes under explicit staging-only flag-on config.
8. Flag-off rollback/redeploy verification passes.
9. Sanitized evidence bundle is generated and reviewed.

Any failure, missing input, unreviewed evidence, leaked secret-like content, unavailable rollback method, or accidental production flag change is **NO-GO**.

---

## 6. Next action once inputs are available

When the operator has the safe staging backend URL, staging storefront URL, deploy/restart owner/procedure, safe credential handoff method, and rollback/redeploy method:

1. Open a new staging dry-run task referencing this runbook.
2. Reconfirm the current candidate commit and clean intentional workspace state.
3. Run the pre-flight local guard and mock smokes.
4. Have the operator apply staging credentials/flags through the approved secret/deploy system without revealing values.
5. Execute the checklist in section 4.
6. Generate and review the sanitized staging dry-run evidence bundle.
7. Record the staging verdict in the cutover review chain.

Until that happens, real external staging dry-run and production checkout source-of-truth remain **NO-GO**.
