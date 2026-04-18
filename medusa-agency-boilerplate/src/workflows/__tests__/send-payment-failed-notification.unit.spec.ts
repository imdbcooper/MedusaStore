import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sendPaymentFailedNotificationWorkflow from "../send-payment-failed-notification"

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
  email: string | null
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

  const graphCalls: GraphCall[] = []
  const notificationsStore = new Map<string, NotificationRecord[]>()
  let notificationSequence = 0

  const query = {
    graph: jest.fn(async (args: GraphCall) => {
      graphCalls.push(args)

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
        provider_id: "local",
        status: "pending",
        created_at: new Date(Date.UTC(2026, 3, 18, 5, 0, notificationSequence))
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
    paymentSessionId: string
    paymentId?: string
    providerId?: string
    paymentStatus?: string
    paymentSessionStatus?: string
    source?: string
  }
) {
  return await sendPaymentFailedNotificationWorkflow(container).run({
    input,
  })
}

describe("sendPaymentFailedNotificationWorkflow runtime validation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sends once for a terminal failed payment attempt", async () => {
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
          email: " Customer@Example.com ",
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

    console.info("[payment-failed-validation] single-send", {
      result,
      graphCalls: harness.graphCalls,
      payload,
    })

    expect(result.status).toBe("sent")
    expect(result.reason).toBeNull()
    expect(result.payment_session_id).toBe("payses_fail_1")
    expect(result.cart_id).toBe("cart_1")
    expect(result.order_id).toBe("ord_1")
    expect(result.recipient).toBe("customer@example.com")
    expect(result.dedupe_key).toContain("resource_type=payment_session")
    expect(result.dedupe_key).toContain("resource_id=payses_fail_1")
    expect(payload.resource_type).toBe("payment_session")
    expect(payload.resource_id).toBe("payses_fail_1")
    expect(payload.to).toBe("customer@example.com")
    expect(harness.getNotificationsFor("payses_fail_1")).toHaveLength(1)
  })

  it("skips for non-terminal payment states", async () => {
    const harness = buildHarness({
      paymentSessionsById: {
        payses_pending: {
          id: "payses_pending",
          provider_id: "pp_yookassa_yookassa",
          status: "pending",
          payment_collection_id: "paycol_pending",
          data: {
            id: "yk_pending",
            status: "pending",
          },
        },
      },
      cartLinksByPaymentCollectionId: {
        paycol_pending: {
          cart_id: "cart_pending",
        },
      },
      cartsById: {
        cart_pending: {
          id: "cart_pending",
          email: "pending@example.com",
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      paymentSessionId: "payses_pending",
      paymentStatus: "pending",
      paymentSessionStatus: "pending",
      source: "yookassa_webhook",
    })

    const result = response.result.result

    console.info("[payment-failed-validation] non-terminal skip", {
      result,
      graphCalls: harness.graphCalls,
    })

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("non_terminal_payment_state")
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("skips when normalized recipient is absent", async () => {
    const harness = buildHarness({
      paymentSessionsById: {
        payses_no_email: {
          id: "payses_no_email",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_no_email",
          data: {
            id: "yk_no_email",
            status: "canceled",
          },
        },
      },
      cartLinksByPaymentCollectionId: {
        paycol_no_email: {
          cart_id: "cart_no_email",
        },
      },
      cartsById: {
        cart_no_email: {
          id: "cart_no_email",
          email: "   ",
        },
      },
    })

    const response = await runWorkflow(harness.container, {
      paymentSessionId: "payses_no_email",
      paymentStatus: "canceled",
      paymentSessionStatus: "canceled",
      source: "yookassa_webhook",
    })

    const result = response.result.result

    console.info("[payment-failed-validation] missing-recipient skip", {
      result,
      graphCalls: harness.graphCalls,
    })

    expect(result.status).toBe("skipped")
    expect(result.reason).toBe("missing_cart_email")
    expect(result.recipient).toBeNull()
    expect(result.recipient_normalized).toBeNull()
    expect(harness.notificationModuleService.createNotifications).not.toHaveBeenCalled()
  })

  it("suppresses duplicate processing for the same payment session id", async () => {
    const harness = buildHarness({
      paymentSessionsById: {
        payses_dup: {
          id: "payses_dup",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_dup",
          data: {
            id: "yk_dup",
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
          email: "dup@example.com",
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

    console.info("[payment-failed-validation] duplicate-suppression", {
      firstResult,
      secondResult,
      notifications: harness.getNotificationsFor("payses_dup"),
    })

    expect(firstResult.status).toBe("sent")
    expect(secondResult.status).toBe("skipped")
    expect(secondResult.reason).toBe("duplicate_notification")
    expect(secondResult.duplicate_of_notification_id).toBe(
      firstResult.notification?.id || null
    )
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(1)
    expect(harness.getNotificationsFor("payses_dup")).toHaveLength(1)
  })

  it("does not falsely dedupe two different failed attempts for the same cart", async () => {
    const harness = buildHarness({
      paymentSessionsById: {
        payses_a: {
          id: "payses_a",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_shared",
          data: {
            id: "yk_a",
            status: "canceled",
          },
        },
        payses_b: {
          id: "payses_b",
          provider_id: "pp_yookassa_yookassa",
          status: "canceled",
          payment_collection_id: "paycol_shared",
          data: {
            id: "yk_b",
            status: "canceled",
          },
        },
      },
      cartLinksByPaymentCollectionId: {
        paycol_shared: {
          cart_id: "cart_shared",
        },
      },
      cartsById: {
        cart_shared: {
          id: "cart_shared",
          email: "shared@example.com",
        },
      },
      orderLinksByCartId: {
        cart_shared: {
          id: "ord_shared",
        },
      },
    })

    const firstResponse = await runWorkflow(harness.container, {
      paymentSessionId: "payses_a",
      paymentStatus: "canceled",
      paymentSessionStatus: "canceled",
      source: "yookassa_webhook",
    })
    const secondResponse = await runWorkflow(harness.container, {
      paymentSessionId: "payses_b",
      paymentStatus: "canceled",
      paymentSessionStatus: "canceled",
      source: "yookassa_webhook",
    })

    const firstResult = firstResponse.result.result
    const secondResult = secondResponse.result.result

    console.info("[payment-failed-validation] no-false-cross-attempt-dedupe", {
      firstResult,
      secondResult,
      notificationsA: harness.getNotificationsFor("payses_a"),
      notificationsB: harness.getNotificationsFor("payses_b"),
    })

    expect(firstResult.status).toBe("sent")
    expect(secondResult.status).toBe("sent")
    expect(firstResult.dedupe_key).toContain("resource_id=payses_a")
    expect(secondResult.dedupe_key).toContain("resource_id=payses_b")
    expect(harness.notificationModuleService.createNotifications).toHaveBeenCalledTimes(2)
    expect(harness.getNotificationsFor("payses_a")).toHaveLength(1)
    expect(harness.getNotificationsFor("payses_b")).toHaveLength(1)
  })
})
