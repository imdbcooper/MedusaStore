import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as deliveryShippingOptionsPreviewRoute from "../../api/admin/delivery/shipping-options/preview/route"
import {
  buildDeliveryHubFulfillmentOptionData,
  buildDeliveryHubShippingOptionSyncOperationPlan,
  createDeliveryHubShippingOptionManualSyncAuditLogger,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  DELIVERY_HUB_LOG_KIND,
  DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
  DELIVERY_HUB_MODE_CODE,
  executeDeliveryHubShippingOptionSyncOperationPlan,
  reconcileDeliveryHubShippingOptions,
  runDeliveryHubShippingOptionManualSync,
} from "../../modules/delivery-hub"
import { DeliveryHubService } from "../../modules/delivery-hub/service"

describe("Delivery Hub manual sync audit trail", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it("creates dry-run audit event without leaking raw request payloads or secrets", async () => {
    const currentOptions = [
      {
        id: "so_existing_dropoff",
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        data: buildDeliveryHubFulfillmentOptionData(
          DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
        ),
      },
    ]
    const preview = createPreview({
      current_options: currentOptions,
      desired_options: [
        createDesiredOption(DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint, "conn_dropoff"),
      ],
    })
    const pg = createAuditPg()

    await runDeliveryHubShippingOptionManualSync({
      service: {
        buildShippingOptionPreview: jest.fn(async () => preview),
      } as any,
      current_options: currentOptions,
      request: {
        mode: "dry_run",
        on_error: "abort",
        confirm_execute: "Bearer secret-token-123",
        mutation_context: {
          create: {
            [DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint]: {
              name: "Warehouse sync create",
              service_zone_id: "serzo_deliveryhub",
              shipping_profile_id: "sp_deliveryhub",
              rules: [
                {
                  attribute: "api_token",
                  operator: "eq",
                  value: "secret-token-123",
                },
              ],
            },
          },
          update: {
            [DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint]: {
              name: "Bearer secret-token-123",
              rules: [
                {
                  attribute: "client_secret",
                  operator: "eq",
                  value: "secret-token-123",
                },
              ],
              type: {
                label: "Пункт выдачи",
                code: "deliveryhub-dropoff-manual",
              },
            },
          },
        },
      },
      audit_log: createDeliveryHubShippingOptionManualSyncAuditLogger(pg as any),
    })

    const event = getPersistedAuditEvent(pg)

    expect(event.provider_code).toBe(DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE)
    expect(event.kind).toBe(DELIVERY_HUB_LOG_KIND.shippingOptionManualSync)
    expect(event.success).toBe(true)
    expect(event.error_code).toBeNull()
    expect(event.request_summary).toEqual({
      requested_mode: "dry_run",
      requested_on_error: "abort",
      current_option_count: 1,
      confirm_execute_provided: true,
      mutation_context_summary: {
        create_modes: [
          {
            mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
            service_zone_id: "serzo_deliveryhub",
            shipping_profile_id: "sp_deliveryhub",
          },
        ],
        update_modes: [
          {
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            name_override_present: true,
            rules_count: 1,
            type_code: "deliveryhub-dropoff-manual",
          },
        ],
        archive_modes: [],
      },
    })
    expect(event.response_summary).toMatchObject({
      outcome: "dry_run",
      error: null,
      execution_mode: {
        requested_mode: "dry_run",
        effective_mode: "dry_run",
        execute_requested: false,
        execute_confirmed: false,
        is_dry_run: true,
      },
      desired_plan_summary: {
        desired_option_count: 1,
      },
      execution_summary: null,
      planned_changes: {
        create: [],
        update: [],
        archive: [],
        noop: [
          {
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            shipping_option_id: "so_existing_dropoff",
          },
        ],
        ignored_foreign_option_ids: [],
      },
    })

    const persistedJson = JSON.stringify(event)
    expect(persistedJson).not.toContain("secret-token-123")
    expect(persistedJson).not.toContain("client_secret")
    expect(persistedJson).not.toContain("api_token")
  })

  it("creates execute audit event for successful manual sync", async () => {
    const preview = createPreview({
      current_options: [],
      desired_options: [
        createDesiredOption(DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint, "conn_create"),
      ],
    })
    const pg = createAuditPg()
    const mutationService = {
      createShippingOptions: jest.fn(async () => [{ id: "so_created" }]),
      updateShippingOptions: jest.fn(async () => []),
      deleteShippingOptions: jest.fn(async () => ({ deleted: [] })),
    }

    const result = await runDeliveryHubShippingOptionManualSync({
      service: {
        buildShippingOptionPreview: jest.fn(async () => preview),
      } as any,
      current_options: [],
      request: {
        mode: "execute",
        confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
        on_error: "abort",
        mutation_context: {
          create: {
            [DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint]: {
              name: "Warehouse sync create",
              service_zone_id: "serzo_deliveryhub",
              shipping_profile_id: "sp_deliveryhub",
            },
          },
        },
      },
      mutation_service: mutationService,
      execute: executeDeliveryHubShippingOptionSyncOperationPlan,
      audit_log: createDeliveryHubShippingOptionManualSyncAuditLogger(pg as any),
    })

    expect(result.execution.report?.outcome).toBe("succeeded")
    expect(mutationService.createShippingOptions).toHaveBeenCalledTimes(1)

    const event = getPersistedAuditEvent(pg)
    expect(event.success).toBe(true)
    expect(event.error_code).toBeNull()
    expect(event.response_summary).toMatchObject({
      outcome: "succeeded",
      aborted: false,
      error: null,
      execution_summary: {
        create_operation_count: 1,
        attempted_operation_count: 1,
        succeeded_operation_count: 1,
        failed_operation_count: 0,
      },
      failed_operations: [],
      planned_changes: {
        create: [
          {
            mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
            shipping_option_key: "deliveryhub:warehouse_to_pickup_point",
            supporting_connection_ids: ["conn_create"],
          },
        ],
      },
    })
  })

  it("logs execution failure truthfully and redacts failed-operation errors", async () => {
    const preview = createPreview({
      current_options: [],
      desired_options: [
        createDesiredOption(DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint, "conn_create"),
      ],
    })
    const operationPlan = buildDeliveryHubShippingOptionSyncOperationPlan(preview.reconciliation)
    const failedOperation = operationPlan.create_operations[0]
    const pg = createAuditPg()

    await runDeliveryHubShippingOptionManualSync({
      service: {
        buildShippingOptionPreview: jest.fn(async () => preview),
      } as any,
      current_options: [],
      request: {
        mode: "execute",
        confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
        on_error: "abort",
        mutation_context: {
          create: {
            [DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint]: {
              name: "Warehouse sync create",
              service_zone_id: "serzo_deliveryhub",
              shipping_profile_id: "sp_deliveryhub",
            },
          },
        },
      },
      mutation_service: {
        createShippingOptions: jest.fn(async () => [{ id: "so_created" }]),
        updateShippingOptions: jest.fn(async () => []),
        deleteShippingOptions: jest.fn(async () => ({ deleted: [] })),
      },
      execute: jest.fn(async () => ({
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        outcome: "failed",
        aborted: true,
        error_mode: "abort",
        summary: {
          create_operation_count: 1,
          update_operation_count: 0,
          archive_operation_count: 0,
          mutation_operation_count: 1,
          noop_count: 0,
          ignored_foreign_option_count: 0,
          attempted_operation_count: 1,
          succeeded_operation_count: 0,
          failed_operation_count: 1,
          not_executed_operation_count: 0,
        },
        create_results: [
          {
            type: "create" as const,
            status: "failed" as const,
            operation: failedOperation,
            error: new Error("Bearer secret-token-123 exploded"),
          },
        ],
        update_results: [],
        archive_results: [],
        executed_operations: [
          {
            type: "create" as const,
            status: "failed" as const,
            operation: failedOperation,
            error: new Error("Bearer secret-token-123 exploded"),
          },
        ],
      })) as any,
      audit_log: createDeliveryHubShippingOptionManualSyncAuditLogger(pg as any),
    })

    const event = getPersistedAuditEvent(pg)
    expect(event.success).toBe(false)
    expect(event.error_code).toBeNull()
    expect(event.response_summary).toMatchObject({
      outcome: "failed",
      aborted: true,
      error: null,
      execution_summary: {
        failed_operation_count: 1,
        attempted_operation_count: 1,
      },
      failed_operations: [
        {
          type: "create",
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          shipping_option_id: null,
          error: {
            name: "Error",
            code: "DELIVERY_HUB_UNEXPECTED_ERROR",
            message: "Bearer *** exploded",
          },
        },
      ],
    })
    expect(JSON.stringify(event.response_summary)).not.toContain("secret-token-123")
  })

  it("logs fail-fast validation errors without leaking confirmation payload", async () => {
    const preview = createPreview({
      current_options: [],
      desired_options: [],
    })
    const pg = createAuditPg()

    await expect(
      runDeliveryHubShippingOptionManualSync({
        service: {
          buildShippingOptionPreview: jest.fn(async () => preview),
        } as any,
        current_options: [],
        request: {
          mode: "execute",
          confirm_execute: "Bearer secret-token-123",
          on_error: "abort",
          mutation_context: {
            create: {
              [DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint]: {
                name: "Warehouse sync create",
                service_zone_id: "serzo_deliveryhub",
                shipping_profile_id: "sp_deliveryhub",
              },
            },
          },
        },
        audit_log: createDeliveryHubShippingOptionManualSyncAuditLogger(pg as any),
      })
    ).rejects.toMatchObject({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      status: 400,
    })

    const event = getPersistedAuditEvent(pg)
    expect(event.success).toBe(false)
    expect(event.error_code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(event.response_summary).toMatchObject({
      outcome: "failed",
      error: {
        name: "DeliveryHubError",
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        status: 400,
        message: "Manual shipping-option sync execute mode requires explicit confirmation.",
        details: {
          mode: "execute",
          confirm_execute: "Bearer ***",
          expected_confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
        },
      },
    })
    expect(JSON.stringify(event)).not.toContain("secret-token-123")
  })

  it("keeps preview route read-only and does not append audit events", async () => {
    const currentOptions = [
      {
        id: "so_existing_dropoff",
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        data: buildDeliveryHubFulfillmentOptionData(
          DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
        ),
      },
    ]
    const preview = createPreview({
      current_options: currentOptions,
      desired_options: [
        createDesiredOption(DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint, "conn_dropoff"),
      ],
    })
    const buildPreviewSpy = jest
      .spyOn(DeliveryHubService.prototype, "buildShippingOptionPreview")
      .mockResolvedValue(preview as any)
    const pg = {
      raw: jest.fn(async () => ({ rows: [] })),
    }
    const res = createMockResponse()
    const req = {
      url: "/admin/delivery/shipping-options/preview",
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn(async () => ({ data: currentOptions })),
            }
          }

          if (key === ContainerRegistrationKeys.PG_CONNECTION) {
            return pg
          }

          return null
        }),
      },
    }

    await deliveryShippingOptionsPreviewRoute.GET(req as any, res as any)

    expect(buildPreviewSpy).toHaveBeenCalledWith(currentOptions)
    expect(pg.raw).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      preview,
    })
  })
})

function createDesiredOption(
  mode_code: (typeof DELIVERY_HUB_MODE_CODE)[keyof typeof DELIVERY_HUB_MODE_CODE],
  supporting_connection_id: string
) {
  return {
    status: "projected" as const,
    mode_code,
    data: buildDeliveryHubFulfillmentOptionData(mode_code),
    supporting_connection_ids: [supporting_connection_id],
  }
}

function createPreview(input: {
  current_options: Array<Record<string, unknown>>
  desired_options: Array<ReturnType<typeof createDesiredOption>>
}) {
  const reconciliation = reconcileDeliveryHubShippingOptions({
    desired_options: input.desired_options,
    current_options: input.current_options as any,
  })

  return {
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    current_options: input.current_options as any,
    plan: {
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
      desired_options: input.desired_options,
      deferred_options: [],
      connection_plans: [],
    },
    reconciliation,
    summary: {
      current_option_count: input.current_options.length,
      desired_option_count: input.desired_options.length,
      deferred_option_count: 0,
      deferred_issue_count: 0,
      connection_plan_count: 0,
      create_candidate_count: reconciliation.create_candidates.length,
      update_candidate_count: reconciliation.update_candidates.length,
      unchanged_count: reconciliation.unchanged.length,
      orphaned_managed_option_count: reconciliation.orphaned_managed_options.length,
      ignored_foreign_option_count: reconciliation.ignored_foreign_options.length,
    },
  }
}

function createAuditPg() {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const events: Array<Record<string, unknown>> = []

  return {
    calls,
    events,
    async raw(sql: string, params?: unknown[]) {
      const normalizedSql = sql.replace(/\s+/g, " ").trim()
      const normalizedParams = Array.isArray(params) ? params : []
      calls.push({ sql: normalizedSql, params: normalizedParams })

      if (normalizedSql.includes("create table if not exists delivery_event_logs")) {
        return { rows: [] }
      }

      if (normalizedSql.includes("insert into delivery_event_logs")) {
        const record = {
          id: String(normalizedParams[0] ?? "log_1"),
          connection_id: normalizedParams[1] ?? null,
          provider_code: normalizedParams[2],
          kind: normalizedParams[3],
          correlation_id: normalizedParams[4],
          success: normalizedParams[5],
          request_summary: JSON.parse(String(normalizedParams[6] ?? "{}")),
          response_summary: JSON.parse(String(normalizedParams[7] ?? "{}")),
          error_code: normalizedParams[8] ?? null,
          created_at: "2026-04-21T00:00:00.000Z",
        }

        events.unshift(record)
        return { rows: [record] }
      }

      throw new Error(`Unhandled SQL in audit pg mock: ${normalizedSql}`)
    },
  }
}

function getPersistedAuditEvent(pg: ReturnType<typeof createAuditPg>) {
  expect(pg.events).toHaveLength(1)
  return pg.events[0] as {
    provider_code: string
    kind: string
    success: boolean
    error_code: string | null
    request_summary: Record<string, unknown>
    response_summary: Record<string, unknown>
  }
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
}
