# Delivery Hub checkout cutover decision record template

> Status: operator decision evidence artifact template for a future Delivery Hub checkout cutover.
>
> Scope: document and review readiness evidence from the read-only preconditions verifier, cutover candidate planner, and approval artifact endpoint. This template is not a runtime approval switch, not persisted executable state, and not a shipping-method commit mechanism.

---

## 1. Artifact identity

| Field | Value |
|---|---|
| Artifact type | `delivery_hub_checkout_cutover_decision` |
| Artifact source | `GET /store/delivery/cutover-approval-template?cart_id=<cart_id>` |
| Cart id | `<cart_id or not provided>` |
| Generated at UTC | `<generated_at from endpoint>` |
| Decision status | `not_requested` by default |
| Decision record owner | `<operator identity placeholder>` |
| Reviewer | `<reviewer identity placeholder>` |
| Technical owner | `<technical owner identity placeholder>` |

Allowed decision-status vocabulary for the evidence artifact:

- `not_requested` — default template state; no operator go/no-go decision has been requested or recorded.
- `go_requested` — operator intends to request a future go decision, but this still does not enable checkout commit.
- `no_go` — operator/reviewer records an explicit no-go decision.
- `approved_but_commit_disabled` — review may approve readiness evidence, but commit remains disabled until a separate implementation and feature-flag-controlled runtime path exists.

---

## 2. Evidence snapshot to attach

Attach or paste only the sanitized response from:

1. `GET /store/delivery/cutover-preconditions`
2. `GET /store/delivery/cutover-candidate?cart_id=<cart_id>` when a cart candidate is being reviewed
3. `GET /store/delivery/cutover-approval-template?cart_id=<cart_id>`

Do not attach raw provider request/response bodies, raw Yandex DTOs, auth headers, tokens, ciphertext, publishable key values, raw provider offer ids, raw quote keys, backend execution tokens, or arbitrary provider metadata.

### Preconditions summary

| Field | Value |
|---|---|
| Posture | `evidence_preflight_only` |
| Status | `preflight_only` |
| Ready count | `<ready_count>` |
| Required count | `<required_count>` |
| Blocked count | `<blocked_count>` |
| Missing count | `<missing_count>` |
| Not-enabled count | `<not_enabled_count>` |
| Required codes | `<required_codes>` |
| Blocked codes | `<blocked_codes>` |
| Missing codes | `<missing_codes>` |

Expected guardrails:

- `checkout_source_of_truth=unchanged`
- `no_network_calls=true`
- `no_provider_payloads=true`
- `no_secret_material=true`
- `shipment_lifecycle_not_enabled=true`
- `can_commit_shipping_method=false`

### Candidate summary

| Field | Value |
|---|---|
| Candidate available | `<true/false>` |
| Candidate status | `<not_requested | missing_selection | missing_shipping_option | ready_for_review | blocked>` |
| Selection present | `<true/false>` |
| Selection reference id | `<opaque safe reference or null>` |
| Candidate shipping option id | `<safe option id or null>` |
| Candidate shipping option name | `<safe option label or null>` |
| Candidate amount/currency | `<amount/currency or null>` |
| Candidate pickup point id | `<safe opaque id or null>` |
| Required preconditions | `<required_preconditions>` |
| Blocked reasons | `<blocked_reasons>` |

Expected candidate guardrails:

- `checkout_source_of_truth=unchanged`
- `can_commit_shipping_method=false`
- no network calls
- no provider payloads
- no secret material
- shipment lifecycle not enabled

---

## 3. Required acknowledgements

The endpoint intentionally returns these acknowledgement placeholders as `false` so an operator cannot accidentally convert the artifact into approval execution:

| Acknowledgement | Required value in endpoint | Operator evidence note |
|---|---:|---|
| Rollback reviewed | `false` | `<operator note>` |
| ApiShip/Medusa fallback available | `false` | `<operator note>` |
| No secrets logged | `false` | `<operator note>` |
| Shipment lifecycle not enabled by this step | `false` | `<operator note>` |
| Approval does not enable commit | `false` | `<operator note>` |

Rollback statement to review:

> Operator must confirm rollback/fallback keeps existing ApiShip/Medusa checkout source-of-truth available before any future executable cutover implementation.

---

## 4. Required signoffs

The endpoint intentionally returns signoff placeholders as `pending`:

| Role | Endpoint placeholder | Human signoff note |
|---|---|---|
| Operator | `pending` | `<name/date/result>` |
| Reviewer | `pending` | `<name/date/result>` |
| Technical owner | `pending` | `<name/date/result>` |

---

## 5. Commit controls

These controls must remain unchanged in the artifact and in the storefront preview model:

| Control | Required value |
|---|---:|
| `can_commit_shipping_method` | `false` |
| `requires_separate_implementation` | `true` |
| `requires_feature_flag` | `true` |
| `approval_is_executable` | `false` |
| Storefront `canCommitShippingMethod` | `false` |

If any evidence shows a true commit flag or executable approval state, the decision record is invalid and must be treated as `no_go`.

---

## 6. Final operator decision section

| Field | Value |
|---|---|
| Requested decision status | `<not_requested | go_requested | no_go | approved_but_commit_disabled>` |
| Final decision for this checkpoint | `<NO-GO | evidence accepted, commit disabled | review returned>` |
| Reason summary | `<short sanitized summary>` |
| Rollback/fallback reviewed | `<yes/no, no secrets>` |
| No-secret scan reviewed | `<yes/no>` |
| Checkout source-of-truth remains unchanged | `yes` |
| Shipping-method commit remains disabled | `yes` |
| Review pending after implementation task | `yes` |

This decision record is complete only as evidence. It does not create executable approval state, does not call `setShippingMethod()`, does not switch checkout source-of-truth, does not remove ApiShip/Medusa fallback, and does not perform shipment create/cancel/status/retry.
