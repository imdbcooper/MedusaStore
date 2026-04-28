# Storefront

Next.js storefront for the Medusa agency boilerplate. Delivery uses the active Delivery Hub/direct Yandex neutral surfaces exposed by the backend; live dispatch remains disabled unless a later scoped tranche enables it.

Run `npm run typecheck` and `npm run build` from this directory for validation.

## Delivery Hub preview/shadow UI

Checkout contains an operator/dev-only Delivery Hub preview/shadow block guarded by `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true`. It can call neutral store endpoints (`POST /store/delivery/quotes`, `POST /store/delivery/selection`, `DELETE /store/delivery/selection`) and displays `checkout source-of-truth unchanged`; it does not call `setShippingMethod()` and does not replace the existing checkout shipping selection.

Optional sandbox defaults can be prefilled only with `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED=true` plus the documented `NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_*` ids. Do not put secrets, tokens, auth headers or provider raw payloads in these variables.
