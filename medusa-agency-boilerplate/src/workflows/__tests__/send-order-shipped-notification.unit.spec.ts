import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sendOrderShippedNotificationWorkflow from "../send-order-shipped-notification"

type FulfillmentRecord = {
  id: string
  order?: {
    id: string
    display_id: number | string | null
    email: string | null
  } | null
}

type NotificationRecord = {
  id: string
  to: string
  status: string
  created_at: string
}

type GraphCall = {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

function buildHarness(options: {
  fulfillmentsById: Record<string, FulfillmentRecord>
}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  }

  const graphCalls: GraphCall[] = []
  const notificationsStore = new Map<string, NotificationRecord[]>()
  let notificationSequence = 0

  const query = {
    graph: jest.fn(async (args: GraphCall) => {
      graphCalls.push(args)

      if (args.entity === "fulfillment") {
        const id = String(args.filters.id)
        const fulfillment = options.fulfillmentsById[id]

        return {
          data: fulfillment ? [fulfillment] : [],
        }
      }

      if (args.entity === "notification") {
        const resourceId = String(args.filters.resource_id)

        return {
          data: notificationsStore.get(resourceId) || [],
        }
      }

      throw new Error(`Unexpected graph entity: ${args.entity}`)
    }),
  }

  const notificationModuleService = {
    createNotifications: jest.fn(async (payload: any) => {
      notificationSequence += 1

      const notification = {
        id: `noti_${notificationSequence}`,
        to: payload.to,
        channel: payload.channel,
        template: payload.template,
        trigger_type: payload.trigger_type,
        resource_type: payload.resource_type,
        resource_id: payload.resource_id,
        provider_id: "local",
        status: "pending",
        created_at: new Date(Date.UTC(2026, 3, 18, 4, 0, notificationSequence))
          .toISOString(),
        data: payload.data,
        content: payload.content,
      }

      const existing = notificationsStore.get(payload.resource_id) || []
      notificationsStore.set(payload.resource_id, [
        ...existing,
        {
          id: notification.id,
          to: notification.to,
          status: notification.status,
          created_at: notification.created_at,
        },
      ])

      return notification
    }),
  }

  const container = createContainer()

  container.register({
    [ContainerRegistrationKeys.LOGGER]: asValue(logger),
    [ContainerRegistrationKeys.QUERY]: asValue(query),
    [Modules.NOTIFICATION]: asValue(notificationModuleService),
  })

  return {
    container: container as any,
    logger,
    query,
    graphCalls,
    notificationModuleService,
    getNotificationsFor: (resourceId: string) => notificationsStore.get(resourceId) || [],
  }
}

async function runWorkflow(
  container: any,
  input: {
    fulfillmentId: string
    noNotification?: boolean
  }
) {
  return await sendOrderShippedNotificationWorkflow(container).run({
    input,
  })
}

describe("sendOrderShippedNotificationWorkflow runtime validation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sends once for a single shipment-created path", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_1: {
          id: "ful_1",
          order: {
            id: "ord_1",
            display_id: 1001,
            email: " Customer@Example.com ",
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      fulfillmentId: "ful_1",
    })

    const result = response.result.result
    const [payload] = harness.notificationModuleService.createNotifications.mock.calls[0]

    console.info("[shipped-validation] single-send", {
      result,
      graphCalls: harness.graphCalls,
      payload,
    })

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.fulfillment_id).toBe("ful_1")
    expect(result.recipient).toBe("customer@example.com")
    expect(result.dedupe_key).toContain("resource_id=ful_1")
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(1)
    expect(payload.resource_type).toBe("fulfillment")
    expect(payload.resource_id).toBe("ful_1")
    expect(payload.to).toBe("customer@example.com")
    expect(harness.getNotificationsFor("ful_1")).toHaveLength(1)
  })

  it("skips immediately when no_notification=true", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_1: {
          id: "ful_1",
          order: {
            id: "ord_1",
            display_id: 1001,
            email: "customer@example.com",
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      fulfillmentId: "ful_1",
      noNotification: true,
    })

    const result = response.result.result

    console.info("[shipped-validation] no-notification skip", {
      result,
      graphCalls: harness.graphCalls,
    })

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("no_notification_requested")
    expect(result.no_notification).toBe(true)
    expect(harness.query.graph).not.toHaveBeenCalled()
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when normalized recipient is absent", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_2: {
          id: "ful_2",
          order: {
            id: "ord_2",
            display_id: 1002,
            email: "   ",
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      fulfillmentId: "ful_2",
    })

    const result = response.result.result

    console.info("[shipped-validation] missing-recipient skip", {
      result,
      graphCalls: harness.graphCalls,
    })

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("missing_order_email")
    expect(result.recipient).toBeNull()
    expect(result.recipient_normalized).toBeNull()
    expect(harness.query.graph).toHaveBeenCalledTimes(1)
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("suppresses duplicate processing for the same fulfillment id", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_dup: {
          id: "ful_dup",
          order: {
            id: "ord_dup",
            display_id: 1003,
            email: "dup@example.com",
          },
        },
      },
    })

    const firstResponse = await runWorkflow(harness.container, {
      fulfillmentId: "ful_dup",
    })
    const secondResponse = await runWorkflow(harness.container, {
      fulfillmentId: "ful_dup",
    })

    const firstResult = firstResponse.result.result
    const secondResult = secondResponse.result.result

    console.info("[shipped-validation] duplicate-suppression", {
      firstResult,
      secondResult,
      notifications: harness.getNotificationsFor("ful_dup"),
    })

    expect(firstResult.status).toBe("sent")
    expect(secondResult.status).toBe("skipped")
    expect(secondResult.reason).toBe("duplicate_notification")
    expect(secondResult.duplicate_of_notification_id).toBe(
      firstResult.notification?.id || null
    )
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(1)
    expect(harness.getNotificationsFor("ful_dup")).toHaveLength(1)
  })

  it("does not falsely dedupe two different shipments of the same order", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_a: {
          id: "ful_a",
          order: {
            id: "ord_shared",
            display_id: 1004,
            email: "shared@example.com",
          },
        },
        ful_b: {
          id: "ful_b",
          order: {
            id: "ord_shared",
            display_id: 1004,
            email: "shared@example.com",
          },
        },
      },
    })

    const firstResponse = await runWorkflow(harness.container, {
      fulfillmentId: "ful_a",
    })
    const secondResponse = await runWorkflow(harness.container, {
      fulfillmentId: "ful_b",
    })

    const firstResult = firstResponse.result.result
    const secondResult = secondResponse.result.result

    console.info("[shipped-validation] no-false-cross-fulfillment-dedupe", {
      firstResult,
      secondResult,
      notificationsA: harness.getNotificationsFor("ful_a"),
      notificationsB: harness.getNotificationsFor("ful_b"),
    })

    expect(firstResult.status).toBe("sent")
    expect(secondResult.status).toBe("sent")
    expect(firstResult.dedupe_key).toContain("resource_id=ful_a")
    expect(secondResult.dedupe_key).toContain("resource_id=ful_b")
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(2)
    expect(harness.getNotificationsFor("ful_a")).toHaveLength(1)
    expect(harness.getNotificationsFor("ful_b")).toHaveLength(1)
  })
})
