import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sendPaymentFailedSmsNotificationWorkflow from "../send-payment-failed-sms-notification"

type PaymentSessionRecord = {
  id: string
  provider_id: string | null
  status: string | null
  payment_collection_id: string | null
  data?: Record<string, unknown> | null
}

type CartPaymentCollectionRecord = {
  cart_id: string
}

type CartRecord = {
  id: string
  shipping_address?: {
    phone?: string | null
  } | null
  billing_address?: {
    phone?: string | null
  } | null
  customer?: {
    phone?: string | null
  } | null
}

type OrderCartRecord = {
  id: string
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
  paymentSessionsById: Record<string, PaymentSessionRecord>
  cartLinksByPaymentCollectionId?: Record<string, CartPaymentCollectionRecord>
  cartsById?: Record<string, CartRecord>
  orderLinksByCartId?: Record<string, OrderCartRecord>
  existingPaymentsBySessionId?: Record<string, { id: string }[]>
}) {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
  }

  const notificationsStore = new Map<string, NotificationRecord[]>()
  let notificationSequence = 0

  const query = {
    graph: jest.fn(async (args: GraphCall) => {
      if (args.entity === "payment_session") {
        const id = String(args.filters.id)
        const session = options.paymentSessionsById[id]

        return {
          data: session ? [session] : [],
        }
      }

      if (args.entity === "payment") {
        const sessionId = String(args.filters.payment_session_id)

        return {
          data: options.existingPaymentsBySessionId?.[sessionId] || [],
        }
      }

      if (args.entity === "cart_payment_collection") {
        const paymentCollectionId = String(args.filters.payment_collection_id)
        const link = options.cartLinksByPaymentCollectionId?.[paymentCollectionId]

        return {
          data: link ? [link] : [],
        }
      }

      if (args.entity === "cart") {
        const id = String(args.filters.id)
        const cart = options.cartsById?.[id]

        return {
          data: cart ? [cart] : [],
        }
      }

      if (args.entity === "order_cart") {
        const cartId = String(args.filters.cart_id)
        const link = options.orderLinksByCartId?.[cartId]

        return {
          data: link ? [link] : [],
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
        created_at: new Date(Date.UTC(2026, 3, 18, 8, 0, notificationSequence)).toISOString(),
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
    notificationModuleService,
    getNotificationsFor: (resourceId: string) => notificationsStore.get(resourceId) || [],
  }
}

async function runWorkflow(
  container: any,
  input: {
    paymentSessionId: string
    paymentId?: string
    providerId?: string
    paymentStatus?: string
    paymentSessionStatus?: string
    source?: string
  }
) {
  return await sendPaymentFailedSmsNotificationWorkflow(container).run({
    input,
  })
}

describe("sendPaymentFailedSmsNotificationWorkflow runtime validation", () => {
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

  it("sends once for terminal failed payment using cart shipping phone", async () => {
    const harness = buildHarness({
      paymentSessionsById: {
        payses_fail_1: {
          id: "payses_fail_1",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_1",
          data: {
            id: "yk_1",
            status: "canceled",
          },
        },
      },
      cartLinksByPaymentCollectionId: {
        paycol_1: {
          cart_id: "cart_1",
        },
      },
      cartsById: {
        cart_1: {
          id: "cart_1",
          shipping_address: {
            phone: "+7 912 345 67 89",
          },
          billing_address: {
            phone: "+7 900 000 00 00",
          },
          customer: {
            phone: "+7 911 000 00 00",
          },
        },
      },
      orderLinksByCartId: {
        cart_1: {
          id: "ord_1",
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      paymentSessionId: "payses_fail_1",
      paymentStatus: "canceled",
      paymentSessionStatus: "canceled",
      paymentId: "yk_1",
      providerId: "pp_yookassa_yookassa",
      source: "yookassa_webhook",
    })

    const result = response.result.result
    const [payload] = harness.notificationModuleService.createNotifications.mock.calls[0]

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.cart_id).toBe("cart_1")
    expect(result.order_id).toBe("ord_1")
    expect(result.recipient).toBe("+7 912 345 67 89")
    expect(result.recipient_normalized).toBe("+79123456789")
    expect(result.recipient_source).toBe("shipping_address.phone")
    expect(result.dedupe_key).toContain("channel=sms")
    expect(payload.to).toBe("+79123456789")
    expect(payload.channel).toBe("sms")
    expect(harness.getNotificationsFor("payses_fail_1")).toHaveLength(1)
  })

  it("skips when provider is not configured", async () => {
    delete process.env.MTS_EXOLVE_SENDER

    const harness = buildHarness({
      paymentSessionsById: {
        payses_provider_off: {
          id: "payses_provider_off",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_provider_off",
          data: {
            status: "canceled",
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      paymentSessionId: "payses_provider_off",
      paymentStatus: "canceled",
    })

    const result = response.result.result

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("provider_not_configured")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when resolved phone is invalid", async () => {
    const harness = buildHarness({
      paymentSessionsById: {
        payses_bad_phone: {
          id: "payses_bad_phone",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_bad_phone",
          data: {
            status: "canceled",
          },
        },
      },
      cartLinksByPaymentCollectionId: {
        paycol_bad_phone: {
          cart_id: "cart_bad_phone",
        },
      },
      cartsById: {
        cart_bad_phone: {
          id: "cart_bad_phone",
          shipping_address: {
            phone: "invalid",
          },
          billing_address: {
            phone: "",
          },
          customer: {
            phone: null,
          },
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      paymentSessionId: "payses_bad_phone",
      paymentStatus: "canceled",
      paymentSessionStatus: "canceled",
      source: "yookassa_webhook",
    })

    const result = response.result.result

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("missing_or_invalid_phone")
    expect(result.recipient).toBe("invalid")
    expect(result.recipient_normalized).toBeNull()
    expect(result.recipient_source).toBe("shipping_address.phone")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("suppresses duplicate processing for the same payment session id and sms recipient", async () => {
    const harness = buildHarness({
      paymentSessionsById: {
        payses_dup: {
          id: "payses_dup",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_dup",
          data: {
            status: "canceled",
          },
        },
      },
      cartLinksByPaymentCollectionId: {
        paycol_dup: {
          cart_id: "cart_dup",
        },
      },
      cartsById: {
        cart_dup: {
          id: "cart_dup",
          shipping_address: {
            phone: "+79123456789",
          },
        },
      },
    })

    const firstResponse = await runWorkflow(harness.container, {
      paymentSessionId: "payses_dup",
      paymentStatus: "canceled",
      paymentSessionStatus: "canceled",
      source: "yookassa_webhook",
    })
    const secondResponse = await runWorkflow(harness.container, {
      paymentSessionId: "payses_dup",
      paymentStatus: "canceled",
      paymentSessionStatus: "canceled",
      source: "yookassa_webhook",
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
