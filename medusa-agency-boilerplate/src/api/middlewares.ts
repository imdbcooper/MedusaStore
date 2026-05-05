import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  enforceApishipCheckoutReadinessForCartCompletion,
  enforceApishipCheckoutReadinessForPaymentSession,
} from "../modules/apiship-checkout-readiness"
import {
  enforceApishipDirectFulfillmentCancelExecutionGuard,
  enforceApishipDirectFulfillmentCreateExecutionGuard,
  enforceApishipOrderFulfillmentCancelExecutionGuard,
  enforceApishipOrderFulfillmentCreateExecutionGuard,
} from "../modules/apiship-shipment-execution-guard"
import { enforceDeliveryHubRuntimeQuarantine } from "../modules/delivery-hub-runtime-quarantine"

import { AdminCreateDeliveryConnectionSchema } from "./admin/delivery/connections/route"
import { AdminUpdateDeliveryConnectionSchema } from "./admin/delivery/connections/[id]/route"
import { AdminDeliveryConnectionTestSchema } from "./admin/delivery/connections/[id]/test/route"
import { AdminDeliveryEventLogsQuerySchema } from "./admin/delivery/logs/route"
import { AdminDeliveryPickupPointsQuerySchema } from "./admin/delivery/pickup-points/route"
import { AdminDeliveryPickupWindowsQuerySchema } from "./admin/delivery/pickup-windows/route"
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
      matcher: "/admin/fulfillments",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipDirectFulfillmentCreateExecutionGuard],
    },
    {
      matcher: "/admin/fulfillments/:id/cancel",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipDirectFulfillmentCancelExecutionGuard],
    },
    {
      matcher: "/admin/orders/:id/fulfillments",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipOrderFulfillmentCreateExecutionGuard],
    },
    {
      matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/cancel",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipOrderFulfillmentCancelExecutionGuard],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub",
      methods: ["GET"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments/:shipment_id/refresh",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments/:shipment_id/cancel",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments/:shipment_id/retry",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/delivery/shipments/:execution_reference/operations",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/shipments/:execution_reference/operations/refresh-status",
      methods: ["POST"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/shipments/:execution_reference/operations/cancel",
      methods: ["POST"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/delivery/shipments/:execution_reference/operations/retry",
      methods: ["POST"],
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
      matcher: "/admin/delivery/connections/:id",
      methods: ["DELETE"],
      middlewares: [adminAuth],
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
      matcher: "/admin/delivery/pickup-points",
      methods: ["GET"],
      middlewares: [
        adminAuth,
        validateAndTransformQuery(AdminDeliveryPickupPointsQuerySchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/admin/delivery/pickup-windows",
      methods: ["GET"],
      middlewares: [
        adminAuth,
        validateAndTransformQuery(AdminDeliveryPickupWindowsQuerySchema, {
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
      matcher: "/store/delivery/catalog",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/settings",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/cutover-preconditions",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/cutover-candidate",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/cutover-approval-template",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/quotes",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/quotes",
      methods: ["POST"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/pickup-points",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/pickup-windows",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/readiness",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["POST"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection/commit",
      methods: ["POST"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["DELETE"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/payment-collections/:id/payment-sessions",
      methods: ["POST"],
      middlewares: [enforceApishipCheckoutReadinessForPaymentSession],
    },
    {
      matcher: "/store/carts/:id/complete",
      methods: ["POST"],
      middlewares: [enforceApishipCheckoutReadinessForCartCompletion],
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
