# Storefront

Next.js storefront for the Medusa agency boilerplate. Delivery uses the ApiShip/Gorgo pickup-point baseline exposed through the backend and the plugin Store API. Live ApiShip shipment execution remains disabled unless a later scoped phase explicitly enables `APISHIP_SHIPMENT_EXECUTION_ENABLED=true`.

Run `npm run typecheck` and `npm run build` from this directory for validation.

## ApiShip/Gorgo checkout flow

Checkout presents one active shopper delivery flow: ApiShip pickup-point/PVZ selection, tariff selection, saved Medusa shipping method with `apishipData`, then payment only after the saved selection is ready.

The public storefront reads ApiShip provider, point, and calculation data from plugin-specific `/store/apiship/*` endpoints and commits the selected delivery through the standard Medusa cart shipping-method flow. The checkout path must not send raw provider credentials, auth headers, ciphertext, execution references, labels, or documents.
