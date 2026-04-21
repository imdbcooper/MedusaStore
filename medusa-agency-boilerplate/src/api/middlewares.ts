import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"

import { AdminCreateDeliveryConnectionSchema } from "./admin/delivery/connections/route"
import { AdminUpdateDeliveryConnectionSchema } from "./admin/delivery/connections/[id]/route"
import { AdminDeliveryConnectionTestSchema } from "./admin/delivery/connections/[id]/test/route"
import { AdminDeliveryTestQuoteSchema } from "./admin/delivery/test-quote/route"
import { AdminNotificationSmokeSchema } from "./admin/notifications/smoke/route"
import { AdminSmsNotificationSmokeSchema } from "./admin/notifications/smoke/sms/route"
import { AdminVkNotificationSmokeSchema } from "./admin/notifications/smoke/vk/route"
import { StoreApiShipRatesSchema } from "./store/apiship/rates/route"
import { AdminCreateMarketingCampaignSchema, AdminUpdateCustomerMarketingPreferencesSchema } from "./admin/marketing/campaigns/route"
import { StoreCustomerMarketingPreferencesSchema } from "./store/customers/me/marketing-preferences/route"
import { StoreVkIdStartLinkSchema } from "./store/customers/me/vk-id/start/route"
import { StoreYooKassaPaymentStatusSchema } from "./store/payment/yookassa/route"
import { StoreYooKassaReturnSchema } from "./store/payment/yookassa/return/route"
import { StoreVkIdCallbackSchema } from "./store/vk-id/callback/route"

const adminAuth = authenticate("user", ["session", "bearer", "api-key"])

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/delivery/providers",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/connections",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/connections",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminCreateDeliveryConnectionSchema)],
    },
    {
      matcher: "/admin/delivery/connections/:id",
      methods: ["PUT"],
      middlewares: [adminAuth, validateAndTransformBody(AdminUpdateDeliveryConnectionSchema)],
    },
    {
      matcher: "/admin/delivery/connections/:id/test",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminDeliveryConnectionTestSchema)],
    },
    {
      matcher: "/admin/delivery/test-quote",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminDeliveryTestQuoteSchema)],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["GET"],
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
        validateAndTransformBody(AdminCreateMarketingCampaignSchema),
      ],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["PUT"],
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
        validateAndTransformBody(AdminUpdateCustomerMarketingPreferencesSchema),
      ],
    },
    {
      matcher: "/admin/marketing/campaigns/:id",
      methods: ["GET"],
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
    {
      matcher: "/admin/marketing/campaigns/:id",
      methods: ["POST"],
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
    {
      matcher: "/admin/notifications/smoke",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
        validateAndTransformBody(AdminNotificationSmokeSchema),
      ],
    },
    {
      matcher: "/admin/notifications/smoke/vk",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
        validateAndTransformBody(AdminVkNotificationSmokeSchema),
      ],
    },
    {
      matcher: "/admin/notifications/smoke/sms",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
        validateAndTransformBody(AdminSmsNotificationSmokeSchema),
      ],
    },
    {
      matcher: "/store/customers/me/marketing-preferences",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/marketing-preferences",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreCustomerMarketingPreferencesSchema),
      ],
    },
    {
      matcher: "/store/customers/me/vk-id",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/vk-id/start",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreVkIdStartLinkSchema),
      ],
    },
    {
      matcher: "/store/customers/me/vk-id/unlink",
      methods: ["POST"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/apiship/rates",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreApiShipRatesSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/payment/yookassa",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreYooKassaPaymentStatusSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/payment/yookassa/return",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreYooKassaReturnSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/vk-id/callback",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreVkIdCallbackSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/yookassa/return",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreYooKassaReturnSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/yookassa/webhook",
      methods: ["POST"],
      middlewares: [],
    },
  ],
})
