import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterAll, afterEach, describe, expect, it, jest } from "@jest/globals"
import validateDeliveryHubExecutionLedgerSnapshot from "../../scripts/validate-delivery-hub-execution-ledger-snapshot"
import {
  buildDeliveryHubExecutionLedgerLocalOfflineValidatorInvocationIdentity,
  parseDeliveryHubExecutionLedgerSuppliedSnapshotJson,
  runDeliveryHubExecutionLedgerLocalOfflineValidator,
} from "../../modules/delivery-hub/storage/execution-ledger-local-offline-validator-scaffold"
import {
  normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot,
  type DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot,
} from "../../modules/delivery-hub/storage/execution-ledger-schema-check-plan-scaffold"
import { verifyDeliveryHubExecutionLedgerSchemaSnapshot } from "../../modules/delivery-hub/storage/execution-ledger-schema-verification-scaffold"

const tempDirectories: string[] = []

afterAll(async () => {
  await Promise.all(
    tempDirectories.map(async (directory) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(directory, { recursive: true, force: true })
      )
    })
  )
})

afterEach(() => {
  jest.restoreAllMocks()
  delete process.exitCode
})

describe("Delivery Hub execution ledger local offline validator scaffold", () => {
  it("returns stable versioned evidence envelope and delegates authority to existing pure layers", async () => {
    const snapshot = buildExternalSnapshot()
    const snapshotPath = await writeSnapshotFile("compatible.json", snapshot)

    const result = await runDeliveryHubExecutionLedgerLocalOfflineValidator({
      snapshot_file_path: snapshotPath,
    })
    const parsed = parseDeliveryHubExecutionLedgerSuppliedSnapshotJson({
      file_path: snapshotPath,
      file_contents: await readFile(snapshotPath, "utf8"),
    })
    const verifierResult = verifyDeliveryHubExecutionLedgerSchemaSnapshot({
      snapshot: normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(parsed),
    })

    expect(result).toEqual({
      envelope_version: 2,
      artifact: {
        identity: "delivery_hub.execution_ledger.local_offline_validator",
        mode: "local_offline_supplied_snapshot_validator",
        posture: "local_offline_evidence_only",
      },
      invocation: {
        identity: buildDeliveryHubExecutionLedgerLocalOfflineValidatorInvocationIdentity({
          resolved_snapshot_file_path: snapshotPath,
          supplied_table_name_override: null,
        }),
        source: "manual_cli_snapshot_review",
        syntactically_valid_run: true,
        table_name_override_applied: false,
      },
      input: {
        snapshot_file_path: snapshotPath,
        resolved_snapshot_file_path: snapshotPath,
        snapshot_identity: snapshotPath,
        supplied_table_name_override: null,
      },
      resolved: {
        table_name: verifierResult.table_name,
      },
      summary: {
        final_verdict: verifierResult.verdict,
        mismatch_count: verifierResult.mismatches.length,
        posture: "activation_blocked",
        verification_scope: "local_offline_supplied_snapshot_only",
      },
      verification: {
        check_plan: {
          mode: "pure_snapshot_check_plan",
          source: "externally_supplied_schema_snapshot",
          verifier_mode: "pure_snapshot_verification",
        },
        result: {
          verdict: verifierResult.verdict,
          resolved_table_name: verifierResult.table_name,
          mismatch_count: verifierResult.mismatches.length,
          mismatches: verifierResult.mismatches,
        },
      },
      disabled_confirmations: {
        local_offline_only: true,
        runtime_feature: false,
        runtime_capability_enabled: false,
        activation_enabled: false,
        db_connection: false,
        db_introspection: false,
        repository_required: false,
        db_adapter_required: false,
        sql_execution: false,
        migration_application: false,
        runtime_table_creation: false,
        runtime_wiring: false,
        transaction_runner: false,
        admin_exposure: false,
        app_runtime_execution_path: false,
        provider_dispatch: false,
        shipment_creation: false,
        order_or_fulfillment_mutation: false,
      },
    })
  })

  it("returns deterministic incompatible summary and preserves mismatch inventory without lossy transformation", async () => {
    const snapshot = buildExternalSnapshot()
    snapshot.tables = snapshot.tables.filter((table) => table.role !== "main")
    const snapshotPath = await writeSnapshotFile("incompatible.json", snapshot)

    const result = await runDeliveryHubExecutionLedgerLocalOfflineValidator({
      snapshot_file_path: snapshotPath,
    })
    const parsed = parseDeliveryHubExecutionLedgerSuppliedSnapshotJson({
      file_path: snapshotPath,
      file_contents: await readFile(snapshotPath, "utf8"),
    })
    const verifierResult = verifyDeliveryHubExecutionLedgerSchemaSnapshot({
      snapshot: normalizeDeliveryHubExecutionLedgerSuppliedSchemaSnapshot(parsed),
    })

    expect(result.summary).toEqual({
      final_verdict: "incompatible",
      mismatch_count: verifierResult.mismatches.length,
      posture: "activation_blocked",
      verification_scope: "local_offline_supplied_snapshot_only",
    })
    expect(result.verification.result).toEqual({
      verdict: verifierResult.verdict,
      resolved_table_name: verifierResult.table_name,
      mismatch_count: verifierResult.mismatches.length,
      mismatches: verifierResult.mismatches,
    })
    expect(result.verification.result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_table",
          table: "deliveryhub_execution_ledger",
          role: "main",
        }),
      ])
    )
  })

  it("keeps disabled confirmations explicit for runtime and live capabilities", async () => {
    const snapshotPath = await writeSnapshotFile("dependency-boundary.json", buildExternalSnapshot())

    const result = await runDeliveryHubExecutionLedgerLocalOfflineValidator({
      snapshot_file_path: snapshotPath,
    })

    expect(result.disabled_confirmations).toEqual({
      local_offline_only: true,
      runtime_feature: false,
      runtime_capability_enabled: false,
      activation_enabled: false,
      db_connection: false,
      db_introspection: false,
      repository_required: false,
      db_adapter_required: false,
      sql_execution: false,
      migration_application: false,
      runtime_table_creation: false,
      runtime_wiring: false,
      transaction_runner: false,
      admin_exposure: false,
      app_runtime_execution_path: false,
      provider_dispatch: false,
      shipment_creation: false,
      order_or_fulfillment_mutation: false,
    })
  })

  it("propagates optional table-name override into stable invocation and summary context", async () => {
    const snapshot = buildExternalSnapshot("custom_execution_ledger")
    const snapshotPath = await writeSnapshotFile("custom.json", snapshot)

    const result = await runDeliveryHubExecutionLedgerLocalOfflineValidator({
      snapshot_file_path: snapshotPath,
      table_name: "custom_execution_ledger",
    })

    expect(result.invocation).toEqual({
      identity: buildDeliveryHubExecutionLedgerLocalOfflineValidatorInvocationIdentity({
        resolved_snapshot_file_path: snapshotPath,
        supplied_table_name_override: "custom_execution_ledger",
      }),
      source: "manual_cli_snapshot_review",
      syntactically_valid_run: true,
      table_name_override_applied: true,
    })
    expect(result.input.supplied_table_name_override).toBe("custom_execution_ledger")
    expect(result.resolved.table_name).toBe("custom_execution_ledger")
    expect(result.summary.final_verdict).toBe("compatible")
    expect(result.verification.result.resolved_table_name).toBe("custom_execution_ledger")
  })

  it("fails safely for malformed JSON and malformed or drifted fixture contract shapes", async () => {
    const malformedPath = await writeRawSnapshotFile("malformed.json", "{not-valid-json")

    await expect(
      runDeliveryHubExecutionLedgerLocalOfflineValidator({
        snapshot_file_path: malformedPath,
      })
    ).rejects.toThrow(
      `Delivery Hub execution ledger local offline validator could not parse JSON snapshot at ${malformedPath}:`
    )

    const invalidShapePath = await writeRawSnapshotFile(
      "missing-tables.json",
      JSON.stringify({ indexes: [] }, null, 2)
    )

    await expect(
      runDeliveryHubExecutionLedgerLocalOfflineValidator({
        snapshot_file_path: invalidShapePath,
      })
    ).rejects.toThrow(
      `Delivery Hub execution ledger local offline validator expected root.tables array at ${invalidShapePath}.`
    )

    const invalidRolePath = await writeRawSnapshotFile(
      "invalid-role.json",
      JSON.stringify(
        {
          tables: [
            {
              name: "deliveryhub_execution_ledger",
              role: "wrong_role",
            },
          ],
        },
        null,
        2
      )
    )

    await expect(
      runDeliveryHubExecutionLedgerLocalOfflineValidator({
        snapshot_file_path: invalidRolePath,
      })
    ).rejects.toThrow(
      `Delivery Hub execution ledger local offline validator expected table.role to be one of main, transitions, audit_events at ${invalidRolePath}.tables[0].`
    )

    const invalidColumnPath = await writeRawSnapshotFile(
      "invalid-column.json",
      JSON.stringify(
        {
          tables: [
            {
              name: "deliveryhub_execution_ledger",
              role: "main",
              columns: [{ name: "execution_reference", nullable: "no" }],
            },
          ],
        },
        null,
        2
      )
    )

    await expect(
      runDeliveryHubExecutionLedgerLocalOfflineValidator({
        snapshot_file_path: invalidColumnPath,
      })
    ).rejects.toThrow(
      `Delivery Hub execution ledger local offline validator expected optional boolean column.nullable at ${invalidColumnPath}.tables[0].columns[0].`
    )
  })

  it("script prints canonical JSON envelope only and exits with code 0 for compatible verdict", async () => {
    const snapshotPath = await writeSnapshotFile("script-compatible.json", buildExternalSnapshot())
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await validateDeliveryHubExecutionLedgerSnapshot({ args: [snapshotPath] } as never)

    expect(process.exitCode).toBe(0)
    expect(logSpy).toHaveBeenCalledTimes(1)
    const payload = logSpy.mock.calls[0]?.[0]
    expect(typeof payload).toBe("string")
    expect(JSON.parse(String(payload))).toEqual(
      expect.objectContaining({
        envelope_version: 2,
        summary: expect.objectContaining({
          final_verdict: "compatible",
          mismatch_count: 0,
        }),
      })
    )
  })

  it("script exits with distinct non-zero code for incompatible but syntactically valid snapshot", async () => {
    const snapshot = buildExternalSnapshot()
    snapshot.tables = snapshot.tables.filter((table) => table.role !== "main")
    const snapshotPath = await writeSnapshotFile("script-incompatible.json", snapshot)
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await validateDeliveryHubExecutionLedgerSnapshot({ args: [snapshotPath] } as never)

    expect(process.exitCode).toBe(2)
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          final_verdict: "incompatible",
        }),
      })
    )
  })

  it("script sets malformed-input exit code and does not emit non-JSON stdout envelope on failure", async () => {
    const malformedPath = await writeRawSnapshotFile("script-malformed.json", "{not-valid-json")
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await expect(
      validateDeliveryHubExecutionLedgerSnapshot({ args: [malformedPath] } as never)
    ).rejects.toThrow(
      `Delivery Hub execution ledger local offline validator could not parse JSON snapshot at ${malformedPath}:`
    )

    expect(process.exitCode).toBe(3)
    expect(logSpy).not.toHaveBeenCalled()
  })
})

async function writeSnapshotFile(
  fileName: string,
  snapshot: DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot
) {
  return writeRawSnapshotFile(fileName, JSON.stringify(snapshot, null, 2))
}

async function writeRawSnapshotFile(fileName: string, contents: string) {
  const directory = await mkdtemp(join(tmpdir(), "deliveryhub-ledger-validator-"))
  tempDirectories.push(directory)
  const filePath = join(directory, fileName)
  await writeFile(filePath, contents, "utf8")
  return filePath
}

function buildExternalSnapshot(
  tableName = "deliveryhub_execution_ledger"
): DeliveryHubExecutionLedgerExternallySuppliedPlainSchemaSnapshot {
  const mainTable = tableName
  const transitionTable = `${tableName}_transitions`
  const auditTable = `${tableName}_audit_events`

  return {
    tables: [
      {
        name: mainTable,
        role: "main",
        columns: [
          "execution_reference",
          "idempotency_key",
          "execution_payload",
          "reservation_payload",
          "transitions_payload",
          "audit_events_payload",
          "created_at",
          "updated_at",
        ],
        indexes: [
          {
            name: `${mainTable}_pkey`,
            columns: ["execution_reference"],
            unique: true,
          },
          {
            name: `${mainTable}_idempotency_key_uidx`,
            columns: ["idempotency_key"],
            unique: true,
          },
        ],
        unique_constraints: [
          {
            name: `${mainTable}_idempotency_key_key`,
            columns: ["idempotency_key"],
          },
        ],
      },
      {
        name: transitionTable,
        role: "transitions",
        columns: [
          "execution_reference",
          "sequence",
          "recorded_at",
          "from_state",
          "to_state",
          "reason",
          "created_at",
        ],
        indexes: [
          {
            name: `${transitionTable}_execution_sequence_uidx`,
            columns: ["execution_reference", "sequence"],
            unique: true,
          },
        ],
        unique_constraints: [
          {
            name: `${transitionTable}_execution_sequence_key`,
            columns: ["execution_reference", "sequence"],
          },
        ],
        foreign_keys: [
          {
            name: `${transitionTable}_execution_reference_fkey`,
            columns: ["execution_reference"],
            referenced_table: mainTable,
            referenced_columns: ["execution_reference"],
          },
        ],
      },
      {
        name: auditTable,
        role: "audit_events",
        columns: [
          "execution_reference",
          "sequence",
          "recorded_at",
          "event_type",
          "event_payload",
          "created_at",
        ],
        indexes: [
          {
            name: `${auditTable}_execution_sequence_uidx`,
            columns: ["execution_reference", "sequence"],
            unique: true,
          },
        ],
        unique_constraints: [
          {
            name: `${auditTable}_execution_sequence_key`,
            columns: ["execution_reference", "sequence"],
          },
        ],
        foreign_keys: [
          {
            name: `${auditTable}_execution_reference_fkey`,
            columns: ["execution_reference"],
            referenced_table: mainTable,
            referenced_columns: ["execution_reference"],
          },
        ],
      },
    ],
  }
}
