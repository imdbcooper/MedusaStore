import { createHash, randomBytes, timingSafeEqual } from "crypto"
import type { MarketingChannel } from "./marketing-preferences"

export const DEFAULT_MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS = 365
export const DEFAULT_MARKETING_UNSUBSCRIBE_REDIRECT_PATH = "/unsubscribe"
export const MARKETING_UNSUBSCRIBE_METADATA_KEY = "marketing_unsubscribe"

export const MARKETING_UNSUBSCRIBE_FAILURE_REASONS = [
  "invalid_token_format",
  "customer_not_found",
  "token_mismatch",
  "token_expired",
  "token_already_consumed",
  "token_missing",
] as const

export type MarketingUnsubscribeFailureReason =
  (typeof MARKETING_UNSUBSCRIBE_FAILURE_REASONS)[number]

export type MarketingUnsubscribeRuntime = {
  tokenTtlDays: number
  redirectPath: string
}

export type MarketingUnsubscribeState = {
  token_hash: string
  issued_at: string
  expires_at: string | null
  consumed_at: string | null
}

export type StoredMarketingUnsubscribeMetadata = {
  marketing_unsubscribe: MarketingUnsubscribeState | null
}

export type MarketingUnsubscribeCustomerLike = {
  id: string
  metadata?: unknown
}

export type TokenParseResult =
  | { ok: true; customerId: string; rawToken: string }
  | { ok: false; reason: "invalid_token_format" }

export type VerifyUnsubscribeTokenResult =
  | {
      ok: true
      customerId: string
      state: MarketingUnsubscribeState
    }
  | {
      ok: false
      reason: MarketingUnsubscribeFailureReason
      customerId?: string
    }

export type BuildUnsubscribeUrlInput = {
  storefrontUrl: string
  countryCode?: string | null
  redirectPath?: string | null
  token: string
  channels?: MarketingChannel[] | null
  listId?: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function parsePositiveInteger(value: unknown, defaultValue: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())

    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed)
    }
  }

  return defaultValue
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

function base64UrlEncode(value: Buffer): string {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export function getMarketingUnsubscribeRuntime(): MarketingUnsubscribeRuntime {
  const tokenTtlDays = parsePositiveInteger(
    process.env.MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS,
    DEFAULT_MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS
  )
  const redirectPath =
    process.env.MARKETING_UNSUBSCRIBE_REDIRECT_PATH?.trim() ||
    DEFAULT_MARKETING_UNSUBSCRIBE_REDIRECT_PATH

  return {
    tokenTtlDays,
    redirectPath,
  }
}

export function generateUnsubscribeToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error(
      "Unsubscribe token byte length must be an integer >= 16"
    )
  }

  return base64UrlEncode(randomBytes(byteLength))
}

export function hashUnsubscribeToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

export function buildPublicUnsubscribeToken(
  customerId: string,
  rawToken: string
): string {
  const normalizedId = customerId.trim()

  if (!normalizedId) {
    throw new Error("Customer id is required to build an unsubscribe token")
  }

  if (!rawToken) {
    throw new Error("Raw token is required to build an unsubscribe token")
  }

  if (normalizedId.includes(".")) {
    throw new Error(
      "Customer id must not contain '.' character for unsubscribe token encoding"
    )
  }

  return `${normalizedId}.${rawToken}`
}

export function parsePublicUnsubscribeToken(
  token: string | null | undefined
): TokenParseResult {
  if (typeof token !== "string") {
    return { ok: false, reason: "invalid_token_format" }
  }

  const trimmed = token.trim()

  if (!trimmed) {
    return { ok: false, reason: "invalid_token_format" }
  }

  const separatorIndex = trimmed.indexOf(".")

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return { ok: false, reason: "invalid_token_format" }
  }

  const customerId = trimmed.slice(0, separatorIndex)
  const rawToken = trimmed.slice(separatorIndex + 1)

  if (!customerId || !rawToken) {
    return { ok: false, reason: "invalid_token_format" }
  }

  return { ok: true, customerId, rawToken }
}

export function readMarketingUnsubscribeMetadata(
  metadata?: unknown
): StoredMarketingUnsubscribeMetadata {
  const root = asRecord(metadata)
  const stored = asRecord(root[MARKETING_UNSUBSCRIBE_METADATA_KEY])
  const tokenHash = normalizeString(stored.token_hash)
  const issuedAt = normalizeIsoDate(stored.issued_at)
  const expiresAt = normalizeIsoDate(stored.expires_at)
  const consumedAt = normalizeIsoDate(stored.consumed_at)

  let state: MarketingUnsubscribeState | null = null

  if (tokenHash && issuedAt) {
    state = {
      token_hash: tokenHash,
      issued_at: issuedAt,
      expires_at: expiresAt,
      consumed_at: consumedAt,
    }
  }

  return {
    marketing_unsubscribe: state,
  }
}

export function buildUnsubscribeIssueMetadata(input: {
  currentMetadata?: unknown
  tokenHash: string
  now?: Date
  ttlDays?: number
}): Record<string, unknown> {
  if (!input.tokenHash?.trim()) {
    throw new Error(
      "Token hash is required to build marketing unsubscribe metadata"
    )
  }

  const ttlDays = parsePositiveInteger(
    input.ttlDays,
    DEFAULT_MARKETING_UNSUBSCRIBE_TOKEN_TTL_DAYS
  )
  const now = input.now ? new Date(input.now) : new Date()
  const nowIso = now.toISOString()
  const expiresAt = new Date(
    now.getTime() + ttlDays * 24 * 60 * 60 * 1000
  ).toISOString()
  const currentMetadata = asRecord(input.currentMetadata)

  const stored: MarketingUnsubscribeState = {
    token_hash: input.tokenHash.trim(),
    issued_at: nowIso,
    expires_at: expiresAt,
    consumed_at: null,
  }

  return {
    ...currentMetadata,
    [MARKETING_UNSUBSCRIBE_METADATA_KEY]: stored,
  }
}

export function buildUnsubscribeConsumeMetadata(input: {
  currentMetadata?: unknown
  consumedAt?: Date
}): Record<string, unknown> {
  const currentMetadata = asRecord(input.currentMetadata)
  const current = readMarketingUnsubscribeMetadata(currentMetadata)
  const consumedAtIso = (input.consumedAt
    ? new Date(input.consumedAt)
    : new Date()
  ).toISOString()

  const state: MarketingUnsubscribeState | null = current.marketing_unsubscribe
    ? {
        ...current.marketing_unsubscribe,
        consumed_at: consumedAtIso,
      }
    : null

  return {
    ...currentMetadata,
    [MARKETING_UNSUBSCRIBE_METADATA_KEY]: state,
  }
}

export function buildUnsubscribeClearedMetadata(input: {
  currentMetadata?: unknown
}): Record<string, unknown> {
  const currentMetadata = asRecord(input.currentMetadata)

  return {
    ...currentMetadata,
    [MARKETING_UNSUBSCRIBE_METADATA_KEY]: null,
  }
}

export function secureHashEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false
  }

  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  try {
    return timingSafeEqual(leftBuffer, rightBuffer)
  } catch {
    return false
  }
}

export function verifyUnsubscribeToken(input: {
  customer: MarketingUnsubscribeCustomerLike
  rawToken: string
  now?: Date
}): VerifyUnsubscribeTokenResult {
  const { customer, rawToken } = input
  const now = input.now ? new Date(input.now) : new Date()
  const stored = readMarketingUnsubscribeMetadata(customer.metadata)

  if (!stored.marketing_unsubscribe) {
    return {
      ok: false,
      reason: "token_mismatch",
      customerId: customer.id,
    }
  }

  const state = stored.marketing_unsubscribe

  if (state.consumed_at) {
    return {
      ok: false,
      reason: "token_already_consumed",
      customerId: customer.id,
    }
  }

  if (state.expires_at) {
    const expiresAt = new Date(state.expires_at)

    if (
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() <= now.getTime()
    ) {
      return {
        ok: false,
        reason: "token_expired",
        customerId: customer.id,
      }
    }
  }

  const providedHash = hashUnsubscribeToken(rawToken)

  if (!secureHashEquals(providedHash, state.token_hash)) {
    return {
      ok: false,
      reason: "token_mismatch",
      customerId: customer.id,
    }
  }

  return {
    ok: true,
    customerId: customer.id,
    state,
  }
}

export function buildUnsubscribeUrl(input: BuildUnsubscribeUrlInput): string {
  const base = (input.storefrontUrl || "").trim().replace(/\/+$/, "")

  if (!base) {
    throw new Error(
      "Storefront URL is required to build a marketing unsubscribe link"
    )
  }

  const redirectPath =
    (input.redirectPath?.trim() || DEFAULT_MARKETING_UNSUBSCRIBE_REDIRECT_PATH)
      .replace(/^\/+/, "/")
      .replace(/\/+$/g, "") || DEFAULT_MARKETING_UNSUBSCRIBE_REDIRECT_PATH
  const country = input.countryCode?.trim().toLowerCase() || ""
  const countrySegment = country ? `/${country}` : ""
  const normalizedRedirect = redirectPath.startsWith("/")
    ? redirectPath
    : `/${redirectPath}`

  const url = new URL(`${base}${countrySegment}${normalizedRedirect}`)
  url.searchParams.set("token", input.token)

  if (Array.isArray(input.channels) && input.channels.length) {
    url.searchParams.set(
      "channels",
      Array.from(new Set(input.channels.map((channel) => channel.trim())))
        .filter(Boolean)
        .join(",")
    )
  }

  if (input.listId?.trim()) {
    url.searchParams.set("list_id", input.listId.trim())
  }

  return url.toString()
}

export function sanitizeLogValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "n/a"
  }

  const normalized = String(value).trim()

  if (!normalized) {
    return "n/a"
  }

  return normalized.replace(/[\r\n]+/g, " ").slice(0, 120)
}
