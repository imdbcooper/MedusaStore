import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import {
  DEFAULT_LOCAL_MEDUSA_BACKEND_URL,
  DEFAULT_NOTIFICATION_SMOKE_MESSAGE,
  DEFAULT_NOTIFICATION_SMOKE_SUBJECT,
  getNotificationSmokeCurlCommand,
  getNotificationSmokeUrl,
} from "../modules/notification-email"

type SecretApiKeyRecord = {
  id: string
  title?: string | null
  token?: string | null
  revoked_at?: string | null
}

const DEFAULT_SECRET_API_KEY_TITLE = "Local Admin Smoke Secret Key"
const DEFAULT_OUTPUT_ENV_NAME = "ROOT_LOCAL_ADMIN_SECRET_API_KEY"

export default async function createSecretAdminApiKey({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const title =
    process.env.ADMIN_SECRET_API_KEY_TITLE?.trim() ||
    DEFAULT_SECRET_API_KEY_TITLE

  logger.info(`Ensuring secret admin API key: ${title}`)

  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "token", "revoked_at"],
    filters: {
      type: "secret",
    },
  })

  const existingApiKeys =
    ((data as SecretApiKeyRecord[] | undefined) || []).filter(
      (candidate) => candidate.title === title && !candidate.revoked_at
    )

  if (existingApiKeys.length > 0) {
    logger.warn(
      [
        `Found ${existingApiKeys.length} active secret admin API key(s) for \"${title}\".`,
        "Medusa only returns the raw secret token when the key is created, so existing keys can't be reused for authenticated smoke calls.",
        `Creating a fresh key instead. Existing ids: ${existingApiKeys
          .map((candidate) => candidate.id)
          .join(", ")}`,
      ].join(" ")
    )
  }

  const {
    result: [createdApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title,
          type: "secret",
          created_by: "",
        },
      ],
    },
  })

  const token = (createdApiKey as SecretApiKeyRecord | undefined)?.token

  if (!token) {
    throw new Error("Secret admin API key was created without a token.")
  }

  logger.info(`Created secret admin API key: ${createdApiKey.id}`)
  logSecretApiKeyUsage(logger, token)
}

function logSecretApiKeyUsage(
  logger: { info: (message: string) => void },
  token: string
) {
  const backendUrl =
    process.env.MEDUSA_BACKEND_URL?.trim() || DEFAULT_LOCAL_MEDUSA_BACKEND_URL
  const smokeTo =
    process.env.NOTIFICATION_SMOKE_TO?.trim() || "admin@example.com"
  const smokeSubject =
    process.env.NOTIFICATION_SMOKE_SUBJECT?.trim() ||
    DEFAULT_NOTIFICATION_SMOKE_SUBJECT
  const smokeMessage =
    process.env.NOTIFICATION_SMOKE_MESSAGE?.trim() ||
    DEFAULT_NOTIFICATION_SMOKE_MESSAGE

  const outputEnvName =
    process.env.ADMIN_SECRET_API_KEY_OUTPUT_ENV_NAME?.trim() ||
    DEFAULT_OUTPUT_ENV_NAME

  logger.info(`${outputEnvName}=${token}`)
  logger.info(
    `Smoke route URL: ${getNotificationSmokeUrl(backendUrl)}`
  )
  logger.info(
    "Use Authorization: Basic <base64(secret_api_key:)> when calling admin smoke routes."
  )
  logger.info(
    `Example curl for local smoke:\n${getNotificationSmokeCurlCommand({
      apiKey: token,
      backendUrl,
      to: smokeTo,
      subject: smokeSubject,
      message: smokeMessage,
    })}`
  )
}
