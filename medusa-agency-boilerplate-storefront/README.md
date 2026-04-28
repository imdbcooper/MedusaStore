# Storefront

Next.js storefront for the Medusa agency boilerplate. Delivery uses the active Delivery Hub/direct Yandex neutral surfaces exposed by the backend; live dispatch remains disabled unless a later scoped tranche enables it.

Run `npm run typecheck` and `npm run build` from this directory for validation.

## Delivery Hub preview/shadow UI

Checkout contains an operator/dev-only Delivery Hub preview/shadow block guarded by `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true`. It can call neutral store endpoints (`POST /store/delivery/quotes`, `POST /store/delivery/selection`, `DELETE /store/delivery/selection`) and displays `checkout source-of-truth unchanged` for metadata preview. The active checkout delivery posture is Delivery Hub only: `setShippingMethod()` is allowed only for a ready Delivery Hub candidate under the explicit cutover flag, and blocked readiness fails closed instead of selecting an ApiShip or legacy fallback.

Optional sandbox defaults can be prefilled only with `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED=true` plus the documented `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_*` ids. Do not put secrets, tokens, auth headers or provider raw payloads in these variables.

`NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false` is parsed with explicit-true semantics only. False/absent shows default-off/fail-closed status and does not attempt a shipping-method commit; true can enable the guarded Delivery Hub `setShippingMethod()` handoff only when a saved neutral selection, readiness, candidate planner and available Delivery Hub Medusa shipping option all align. There is no ApiShip/legacy fallback handoff in the active checkout path.

The preview block also reads `GET /store/delivery/cutover-preconditions` when available and renders `data-testid="delivery-hub-cutover-preconditions-status"`. This verifier is evidence/preflight only: it aggregates safe labels/statuses, fails safe when unavailable, never enables shipping-method commit, and must not expose provider raw payloads, auth headers, ciphertext, token values or publishable key values.

Manual/runtime validation hooks are intentionally stable for smoke automation and screenshots: the block root is `data-testid="delivery-hub-preview-shadow-block"`, guardrails are under `delivery-hub-preview-guardrails`, cutover gate/verifier hooks are `delivery-hub-cutover-gate-status` and `delivery-hub-cutover-preconditions-status`, actions use `delivery-hub-preview-get-quotes-button`, `delivery-hub-preview-save-selection-button`, `delivery-hub-preview-clear-selection-button`, and results use `delivery-hub-preview-operation-status`, `delivery-hub-preview-quote-count`, `delivery-hub-preview-selection-status`, plus source-of-truth/correlation status hooks. See `Docs/delivery_hub_manual_testing_plan.md` for the exact checklist.

From the repository root, run `npm run smoke:delivery-hub-preview:browser` for the mock-friendly browser smoke. The command starts a local mocked Store API plus temporary storefront dev servers, verifies disabled/enabled preview behavior, default-off and explicit-true cutover gate visibility, mocked cutover-preconditions verifier visibility with `canCommitShippingMethod=false`, mocked quote/save/clear UI status, no visible raw provider/auth/secret material, and that no legacy fallback checkout contour is required or visible. It must not require live Yandex and must not perform shipment execution.

Run `npm run smoke:delivery-hub-rollback:browser` for the rollback/no-fallback drill. It is also mock/no-network and restarts the temporary storefront across all-flags-off, preview-enabled/cutover-false, preview-enabled/cutover-true, and flags-off rollback scenarios. Passing means Delivery Hub preview/cutover artifacts disappear when flags are off, no ApiShip/legacy fallback shipping is required or visible, no Delivery Hub-specific shipping-method commit request is observed in flag-off runs, and blocked readiness remains fail-closed.
