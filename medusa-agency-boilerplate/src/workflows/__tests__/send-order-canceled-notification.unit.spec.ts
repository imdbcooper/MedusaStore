import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sendOrderCanceledNotificationWorkflow from "../send-order-canceled-notification"

type OrderRecord = {
  id: string
  display_id: number | string | null
  email: string | null
  canceled_at: string | null
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
  ordersById: Record<string, OrderRecord>
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

      if (args.entity === "order") {
        const id = String(args.filters.id)
        const order = options.ordersById[id]

        return {
          data: order ? [order] : [],
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
        created_at: new Date(Date.UTC(2026, 3, 18, 6, 0, notificationSequence))
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
    orderId: string
  }
) {
  return await sendOrderCanceledNotificationWorkflow(container).run({
    input,
  })
}

describe("sendOrderCanceledNotificationWorkflow runtime validation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sends once for a single canceled order", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_1: {
          id: "ord_1",
          display_id: 2001,
          email: " Customer@Example.com ",
          canceled_at: "2026-04-18T06:00:00.000Z",
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_1",
    })

    const result = response.result.result
    const [payload] = harness.notificationModuleService.createNotifications.mock.calls[0]

    console.info("[order-canceled-validation] single-send", {
      result,
      graphCalls: harness.graphCalls,
      payload,
    })

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.order_id).toBe("ord_1")
    expect(result.recipient).toBe("customer@example.com")
    expect(result.canceled_at).toBe("2026-04-18T06:00:00.000Z")
    expect(result.dedupe_key).toContain("resource_type=order")
    expect(result.dedupe_key).toContain("resource_id=ord_1")
    expect(payload.resource_type).toBe("order")
    expect(payload.resource_id).toBe("ord_1")
    expect(payload.to).toBe("customer@example.com")
    expect(payload.template).toBe("order-canceled-v1")
    expect(harness.getNotificationsFor("ord_1")).toHaveLength(1)
  })

  it("skips when normalized recipient is absent", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_no_email: {
          id: "ord_no_email",
          display_id: 2002,
          email: "   ",
          canceled_at: "2026-04-18T06:05:00.000Z",
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_no_email",
    })

    const result = response.result.result

    console.info("[order-canceled-validation] missing-recipient skip", {
      result,
      graphCalls: harness.graphCalls,
    })

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("missing_order_email")
    expect(result.recipient).toBeNull()
    expect(result.recipient_normalized).toBeNull()
    expect(result.canceled_at).toBe("2026-04-18T06:05:00.000Z")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when order is not actually canceled", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_not_canceled: {
          id: "ord_not_canceled",
          display_id: 2003,
          email: "not-canceled@example.com",
          canceled_at: null,
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_not_canceled",
    })

    const result = response.result.result

    console.info("[order-canceled-validation] order-not-canceled skip", {
      result,
      graphCalls: harness.graphCalls,
    })

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("order_not_canceled")
    expect(result.canceled_at).toBeNull()
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("suppresses duplicate reprocessing for the same order id", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_dup: {
          id: "ord_dup",
          display_id: 2004,
          email: "dup@example.com",
          canceled_at: "2026-04-18T06:10:00.000Z",
        },
      },
    })

    const firstResponse = await runWorkflow(harness.container, {
      orderId: "ord_dup",
    })
    const secondResponse = await runWorkflow(harness.container, {
      orderId: "ord_dup",
    })

    const firstResult = firstResponse.result.result
    const secondResult = secondResponse.result.result

    console.info("[order-canceled-validation] duplicate-suppression", {
      firstResult,
      secondResult,
      notifications: harness.getNotificationsFor("ord_dup"),
    })

    expect(firstResult.status).toBe("sent")
    expect(secondResult.status).toBe("skipped")
    expect(secondResult.reason).toBe("duplicate_notification")
    expect(secondResult.duplicate_of_notification_id).toBe(
      firstResult.notification?.id || null
    )
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(1)
    expect(harness.getNotificationsFor("ord_dup")).toHaveLength(1)
  })

  it("does not falsely dedupe two distinct canceled orders of the same recipient", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_a: {
          id: "ord_a",
          display_id: 2005,
          email: "shared@example.com",
          canceled_at: "2026-04-18T06:15:00.000Z",
        },
        ord_b: {
          id: "ord_b",
          display_id: 2006,
          email: "shared@example.com",
          canceled_at: "2026-04-18T06:16:00.000Z",
        },
      },
    })

    const firstResponse = await runWorkflow(harness.container, {
      orderId: "ord_a",
    })
    const secondResponse = await runWorkflow(harness.container, {
      orderId: "ord_b",
    })

    const firstResult = firstResponse.result.result
    const secondResult = secondResponse.result.result

    console.info("[order-canceled-validation] no-false-cross-order-dedupe", {
      firstResult,
      secondResult,
      notificationsA: harness.getNotificationsFor("ord_a"),
      notificationsB: harness.getNotificationsFor("ord_b"),
    })

    expect(firstResult.status).toBe("sent")
    expect(secondResult.status).toBe("sent")
    expect(firstResult.dedupe_key).toContain("resource_id=ord_a")
    expect(secondResult.dedupe_key).toContain("resource_id=ord_b")
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(2)
    expect(harness.getNotificationsFor("ord_a")).toHaveLength(1)
    expect(harness.getNotificationsFor("ord_b")).toHaveLength(1)
  })
})
