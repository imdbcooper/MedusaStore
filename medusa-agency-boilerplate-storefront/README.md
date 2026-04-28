# Storefront

Next.js storefront for the Medusa agency boilerplate. Delivery uses the active Delivery Hub/direct Yandex neutral surfaces exposed by the backend; live dispatch remains disabled unless a later scoped tranche enables it.

Run `npm run typecheck` and `npm run build` from this directory for validation.

## Delivery Hub preview/shadow UI

Checkout contains an operator/dev-only Delivery Hub preview/shadow block guarded by `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true`. It can call neutral store endpoints (`POST /store/delivery/quotes`, `POST /store/delivery/selection`, `DELETE /store/delivery/selection`) and displays `checkout source-of-truth unchanged`; it does not call `setShippingMethod()` and does not replace the existing checkout shipping selection.

Optional sandbox defaults can be prefilled only with `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED=true` plus the documented `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_*` ids. Do not put secrets, tokens, auth headers or provider raw payloads in these variables.

Manual/runtime validation hooks are intentionally stable for smoke automation and screenshots: the block root is `data-testid="delivery-hub-preview-shadow-block"`, guardrails are under `delivery-hub-preview-guardrails`, actions use `delivery-hub-preview-get-quotes-button`, `delivery-hub-preview-save-selection-button`, `delivery-hub-preview-clear-selection-button`, and results use `delivery-hub-preview-operation-status`, `delivery-hub-preview-quote-count`, `delivery-hub-preview-selection-status`, plus source-of-truth/correlation status hooks. See `Docs/delivery_hub_manual_testing_plan.md` for the exact checklist.

From the repository root, run `npm run smoke:delivery-hub-preview:browser` for the mock-friendly browser smoke. The command starts a local mocked Store API plus temporary storefront dev servers, verifies disabled/enabled feature-flag behavior, mocked quote/save/clear UI status, no visible raw provider/auth/secret material, and that the existing ApiShip/Medusa checkout contour remains adjacent. It must not require live Yandex and must not perform checkout cutover.
