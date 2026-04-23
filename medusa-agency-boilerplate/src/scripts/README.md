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