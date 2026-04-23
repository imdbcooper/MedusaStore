import type { ExecArgs } from "@medusajs/framework/types"
import {
  runDeliveryHubExecutionLedgerLocalOfflineValidator,
  type DeliveryHubExecutionLedgerLocalOfflineValidatorInput,
} from "../modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold"

const DELIVERY_HUB_EXECUTION_LEDGER_VALIDATOR_EXIT_CODE_COMPATIBLE = 0
const DELIVERY_HUB_EXECUTION_LEDGER_VALIDATOR_EXIT_CODE_INCOMPATIBLE = 2
const DELIVERY_HUB_EXECUTION_LEDGER_VALIDATOR_EXIT_CODE_CONTRACT_FAILURE = 3

export default async function validateDeliveryHubExecutionLedgerSnapshot({
  args,
}: ExecArgs) {
  try {
    const input = parseValidatorArgs(args)
    const result = await runDeliveryHubExecutionLedgerLocalOfflineValidator(input)

    console.log(JSON.stringify(result, null, 2))
    process.exitCode =
      result.summary.final_verdict === "compatible"
        ? DELIVERY_HUB_EXECUTION_LEDGER_VALIDATOR_EXIT_CODE_COMPATIBLE
        : DELIVERY_HUB_EXECUTION_LEDGER_VALIDATOR_EXIT_CODE_INCOMPATIBLE
  } catch (error) {
    process.exitCode = DELIVERY_HUB_EXECUTION_LEDGER_VALIDATOR_EXIT_CODE_CONTRACT_FAILURE
    throw error
  }
}

function parseValidatorArgs(
  args: string[] | undefined
): DeliveryHubExecutionLedgerLocalOfflineValidatorInput {
  const providedArgs = args ?? []
  const snapshotFilePath = providedArgs[0]?.trim()

  if (!snapshotFilePath) {
    throw new Error(
      "Usage: npx medusa exec ./src/scripts/validate-delivery-hub-execution-ledger-snapshot.ts <snapshot-json-path> [table-name]"
    )
  }

  const tableName = providedArgs[1]?.trim()

  return {
    snapshot_file_path: snapshotFilePath,
    table_name: tableName || undefined,
  }
}
