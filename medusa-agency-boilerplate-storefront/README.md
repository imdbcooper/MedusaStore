# Storefront

Next.js storefront for the Medusa agency boilerplate. Delivery uses the ApiShip/Gorgo pickup-point baseline exposed through the backend and the plugin Store API. Live ApiShip shipment execution remains disabled unless a later scoped phase explicitly enables `APISHIP_SHIPMENT_EXECUTION_ENABLED=true`.

Run `npm run typecheck` and `npm run build` from this directory for validation.

## ApiShip/Gorgo checkout flow

Checkout presents one active shopper delivery flow: ApiShip pickup-point/PVZ selection, tariff selection, saved Medusa shipping method with `apishipData`, then payment only after the saved selection is ready.

The public storefront reads ApiShip provider, point, and calculation data from plugin-specific `/store/apiship/*` endpoints and commits the selected delivery through the standard Medusa cart shipping-method flow. The checkout path must not call `/store/delivery/*` as a Delivery Hub facade and must not send raw provider credentials, auth headers, ciphertext, execution references, labels, or documents.

## Historical Delivery Hub diagnostics

Delivery Hub/direct Yandex runtime endpoints are previous-baseline residue after the ApiShip/Gorgo baseline migration. They are quarantined from the active checkout/runtime surface and should not be used for normal storefront validation.

Historical Delivery Hub docs and scripts may remain in the repository only as previous-baseline evidence until a later physical cleanup phase removes obsolete residue. Do not use the old Delivery Hub browser smokes as proof of the current delivery baseline.
