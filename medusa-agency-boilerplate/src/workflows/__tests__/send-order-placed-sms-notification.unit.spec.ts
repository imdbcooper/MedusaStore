import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sendOrderPlacedSmsNotificationWorkflow from "../send-order-placed-sms-notification"

type OrderRecord = {
  id: string
  display_id: number | string | null
  shipping_address?: {
    phone?: string | null
  } | null
  billing_address?: {
    phone?: string | null
  } | null
  customer?: {
    id?: string | null
    phone?: string | null
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
        provider_id: "exolve",
        status: "pending",
        created_at: new Date(Date.UTC(2026, 3, 18, 7, 0, notificationSequence)).toISOString(),
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
    graphCalls,
    notificationModuleService,
    getNotificationsFor: (resourceId: string) => notificationsStore.get(resourceId) || [],
  }
}

async function runWorkflow(container: any, input: { orderId: string }) {
  return await sendOrderPlacedSmsNotificationWorkflow(container).run({
    input,
  })
}

describe("sendOrderPlacedSmsNotificationWorkflow runtime validation", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      NOTIFICATION_SMS_PROVIDER: "exolve",
      MTS_EXOLVE_API_KEY: "sms-api-key",
      MTS_EXOLVE_SENDER: "MyShop",
    }
  })

  it("sends once using shipping phone as canonical recipient", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_1: {
          id: "ord_1",
          display_id: 3001,
          shipping_address: {
            phone: "8 (912) 345-67-89",
          },
          billing_address: {
            phone: "+7 999 000-00-00",
          },
          customer: {
            id: "cus_1",
            phone: "+7 900 000-00-00",
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_1",
    })

    const result = response.result.result
    const [payload] = harness.notificationModuleService.createNotifications.mock.calls[0]

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.order_id).toBe("ord_1")
    expect(result.customer_id).toBe("cus_1")
    expect(result.recipient).toBe("8 (912) 345-67-89")
    expect(result.recipient_normalized).toBe("+79123456789")
    expect(result.recipient_source).toBe("shipping_address.phone")
    expect(result.dedupe_key).toContain("channel=sms")
    expect(payload.to).toBe("+79123456789")
    expect(payload.channel).toBe("sms")
    expect(payload.template).toBe("order-placed-sms-v1")
    expect(harness.getNotificationsFor("ord_1")).toHaveLength(1)
  })

  it("skips when provider is not configured", async () => {
    delete process.env.MTS_EXOLVE_API_KEY

    const harness = buildHarness({
      ordersById: {
        ord_provider_off: {
          id: "ord_provider_off",
          display_id: 3002,
          shipping_address: {
            phone: "+79123456789",
          },
          customer: {
            id: "cus_provider_off",
            phone: "+79001112233",
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_provider_off",
    })

    const result = response.result.result

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("provider_not_configured")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when phone is missing or invalid after recipient resolution", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_bad_phone: {
          id: "ord_bad_phone",
          display_id: 3003,
          shipping_address: {
            phone: "invalid",
          },
          billing_address: {
            phone: "",
          },
          customer: {
            id: "cus_bad_phone",
            phone: null,
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      orderId: "ord_bad_phone",
    })

    const result = response.result.result

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("missing_or_invalid_phone")
    expect(result.recipient).toBe("invalid")
    expect(result.recipient_normalized).toBeNull()
    expect(result.recipient_source).toBe("shipping_address.phone")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("suppresses duplicate reprocessing for the same order id and sms recipient", async () => {
    const harness = buildHarness({
      ordersById: {
        ord_dup: {
          id: "ord_dup",
          display_id: 3004,
          shipping_address: {
            phone: "+79123456789",
          },
          customer: {
            id: "cus_dup",
            phone: null,
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
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(1)
  })
})
