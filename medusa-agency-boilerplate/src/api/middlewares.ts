import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"

import { AdminUpdateApiShipSettingsSchema } from "./admin/apiship/settings/route"
import { AdminCreateDeliveryConnectionSchema } from "./admin/delivery/connections/route"
import { AdminUpdateDeliveryConnectionSchema } from "./admin/delivery/connections/[id]/route"
import { AdminDeliveryConnectionTestSchema } from "./admin/delivery/connections/[id]/test/route"
import { AdminDeliveryEventLogsQuerySchema } from "./admin/delivery/logs/route"
import { AdminDeliveryShippingOptionManualSyncSchema } from "./admin/delivery/shipping-options/sync/route"
import { AdminDeliveryTestQuoteSchema } from "./admin/delivery/test-quote/route"
import { AdminCreateDeliveryWarehouseSchema } from "./admin/delivery/warehouses/route"
import { AdminUpdateDeliveryWarehouseSchema } from "./admin/delivery/warehouses/[id]/route"
import {
  AdminCreateMarketingCampaignSchema,
  AdminUpdateCustomerMarketingPreferencesSchema,
} from "./admin/marketing/campaigns/route"
import { AdminNotificationSmokeSchema } from "./admin/notifications/smoke/route"
import { AdminSmsNotificationSmokeSchema } from "./admin/notifications/smoke/sms/route"
import { AdminVkNotificationSmokeSchema } from "./admin/notifications/smoke/vk/route"
import { StoreApiShipPointsSchema } from "./store/apiship/points/route"
import { StoreApiShipRatesSchema } from "./store/apiship/rates/route"
import { StoreCustomerMarketingPreferencesSchema } from "./store/customers/me/marketing-preferences/route"
import { StoreDeliveryCatalogQuerySchema } from "./store/delivery/catalog/route"
import { StoreDeliveryPickupPointsQuerySchema } from "./store/delivery/pickup-points/route"
import { StoreDeliveryPickupWindowsQuerySchema } from "./store/delivery/pickup-windows/route"
import { StoreDeliveryQuotesQuerySchema } from "./store/delivery/quotes/route"
import { StoreDeliverySelectionReadinessQuerySchema } from "./store/delivery/readiness/route"
import { StoreDeliverySettingsQuerySchema } from "./store/delivery/settings/route"
import {
  StoreDeliveryCartSelectionQuerySchema,
  StoreDeliveryDeleteCartSelectionBodySchema,
  StoreDeliveryUpsertCartSelectionBodySchema,
} from "./store/delivery/selection/route"
import { StoreVkIdStartLinkSchema } from "./store/customers/me/vk-id/start/route"
import { StoreYooKassaPaymentStatusSchema } from "./store/payment/yookassa/route"
import { StoreYooKassaReturnSchema } from "./store/payment/yookassa/return/route"
import { StoreVkIdCallbackSchema } from "./store/vk-id/callback/route"

const adminAuth = authenticate("user", ["session", "bearer", "api-key"])

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/apiship/settings",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/apiship/settings",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminUpdateApiShipSettingsSchema)],
    },
    {
      matcher: "/admin/delivery/providers",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/shipping-options/preview",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/fulfillment-bridge/preview",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/execution-plan/preview",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/shipping-options/sync",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminDeliveryShippingOptionManualSyncSchema)],
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
      matcher: "/admin/delivery/logs",
      methods: ["GET"],
      middlewares: [
        adminAuth,
        validateAndTransformQuery(AdminDeliveryEventLogsQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/admin/delivery/test-quote",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminDeliveryTestQuoteSchema)],
    },
    {
      matcher: "/admin/delivery/warehouses",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/warehouses",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminCreateDeliveryWarehouseSchema)],
    },
    {
      matcher: "/admin/delivery/warehouses/:id",
      methods: ["PUT"],
      middlewares: [adminAuth, validateAndTransformBody(AdminUpdateDeliveryWarehouseSchema)],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminCreateMarketingCampaignSchema)],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["PUT"],
      middlewares: [adminAuth, validateAndTransformBody(AdminUpdateCustomerMarketingPreferencesSchema)],
    },
    {
      matcher: "/admin/marketing/campaigns/:id",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/marketing/campaigns/:id",
      methods: ["POST"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/notifications/smoke",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminNotificationSmokeSchema)],
    },
    {
      matcher: "/admin/notifications/smoke/vk",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminVkNotificationSmokeSchema)],
    },
    {
      matcher: "/admin/notifications/smoke/sms",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminSmsNotificationSmokeSchema)],
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
      matcher: "/store/apiship/points",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreApiShipPointsSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/catalog",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreDeliveryCatalogQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/settings",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreDeliverySettingsQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/quotes",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreDeliveryQuotesQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/pickup-points",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreDeliveryPickupPointsQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/pickup-windows",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreDeliveryPickupWindowsQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreDeliveryCartSelectionQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/readiness",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreDeliverySelectionReadinessQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(StoreDeliveryUpsertCartSelectionBodySchema)],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["DELETE"],
      middlewares: [validateAndTransformBody(StoreDeliveryDeleteCartSelectionBodySchema)],
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
