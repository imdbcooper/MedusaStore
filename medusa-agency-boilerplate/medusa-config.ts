import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import {
  getNotificationEmailProviderDefinition,
  getNotificationEmailRuntime,
} from "./src/modules/notification-email"
import {
  getNotificationSmsProviderDefinition,
  getNotificationSmsRuntime,
} from "./src/modules/notification-sms"
import {
  getNotificationVkProviderDefinition,
  getNotificationVkRuntime,
} from "./src/modules/notification-vk"
import { getVkIdRuntime } from "./src/modules/vk-id"
import { isYooKassaConfigured } from "./src/modules/yookassa"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const APISHIP_FULFILLMENT_PROVIDER_CODE = "apiship"
const APISHIP_FULFILLMENT_PROVIDER_MODULE =
  "@gorgo/medusa-fulfillment-apiship/providers/fulfillment-apiship"
const APISHIP_SETTINGS_MODULE = "@gorgo/medusa-fulfillment-apiship/modules/apiship"

const notificationEmailRuntime = getNotificationEmailRuntime()
const emailNotificationProvider = getNotificationEmailProviderDefinition()
const notificationSmsRuntime = getNotificationSmsRuntime()
const smsNotificationProvider = getNotificationSmsProviderDefinition()
const notificationVkRuntime = getNotificationVkRuntime()
const vkNotificationProvider = getNotificationVkProviderDefinition()
const vkIdRuntime = getVkIdRuntime()

if (
  notificationEmailRuntime.requestedProviderId === "unisender" &&
  !notificationEmailRuntime.unisenderConfigured
) {
  console.warn(
    "[notifications] NOTIFICATION_EMAIL_PROVIDER=unisender requested without UNISENDER_API_KEY; falling back to local provider."
  )
}

if (
  notificationEmailRuntime.requestedProviderId === "smtp" &&
  !notificationEmailRuntime.smtpConfigured
) {
  console.warn(
    "[notifications] NOTIFICATION_EMAIL_PROVIDER=smtp requested without complete SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM settings; falling back to local provider."
  )
}

if (
  notificationSmsRuntime.requestedProviderId === "exolve" &&
  !notificationSmsRuntime.exolveConfigured
) {
  console.warn(
    "[notifications] NOTIFICATION_SMS_PROVIDER=exolve requested without MTS_EXOLVE_API_KEY and/or MTS_EXOLVE_SENDER; SMS provider remains disabled."
  )
}

if (
  notificationVkRuntime.requestedProviderId === "community" &&
  !notificationVkRuntime.communityConfigured
) {
  console.warn(
    "[notifications] NOTIFICATION_VK_PROVIDER=community requested without VK_COMMUNITY_ACCESS_TOKEN and/or VK_COMMUNITY_GROUP_ID; VK provider remains disabled."
  )
}

if (vkIdRuntime.requestedEnabled && !vkIdRuntime.configured) {
  console.warn(
    "[vk-id] VK_ID_ENABLED=true requested without VK_ID_CLIENT_ID and/or VK_ID_REDIRECT_URI; VK ID routes remain disabled."
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

const fulfillmentProviders = [
  {
    resolve: "@medusajs/medusa/fulfillment-manual",
    id: "manual",
  },
  {
    resolve: APISHIP_FULFILLMENT_PROVIDER_MODULE,
    id: APISHIP_FULFILLMENT_PROVIDER_CODE,
  },
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
  admin: {
    vite: () => ({
      server: {
        host: "0.0.0.0",
        allowedHosts: ["localhost", ".localhost", "127.0.0.1"],
        hmr: {
          port: 5173,
          clientPort: 5173,
        },
      },
    }),
  },
  modules: [
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          emailNotificationProvider,
          ...(smsNotificationProvider ? [smsNotificationProvider] : []),
          ...(vkNotificationProvider ? [vkNotificationProvider] : []),
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: paymentProviders,
      },
    },
    {
      resolve: APISHIP_SETTINGS_MODULE,
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: fulfillmentProviders,
      },
    },
  ],
})
