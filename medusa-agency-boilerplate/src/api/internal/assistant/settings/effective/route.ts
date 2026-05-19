import { timingSafeEqual } from "node:crypto"
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  getEffectiveAssistantConfig,
} from "../../../../../modules/assistant-settings"
import { errorResponse } from "../../../../admin/assistant/settings/_helpers"

/**
 * `GET /internal/assistant/settings/effective`
 *
 * Server-to-server endpoint consumed by the Python assistant runtime. The
 * response carries the **decrypted** `api_key` for the active provider and
 * the entire fallback chain (see
 * [`getEffectiveAssistantConfig`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1272)).
 *
 * Why `/internal/...` and not `/admin/...`?
 * In this project every `/admin/*` matcher in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1)
 * explicitly attaches the `adminAuth` middleware (`authenticate("user",
 * ["session", "bearer", "api-key"])`). There is no precedent for an
 * `/admin/*` route that opts out of admin auth — and Medusa's middleware
 * stack does not provide a clean per-matcher "skip auth" hook. The brief
 * accepts `/internal/...` as a documented fallback when no such precedent
 * exists, so this endpoint lives outside the admin tree.
 *
 * Authentication: a shared static token compared in **constant time** via
 * `crypto.timingSafeEqual`. To avoid throwing on mismatched buffer lengths
 * (which leaks length information through exception timing), the length
 * check happens BEFORE the buffer comparison.
 *
 * SECURITY:
 *   - DO NOT publish through a CDN.
 *   - DO NOT call from a browser — the api_key is plain-text in the body.
 *   - DO NOT enable CORS for this route.
 *   - Set `AI_ASSISTANT_SERVER_TOKEN` to a long random string in env; an
 *     unset/empty token disables the endpoint (returns 503).
 */

const TOKEN_HEADER = "x-assistant-server-token"

function getServerToken(): string | null {
  const raw = process.env.AI_ASSISTANT_SERVER_TOKEN
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readPresentedToken(req: MedusaRequest): string {
  const headers = req.headers || {}
  const value = headers[TOKEN_HEADER]
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }
  return typeof value === "string" ? value : ""
}

/**
 * Constant-time string comparison via UTF-8 byte buffers. Strings of
 * different byte length short-circuit to `false` BEFORE invoking
 * `timingSafeEqual`, which throws on length mismatch — that throw would
 * otherwise translate to an early 500 and leak length info through timing.
 */
function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) {
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const expected = getServerToken()
  if (!expected) {
    res.status(503).json({
      error: "encryption_not_configured",
      message:
        "AI_ASSISTANT_SERVER_TOKEN is not configured; effective endpoint disabled",
    })
    return
  }

  const presented = readPresentedToken(req)
  if (!presented || !safeEquals(presented, expected)) {
    res.status(401).json({
      error: "unauthorized",
      message: "Invalid or missing server token",
    })
    return
  }

  try {
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const effective = await getEffectiveAssistantConfig(pg)
    res.status(200).json({ effective })
  } catch (err) {
    errorResponse(res, err)
  }
}
