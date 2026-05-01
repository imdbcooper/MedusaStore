# Storefront

Next.js storefront for the Medusa agency boilerplate. Delivery uses the active Delivery Hub/direct Yandex flow exposed by the backend; live dispatch remains disabled unless a later scoped tranche enables it.

Run `npm run typecheck` and `npm run build` from this directory for validation.

## Delivery Hub checkout flow

Checkout presents one active shopper delivery flow: Delivery Hub quote/PVZ selection, saved delivery method, matched Medusa shipping option, then payment only after delivery is ready. The buyer-facing checkout should not describe preview, shadow, cutover, debug mechanics, or a legacy delivery fallback path.

The public storefront can save Delivery Hub selection metadata through `POST /store/delivery/selection` and clear it through `DELETE /store/delivery/selection`. The Medusa shipping-method handoff uses only the matched Delivery Hub shipping option id; it must not send raw provider payloads, tokens, auth headers, ciphertext, quote keys, offer ids, execution references, or secrets.

`NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED=false` is parsed with explicit-true semantics only. False/absent keeps the Medusa shipping-method handoff disabled; true can enable the guarded Delivery Hub `setShippingMethod()` handoff only when a saved selection, readiness, candidate planner, and available Delivery Hub Medusa shipping option all align. There is no active legacy delivery fallback handoff in checkout.

## Advanced diagnostics

Optional diagnostics remain available only behind `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true` in a collapsed `data-testid="delivery-hub-dev-diagnostics"` details block. This surface is for dev/admin validation, uses sanitized Store API responses, and is not required for the shopper product flow.

Optional sandbox defaults can be prefilled only with `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED=true` plus the documented `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_*` ids. Do not put secrets, tokens, auth headers, provider raw payloads, or production identifiers in these variables.

Manual/runtime diagnostic hooks are intentionally stable for advanced validation and screenshots, but product-flow smoke automation must rely on buyer-facing hooks such as `delivery-hub-customer-delivery-card`, `delivery-hub-pickup-point-selector`, `delivery-hub-pickup-point-option`, `delivery-hub-customer-save-selection-button`, `delivery-hub-customer-save-message`, and `delivery-hub-customer-selection-status`.

From the repository root, run `npm run smoke:delivery-hub-cutover:browser` for the explicit shipping-method handoff smoke and `npm run smoke:delivery-hub-rollback:browser` for the rollback/no-fallback drill. Both commands start local mocked Store API and temporary storefront dev servers; they must not require live Yandex/provider APIs, must not perform shipment execution, and must not depend on shopper-visible diagnostic labels.
