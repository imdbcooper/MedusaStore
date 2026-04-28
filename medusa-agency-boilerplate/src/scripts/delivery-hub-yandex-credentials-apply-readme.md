# Safe local Yandex Delivery credential apply helper

This workspace helper exists because API-driven automation cannot safely read a hidden terminal prompt in this environment.

## Purpose

- Apply a Yandex Delivery token to an existing local Delivery Hub Yandex connection through the same backend service path used by Admin credential updates.
- Keep credential values write-only: no token, token length, token fingerprint, ciphertext, auth header, or raw provider body is printed.
- Optionally run bounded `testConnection` revalidation after the update.

## Safe operator command

Run from the Medusa backend directory:

```bash
cd /home/somdev/Projects/medusa-agency-boilerplate/medusa-agency-boilerplate
read -rsp 'Yandex Delivery token: ' DELIVERY_HUB_YANDEX_TOKEN; echo
export DELIVERY_HUB_YANDEX_TOKEN
npm exec -- medusa exec ./src/scripts/delivery-hub-yandex-credentials-apply.ts -- --revalidate=true --include-pickup-points=false
unset DELIVERY_HUB_YANDEX_TOKEN
```

The command output is designed to show only a safe summary:

- selected connection id;
- before/after readiness states;
- whether credentials were applied;
- whether revalidation passed;
- provider status/error category/operator hint if provider rejected the bounded test.

It must not show the token or ciphertext.
