import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"

import { AdminNotificationSmokeSchema } from "./admin/notifications/smoke/route"
import { StoreApiShipRatesSchema } from "./store/apiship/rates/route"
import { StoreYooKassaPaymentStatusSchema } from "./store/payment/yookassa/route"
import { StoreYooKassaReturnSchema } from "./store/payment/yookassa/return/route"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/notifications/smoke",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
        validateAndTransformBody(AdminNotificationSmokeSchema),
      ],
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
