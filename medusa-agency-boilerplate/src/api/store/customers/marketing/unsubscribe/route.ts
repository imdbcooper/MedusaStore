import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import applyMarketingUnsubscribeWorkflow from "../../../../../workflows/apply-marketing-unsubscribe"
import {
  MARKETING_CHANNELS,
  sanitizeMarketingLogValue,
  type MarketingChannel,
} from "../../../../../modules/marketing-preferences"

/**
 * RFC 8058 compliance:
 * - Regular JSON POST from storefront preference UI carries
 *   { token, channels } — token may also be read from query string.
 * - Gmail/Yahoo "one-click" POST carries `application/x-www-form-urlencoded`
 *   body `List-Unsubscribe=One-Click` and token in the query string.
 * - Email-client prefetch scanners may hit the link with GET and the token
 *   in the query string — we honour that as well.
 *
 * The endpoint does NOT use `validateAndTransformBody` middleware because
 * Medusa's framework middleware wraps Zod objects in `.strict()` mode which
 * rejects the `List-Unsubscribe` key expected by RFC 8058 one-click senders
 * even when the schema declares `.passthrough()`. The schema is still exported
 * for consumers and tests, and the handler performs its own validation
 * (token length bounds, allowed channel allow-list) before calling into the
 * workflow. All failure reasons stay server-side only — the response is
 * always `{ ok: true }` to keep the endpoint enumeration-safe and One-Click
 * friendly.
 */
export const StoreMarketingUnsubscribeSchema = z.object({
  token: z.string().trim().min(1).max(512).optional(),
  channels: z
    .array(z.enum(MARKETING_CHANNELS))
    .min(1)
    .max(MARKETING_CHANNELS.length)
    .optional(),
})

export type StoreMarketingUnsubscribeRequestBody = z.infer<
  typeof StoreMarketingUnsubscribeSchema
>

function coerceChannels(value: unknown): MarketingChannel[] | null {
  if (Array.isArray(value)) {
    const allowed = new Set<MarketingChannel>()
    for (const candidate of value) {
      if (
        typeof candidate === "string" &&
        (MARKETING_CHANNELS as readonly string[]).includes(candidate.trim())
      ) {
        allowed.add(candidate.trim() as MarketingChannel)
      }
    }
    return allowed.size ? Array.from(allowed) : null
  }

  if (typeof value === "string" && value.trim().length) {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => (MARKETING_CHANNELS as readonly string[]).includes(part))
    if (parts.length) {
      return Array.from(new Set(parts)) as MarketingChannel[]
    }
  }

  return null
}

function resolveToken(req: MedusaRequest): string {
  const query = (req.query as Record<string, unknown> | undefined) || {}
  const queryToken = typeof query.token === "string" ? query.token : ""
  if (queryToken) {
    return queryToken
  }

  const validatedBody = (req.validatedBody || {}) as Partial<StoreMarketingUnsubscribeRequestBody>
  if (typeof validatedBody.token === "string" && validatedBody.token.length) {
    return validatedBody.token
  }

  const fallbackBody = (req.body as Record<string, unknown> | undefined) || {}
  return typeof fallbackBody.token === "string" ? fallbackBody.token : ""
}

function resolveChannels(req: MedusaRequest): MarketingChannel[] | null {
  const query = (req.query as Record<string, unknown> | undefined) || {}
  const fromQuery = coerceChannels(query.channels)
  if (fromQuery) {
    return fromQuery
  }

  const validatedBody = (req.validatedBody || {}) as Partial<StoreMarketingUnsubscribeRequestBody>
  const fromValidated = coerceChannels(validatedBody.channels)
  if (fromValidated) {
    return fromValidated
  }

  const fallbackBody = (req.body as Record<string, unknown> | undefined) || {}
  return coerceChannels(fallbackBody.channels)
}

function isOneClickBody(req: MedusaRequest): boolean {
  const rawContentType = req.headers?.["content-type"]
  const contentType = Array.isArray(rawContentType)
    ? rawContentType[0]
    : rawContentType
  if (
    typeof contentType === "string" &&
    contentType.toLowerCase().includes("application/x-www-form-urlencoded")
  ) {
    return true
  }

  const body = (req.body as Record<string, unknown> | undefined) || {}
  const marker = body["List-Unsubscribe"]
  if (typeof marker === "string" && marker.trim() === "One-Click") {
    return true
  }

  return false
}

async function handleUnsubscribe(
  req: MedusaRequest,
  res: MedusaResponse,
  source: "get" | "post" | "one-click"
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const token = resolveToken(req)
  const channels = resolveChannels(req)

  try {
    const { result } = await applyMarketingUnsubscribeWorkflow(req.scope).run({
      input: {
        token,
        channels,
      },
    })

    const outcome = result.result

    if (outcome.status === "applied") {
      logger.info(
        `[marketing-unsubscribe] applied source=${source} customer_id=${sanitizeMarketingLogValue(outcome.customer_id)} channels=${outcome.channels_applied.join(",")}`
      )
    } else {
      logger.info(
        `[marketing-unsubscribe] failed source=${source} reason=${outcome.reason} customer_id=${sanitizeMarketingLogValue(outcome.customer_id)}`
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_workflow_error"

    logger.error(
      `[marketing-unsubscribe] workflow error source=${source} message=${sanitizeMarketingLogValue(message)}`
    )
  }

  res.status(200).json({ ok: true })
}

/**
 * Unsubscribe endpoint. Always returns `{ ok: true }` even on token
 * validation failures to avoid user enumeration and to stay compatible
 * with RFC 8058 One-Click unsubscribe (which treats 2xx as success).
 * Failure reasons are sanitized and logged server-side only.
 */
export async function POST(
  req: MedusaRequest<StoreMarketingUnsubscribeRequestBody>,
  res: MedusaResponse
) {
  const source = isOneClickBody(req) ? "one-click" : "post"
  await handleUnsubscribe(req, res, source)
}

/**
 * RFC 8058 / bulk-sender direct `List-Unsubscribe` URL click support
 * and legacy email-client prefetch compatibility. Token and channels
 * are read from the query string.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  await handleUnsubscribe(req, res, "get")
}
