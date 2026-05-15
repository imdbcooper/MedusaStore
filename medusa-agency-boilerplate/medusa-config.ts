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

/**
 * Phase 5.4: enforce explicit JWT/cookie secrets at startup.
 *
 * Previously these fell back to the literal string `"supersecret"` if the env
 * variable was missing. That is a known-value token baked into Medusa's
 * starter templates, and any instance running with it would accept tokens
 * signed by any attacker who knows the default. We now refuse to boot without
 * the env being set explicitly.
 *
 * Local dev picks the values up from `.env` (see `.env.example`); staging
 * and production read them from GitHub Secrets via
 * `scripts/github-deploy-staging.sh`.
 */
function requireSecret(name: "JWT_SECRET" | "COOKIE_SECRET"): string {
  const raw = process.env[name]
  const trimmed = typeof raw === "string" ? raw.trim() : ""

  if (!trimmed) {
    throw new Error(
      `[medusa-config] ${name} is required. Populate the env from GitHub Secrets (staging) or your local .env before starting the backend.`
    )
  }

  if (trimmed === "supersecret") {
    throw new Error(
      `[medusa-config] ${name}="supersecret" is a well-known default and is refused at startup. Generate a unique value (e.g. \`openssl rand -hex 48\`).`
    )
  }

  return trimmed
}

const jwtSecret = requireSecret("JWT_SECRET")
const cookieSecret = requireSecret("COOKIE_SECRET")

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
      jwtSecret,
      cookieSecret,
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_ADMIN_BACKEND_URL || "/",
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
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: process.env.S3_ACCESS_KEY_ID?.trim()
          ? [
              {
                resolve: "@medusajs/medusa/file-s3",
                id: "s3",
                options: {
                  file_url: process.env.S3_FILE_URL,
                  access_key_id: process.env.S3_ACCESS_KEY_ID,
                  secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                  region: process.env.S3_REGION,
                  bucket: process.env.S3_BUCKET,
                  endpoint: process.env.S3_ENDPOINT,
                  additional_client_config: {
                    forcePathStyle: true,
                  },
                },
              },
            ]
          : [
              {
                resolve: "@medusajs/medusa/file-local",
                id: "local",
                options: {
                  upload_dir: "static",
                  backend_url: `http://localhost:${process.env.MEDUSA_BACKEND_PORT || "9000"}`,
                },
              },
            ],
      },
    },
  ],
})
