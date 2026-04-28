# Custom CLI Script

A custom CLI script is a function to execute through Medusa's CLI tool. This is useful when creating custom Medusa tooling to run as a CLI tool.

> Learn more about custom CLI scripts in [this documentation](https://docs.medusajs.com/learn/fundamentals/custom-cli-scripts).

## How to Create a Custom CLI Script?

To create a custom CLI script, create a TypeScript or JavaScript file under the `src/scripts` directory. The file must default export a function.

For example, create the file `src/scripts/my-script.ts` with the following content:

```ts title="src/scripts/my-script.ts"
import { 
  ExecArgs,
} from "@medusajs/framework/types"

export default async function myScript ({
  container
}: ExecArgs) {
  const productModuleService = container.resolve("product")

  const [, count] = await productModuleService.listAndCountProducts()

  console.log(`You have ${count} product(s)`)
}
```

The function receives as a parameter an object having a `container` property, which is an instance of the Medusa Container. Use it to resolve resources in your Medusa application.

---

## How to Run Custom CLI Script?

To run the custom CLI script, run the `exec` command:

```bash
npx medusa exec ./src/scripts/my-script.ts
```

For the Delivery Hub execution-ledger local offline validator scaffold, the intentionally local/manual-only entrypoint is `src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts` and is meant only for externally supplied JSON snapshot review, for example:

```bash
npx medusa exec ./src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts ./path/to/snapshot.json
npx medusa exec ./src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts ./path/to/snapshot.json custom_execution_ledger
```

This entrypoint stays strictly local/offline: it reads a supplied JSON file and delegates to the existing pure schema check-plan/verifier scaffold only. Stdout is a canonical versioned JSON evidence envelope suitable for attaching to manual review evidence, while exit semantics remain explicit and reviewable: `0` for syntactically valid `compatible`, `2` for syntactically valid `incompatible`, `3` for malformed input or contract failure. It does not connect to PostgreSQL, introspect a database, apply migrations, create tables, wire runtime services, or unblock activation.

For Delivery Hub storefront-neutral quote + selection smoke, use the safe store-facing harness at `src/scripts/delivery-hub-storefront-neutral-smoke.ts`:

```bash
npm run delivery:store-smoke -- --backend-url=http://localhost:9000 --connection-id=<saved_connection_id> --cart-id=<storefront_cart_id> --mode=dropoff_point_to_pickup_point --origin-point-id=<origin_dropoff_point_id> --destination-point-id=<destination_pvz_id>
```

Optional inputs: `--publishable-api-key=<pk_...>` when the local store route requires it, `--warehouse-id=<saved_warehouse_id>` for `warehouse_to_pickup_point`, `--currency-code=RUB`, and `--items-json='[{"quantity":1,"weight_grams":500,"price":2000}]'`. The harness calls only `POST /store/delivery/quotes` and `POST /store/delivery/selection`, selects the first neutral quote, persists selection in cart metadata only, and prints a safe summary with status, quote count, selected opaque `quote_reference`, price/currency, pickup point id, `checkout_source_of_truth`, and correlation ids. It intentionally does not print token values, auth headers, raw provider bodies, ciphertext, raw `quote_key`, raw provider offer ids, or credentials. It does not call checkout `setShippingMethod`, create/cancel/status/retry shipment endpoints, ApiShip, or legacy provider routes.

For Delivery Hub Yandex provider-contract validation preparation, a separate manual-only harness now exists at `src/scripts/delivery-hub-yandex-provider-contract-validation.ts`:

```bash
npx medusa exec ./src/scripts/delivery-hub-yandex-provider-contract-validation.ts --operation=create_shipment
```

This harness is safe-by-default and evidence-oriented:

- default mode is `plan` with `dry_run=true` (no live provider call);
- live mode requires explicit opt-in `DELIVERY_HUB_YANDEX_PROVIDER_CONTRACT_VALIDATION_LIVE_ENABLED=true`;
- live mode also requires explicit confirm argument `--live-confirm=I_UNDERSTAND_LIVE_PROVIDER_CALLS`;
- it fails closed when live prerequisites are missing (for example missing `DELIVERY_HUB_ENCRYPTION_KEY`, missing/invalid connection readiness);
- output is a structured redacted summary suitable for evidence capture and intentionally excludes raw credentials, auth headers, raw request/response payloads, quote keys, execution secrets, and raw provider shipment identifiers.

See runbook: `../Docs/delivery_hub_yandex_provider_contract_validation_runbook.md`.

---

## Custom CLI Script Arguments

Your script can accept arguments from the command line. Arguments are passed to the function's object parameter in the `args` property.

For example:

```ts
import { ExecArgs } from "@medusajs/framework/types"

export default async function myScript ({
  args
}: ExecArgs) {
  console.log(`The arguments you passed: ${args}`)
}
```

Then, pass the arguments in the `exec` command after the file path:

```bash
npx medusa exec ./src/scripts/my-script.ts arg1 arg2
```