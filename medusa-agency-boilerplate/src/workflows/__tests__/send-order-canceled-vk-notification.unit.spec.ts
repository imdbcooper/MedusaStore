import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sendOrderCanceledVkNotificationWorkflow from "../send-order-canceled-vk-notification"

type OrderRecord = {
  id: string
  display_id: number | string | null
  canceled_at: string | null
  customer?: {
    id: string | null
    metadata?: Record<string, unknown> | null
  } | null
}

type NotificationRecord = {
  id: string
  to: string
  status: string
  created_at: string
  channel: string
  template: string
  trigger_type: string
  resource_type: string
  resource_id: string
}

type GraphCall = {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

function buildHarness(options: {
  ordersById: Record<string, OrderRecord>
  existingNotifications?: NotificationRecord[]
}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  }

  const graphCalls: GraphCall[] = []
  const notificationsStore = new Map<string, NotificationRecord[]>()
  let notificationSequence = 0

  for (const notification of options.existingNotifications || []) {
    const current = notificationsStore.get(notification.resource_id) || []
    notificationsStore.set(notification.resource_id, [...current, notification])
  }

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
        const channel = String(args.filters.channel)
        const template = String(args.filters.template)
        const triggerType = String(args.filters.trigger_type)
        const resourceType = String(args.filters.resource_type)

        return {
          data: (notificationsStore.get(resourceId) || []).filter(
            (notification) =>
              notification.channel === channel &&
              notification.template === template &&
              notification.trigger_type === triggerType &&
              notification.resource_type === resourceType
          ),
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
        provider_id: "vk-community",
        status: "pending",
        created_at: new Date(
          Date.UTC(2026, 3, 18, 6, 0, notificationSequence)
        ).toISOString(),
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
          channel: notification.channel,
          template: notification.template,
          trigger_type: notification.trigger_type,
          resource_type: notification.resource_type,
          resource_id: notification.resource_id,
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
    getNotificationsFor: (resourceId: string) =>
      notificationsStore.get(resourceId) || [],
  }
}

async function runWorkflow(container: any, input: { orderId: string }) {
  return await sendOrderCanceledVkNotificationWorkflow(container).run({
    input,
  })
}

describe("sendOrderCanceledVkNotificationWorkflow runtime validation", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NOTIFICATION_VK_PROVIDER: "community",
      VK_COMMUNITY_ACCESS_TOKEN: "vk-token",
      VK_COMMUNITY_GROUP_ID: "123456",
      VK_API_VERSION: "5.199",
    }
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("sends once for a single canceled order vk path", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_1: {
          id: "ord_1",
          display_id: 5001,
          canceled_at: "2026-04-18T06:00:00.000Z",
          customer: {
            id: "cust_1",
            metadata: {
              vk_peer_id: " 2000000001 ",
            },
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_1",
    })

    const result = response.result.result
    const [payload] =
      harness.notificationModuleService.createNotifications.mock.calls[0]

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.order_id).toBe("ord_1")
    expect(result.customer_id).toBe("cust_1")
    expect(result.recipient).toBe("2000000001")
    expect(result.canceled_at).toBe("2026-04-18T06:00:00.000Z")
    expect(payload.resource_type).toBe("order")
    expect(payload.resource_id).toBe("ord_1")
    expect(payload.channel).toBe("vk")
    expect(harness.getNotificationsFor("ord_1")).toHaveLength(1)
  })

  it("skips when customer vk recipient is absent", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_no_vk: {
          id: "ord_no_vk",
          display_id: 5002,
          canceled_at: "2026-04-18T06:05:00.000Z",
          customer: {
            id: "cust_2",
            metadata: {},
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_no_vk",
    })

    const result = response.result.result

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("missing_customer_vk_peer_id")
    expect(result.customer_id).toBe("cust_2")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when order is not actually canceled", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_not_canceled: {
          id: "ord_not_canceled",
          display_id: 5003,
          canceled_at: null,
          customer: {
            id: "cust_3",
            metadata: {
              vk_peer_id: "2000000003",
            },
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_not_canceled",
    })

    const result = response.result.result

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
          display_id: 5004,
          canceled_at: "2026-04-18T06:10:00.000Z",
          customer: {
            id: "cust_dup",
            metadata: {
              vk_peer_id: "2000000004",
            },
          },
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

    expect(firstResult.status).toBe("sent")
    expect(secondResult.status).toBe("skipped")
    expect(secondResult.reason).toBe("duplicate_notification")
    expect(secondResult.duplicate_of_notification_id).toBe(
      firstResult.notification?.id || null
    )
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(
      1
    )
  })

  it("does not falsely dedupe against an existing email notification", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_cross: {
          id: "ord_cross",
          display_id: 5005,
          canceled_at: "2026-04-18T06:12:00.000Z",
          customer: {
            id: "cust_cross",
            metadata: {
              vk_peer_id: "2000000005",
            },
          },
        },
      },
      existingNotifications: [
        {
          id: "email_1",
          to: "2000000005",
          status: "sent",
          created_at: "2026-04-18T06:11:00.000Z",
          channel: "email",
          template: "order-canceled-vk-v1",
          trigger_type: "order.canceled.customer.notification_requested",
          resource_type: "order",
          resource_id: "ord_cross",
        },
      ],
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_cross",
    })

    const result = response.result.result

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.dedupe_key).toContain("channel=vk")
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(
      1
    )
    expect(harness.getNotificationsFor("ord_cross")).toHaveLength(2)
  })
})
