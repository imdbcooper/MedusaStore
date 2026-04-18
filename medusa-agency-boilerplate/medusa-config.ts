import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import {
  getApiShipProviderOptionsFromEnv,
  isApiShipConfigured,
} from "./src/modules/apiship"
import {
  getNotificationEmailProviderDefinition,
  getNotificationEmailRuntime,
} from "./src/modules/notification-email"
import { isYooKassaConfigured } from "./src/modules/yookassa"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const notificationEmailRuntime = getNotificationEmailRuntime()
const emailNotificationProvider = getNotificationEmailProviderDefinition()

if (
  notificationEmailRuntime.requestedProviderId === "sendgrid" &&
  !notificationEmailRuntime.sendgridConfigured
) {
  console.warn(
    "[notifications] NOTIFICATION_EMAIL_PROVIDER=sendgrid requested without SENDGRID_API_KEY; falling back to local provider."
  )
}

const yookassaProviderOptions = {
  shopId: process.env.YOOKASSA_SHOP_ID?.trim() || "",
  secretKey: process.env.YOOKASSA_SECRET_KEY?.trim() || "",
  returnUrl: process.env.YOOKASSA_RETURN_URL?.trim() || "",
  webhookSecret: process.env.YOOKASSA_WEBHOOK_SECRET?.trim() || "",
}

const paymentProviders = isYooKassaConfigured(yookassaProviderOptions)
  ? [
      {
        resolve: "./src/modules/yookassa",
        id: "yookassa",
        options: yookassaProviderOptions,
      },
    ]
  : []

const apiShipProviderOptions = getApiShipProviderOptionsFromEnv()
const fulfillmentProviders = [
  {
    resolve: "@medusajs/medusa/fulfillment-manual",
    id: "manual",
  },
  ...(isApiShipConfigured(apiShipProviderOptions)
    ? [
        {
          resolve: "./src/modules/apiship",
          id: "apiship",
          options: apiShipProviderOptions,
        },
      ]
    : []),
]

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [emailNotificationProvider],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: paymentProviders,
      },
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: fulfillmentProviders,
      },
    },
  ],
})
