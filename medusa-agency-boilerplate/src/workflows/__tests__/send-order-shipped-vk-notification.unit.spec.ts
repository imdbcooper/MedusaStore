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
import sendOrderShippedVkNotificationWorkflow from "../send-order-shipped-vk-notification"

type FulfillmentRecord = {
  id: string
  order?: {
    id: string
    display_id: number | string | null
    customer?: {
      id: string | null
      metadata?: Record<string, unknown> | null
    } | null
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
  fulfillmentsById: Record<string, FulfillmentRecord>
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

      if (args.entity === "fulfillment") {
        const id = String(args.filters.id)
        const fulfillment = options.fulfillmentsById[id]

        return {
          data: fulfillment ? [fulfillment] : [],
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
          Date.UTC(2026, 3, 18, 4, 0, notificationSequence)
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

async function runWorkflow(
  container: any,
  input: {
    fulfillmentId: string
    noNotification?: boolean
  }
) {
  return await sendOrderShippedVkNotificationWorkflow(container).run({
    input,
  })
}

describe("sendOrderShippedVkNotificationWorkflow runtime validation", () => {
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

  it("sends once for a single shipment-created vk path", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_1: {
          id: "ful_1",
          order: {
            id: "ord_1",
            display_id: 4001,
            customer: {
              id: "cust_1",
              metadata: {
                vk_peer_id: " 2000000001 ",
              },
            },
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      fulfillmentId: "ful_1",
    })

    const result = response.result.result
    const [payload] =
      harness.notificationModuleService.createNotifications.mock.calls[0]

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.fulfillment_id).toBe("ful_1")
    expect(result.order_id).toBe("ord_1")
    expect(result.customer_id).toBe("cust_1")
    expect(result.recipient).toBe("2000000001")
    expect(payload.resource_type).toBe("fulfillment")
    expect(payload.resource_id).toBe("ful_1")
    expect(payload.channel).toBe("vk")
    expect(harness.getNotificationsFor("ful_1")).toHaveLength(1)
  })

  it("skips immediately when no_notification=true", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_1: {
          id: "ful_1",
          order: {
            id: "ord_1",
            display_id: 4001,
            customer: {
              id: "cust_1",
              metadata: {
                vk_peer_id: "2000000001",
              },
            },
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      fulfillmentId: "ful_1",
      noNotification: true,
    })

    const result = response.result.result

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("no_notification_requested")
    expect(result.no_notification).toBe(true)
    expect(harness.query.graph).not.toHaveBeenCalled()
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when customer vk recipient is absent", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_2: {
          id: "ful_2",
          order: {
            id: "ord_2",
            display_id: 4002,
            customer: {
              id: "cust_2",
              metadata: {},
            },
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      fulfillmentId: "ful_2",
    })

    const result = response.result.result

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("missing_customer_vk_peer_id")
    expect(result.customer_id).toBe("cust_2")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("suppresses duplicate processing for the same fulfillment id", async () => {
    const harness = buildHarness({
      fulfillmentsById: {
        ful_dup: {
          id: "ful_dup",
          order: {
            id: "ord_dup",
            display_id: 4003,
            customer: {
              id: "cust_dup",
              metadata: {
                vk_peer_id: "2000000003",
              },
            },
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
      fulfillmentsById: {
        ful_cross: {
          id: "ful_cross",
          order: {
            id: "ord_cross",
            display_id: 4004,
            customer: {
              id: "cust_cross",
              metadata: {
                vk_peer_id: "2000000004",
              },
            },
          },
        },
      },
      existingNotifications: [
        {
          id: "email_1",
          to: "2000000004",
          status: "sent",
          created_at: "2026-04-18T04:00:00.000Z",
          channel: "email",
          template: "order-shipped-vk-v1",
          trigger_type: "shipment.created.customer.notification_requested",
          resource_type: "fulfillment",
          resource_id: "ful_cross",
        },
      ],
    })

    const response = await runWorkflow(harness.container, {
      fulfillmentId: "ful_cross",
    })

    const result = response.result.result

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.dedupe_key).toContain("channel=vk")
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(
      1
    )
    expect(harness.getNotificationsFor("ful_cross")).toHaveLength(2)
  })
})
