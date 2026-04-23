import { defineConfig, loadEnv } from "@medusajs/framework/utils"
import {
  getApiShipProviderOptionsFromEnv,
  isApiShipConfigured,
} from "./src/modules/apiship"
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
import { DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE } from "./src/modules/delivery-hub/provider-surface"
import {
  getDefaultFulfillmentContourContract,
  getLegacyApiShipDeprecationContract,
} from "./src/modules/fulfillment-contour-contract"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

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

const apiShipProviderOptions = getApiShipProviderOptionsFromEnv()
const defaultFulfillmentContour = getDefaultFulfillmentContourContract()
const legacyApiShipDeprecation = getLegacyApiShipDeprecationContract()

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
          options: {
            ...apiShipProviderOptions,
            deprecation: legacyApiShipDeprecation,
          },
        },
      ]
    : []),
  {
    resolve: "./src/modules/deliveryhub",
    id: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    options: {
      default_contour: defaultFulfillmentContour,
    },
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
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: fulfillmentProviders,
      },
    },
  ],
})
