import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { renderBrandedEmail } from "./email-template"
import { normalizeNotificationRecipient } from "./notification-email"

export const DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES = 1440
export const DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH = "/account/verify-email"
export const EMAIL_VERIFICATION_METADATA_KEY = "email_verification"
export const EMAIL_VERIFICATION_FLAG_METADATA_KEY = "email_verified"
export const EMAIL_VERIFICATION_AT_METADATA_KEY = "email_verified_at"
export const EMAIL_VERIFICATION_FOR_METADATA_KEY = "email_verified_for"
export const EMAIL_VERIFICATION_TRIGGER_TYPE =
  "customer.email_verification.requested"
export const EMAIL_VERIFICATION_TEMPLATE = "customer-email-verification-v1"
export const EMAIL_VERIFICATION_RESOURCE_TYPE = "customer"
export const EMAIL_VERIFICATION_DEFAULT_SUBJECT =
  "Подтверждение адреса электронной почты"

export const EMAIL_VERIFICATION_FAILURE_REASONS = [
  "invalid_token_format",
  "customer_not_found",
  "token_mismatch",
  "token_expired",
  "token_already_consumed",
  "email_mismatch",
] as const

export type EmailVerificationFailureReason =
  (typeof EMAIL_VERIFICATION_FAILURE_REASONS)[number]

export type EmailVerificationRuntime = {
  tokenTtlMinutes: number
  redirectPath: string
}

export type EmailVerificationState = {
  token_hash: string
  email: string
  expires_at: string
  created_at: string
  consumed_at: string | null
}

export type StoredEmailVerificationMetadata = {
  email_verified: boolean
  email_verified_at: string | null
  email_verified_for: string | null
  email_verification: EmailVerificationState | null
}

export type EmailVerificationCustomerLike = {
  id: string
  email?: string | null
  metadata?: unknown
}

export type TokenParseResult =
  | { ok: true; customerId: string; rawToken: string }
  | { ok: false; reason: "invalid_token_format" }

export type VerifyTokenResult =
  | {
      ok: true
      customerId: string
      email: string
      state: EmailVerificationState
      alreadyVerified: boolean
    }
  | {
      ok: false
      reason: EmailVerificationFailureReason
      customerId?: string
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

export function getEmailVerificationRuntime(): EmailVerificationRuntime {
  const tokenTtlMinutes = parsePositiveInteger(
    process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
    DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES
  )
  const redirectPath =
    process.env.EMAIL_VERIFICATION_REDIRECT_PATH?.trim() ||
    DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH

  return {
    tokenTtlMinutes,
    redirectPath,
  }
}

export function generateEmailVerificationRawToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error(
      "Email verification token byte length must be an integer >= 16"
    )
  }

  return base64UrlEncode(randomBytes(byteLength))
}

export function hashEmailVerificationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

export function buildEmailVerificationToken(
  customerId: string,
  rawToken: string
): string {
  const normalizedId = customerId.trim()

  if (!normalizedId) {
    throw new Error("Customer id is required to build a verification token")
  }

  if (!rawToken) {
    throw new Error("Raw token is required to build a verification token")
  }

  if (normalizedId.includes(".")) {
    throw new Error(
      "Customer id must not contain '.' character for verification token encoding"
    )
  }

  return `${normalizedId}.${rawToken}`
}

export function parseEmailVerificationToken(
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

export function readEmailVerificationMetadata(
  metadata?: unknown
): StoredEmailVerificationMetadata {
  const root = asRecord(metadata)
  const stored = asRecord(root[EMAIL_VERIFICATION_METADATA_KEY])
  const tokenHash = normalizeString(stored.token_hash)
  const email = normalizeNotificationRecipient(stored.email as string | null)
  const expiresAt = normalizeIsoDate(stored.expires_at)
  const createdAt = normalizeIsoDate(stored.created_at)
  const consumedAt = normalizeIsoDate(stored.consumed_at)

  let state: EmailVerificationState | null = null

  if (tokenHash && email && expiresAt && createdAt) {
    state = {
      token_hash: tokenHash,
      email,
      expires_at: expiresAt,
      created_at: createdAt,
      consumed_at: consumedAt,
    }
  }

  return {
    email_verified: root[EMAIL_VERIFICATION_FLAG_METADATA_KEY] === true,
    email_verified_at: normalizeIsoDate(
      root[EMAIL_VERIFICATION_AT_METADATA_KEY]
    ),
    email_verified_for: normalizeNotificationRecipient(
      root[EMAIL_VERIFICATION_FOR_METADATA_KEY] as string | null
    ),
    email_verification: state,
  }
}

export function buildEmailVerificationIssueMetadata(input: {
  currentMetadata?: unknown
  email: string
  tokenHash: string
  now?: Date
  ttlMinutes?: number
}): Record<string, unknown> {
  const normalizedEmail = normalizeNotificationRecipient(input.email)

  if (!normalizedEmail) {
    throw new Error(
      "Normalized email is required to build verification metadata"
    )
  }

  if (!input.tokenHash?.trim()) {
    throw new Error("Token hash is required to build verification metadata")
  }

  const ttlMinutes = parsePositiveInteger(
    input.ttlMinutes,
    DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES
  )
  const now = input.now ? new Date(input.now) : new Date()
  const nowIso = now.toISOString()
  const expiresAt = new Date(
    now.getTime() + ttlMinutes * 60 * 1000
  ).toISOString()
  const currentMetadata = asRecord(input.currentMetadata)

  const stored: EmailVerificationState = {
    token_hash: input.tokenHash.trim(),
    email: normalizedEmail,
    expires_at: expiresAt,
    created_at: nowIso,
    consumed_at: null,
  }

  return {
    ...currentMetadata,
    [EMAIL_VERIFICATION_FLAG_METADATA_KEY]:
      currentMetadata[EMAIL_VERIFICATION_FLAG_METADATA_KEY] === true &&
      currentMetadata[EMAIL_VERIFICATION_FOR_METADATA_KEY] === normalizedEmail,
    [EMAIL_VERIFICATION_AT_METADATA_KEY]:
      currentMetadata[EMAIL_VERIFICATION_FLAG_METADATA_KEY] === true &&
      currentMetadata[EMAIL_VERIFICATION_FOR_METADATA_KEY] === normalizedEmail
        ? currentMetadata[EMAIL_VERIFICATION_AT_METADATA_KEY] || null
        : null,
    [EMAIL_VERIFICATION_FOR_METADATA_KEY]:
      currentMetadata[EMAIL_VERIFICATION_FLAG_METADATA_KEY] === true &&
      currentMetadata[EMAIL_VERIFICATION_FOR_METADATA_KEY] === normalizedEmail
        ? currentMetadata[EMAIL_VERIFICATION_FOR_METADATA_KEY] || null
        : null,
    [EMAIL_VERIFICATION_METADATA_KEY]: stored,
  }
}

export function buildEmailVerificationConsumeMetadata(input: {
  currentMetadata?: unknown
  email: string
  consumedAt?: Date
}): Record<string, unknown> {
  const normalizedEmail = normalizeNotificationRecipient(input.email)

  if (!normalizedEmail) {
    throw new Error(
      "Normalized email is required to consume verification metadata"
    )
  }

  const currentMetadata = asRecord(input.currentMetadata)
  const current = readEmailVerificationMetadata(currentMetadata)
  const consumedAtIso = (input.consumedAt
    ? new Date(input.consumedAt)
    : new Date()
  ).toISOString()

  const state: EmailVerificationState | null = current.email_verification
    ? {
        ...current.email_verification,
        consumed_at: consumedAtIso,
      }
    : null

  return {
    ...currentMetadata,
    [EMAIL_VERIFICATION_FLAG_METADATA_KEY]: true,
    [EMAIL_VERIFICATION_AT_METADATA_KEY]: consumedAtIso,
    [EMAIL_VERIFICATION_FOR_METADATA_KEY]: normalizedEmail,
    [EMAIL_VERIFICATION_METADATA_KEY]: state,
  }
}

function secureHashEquals(left: string, right: string): boolean {
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

export function verifyEmailVerificationToken(input: {
  customer: EmailVerificationCustomerLike
  rawToken: string
  now?: Date
}): VerifyTokenResult {
  const { customer, rawToken } = input
  const normalizedCustomerEmail = normalizeNotificationRecipient(customer.email)
  const now = input.now ? new Date(input.now) : new Date()
  const stored = readEmailVerificationMetadata(customer.metadata)

  if (!stored.email_verification) {
    if (
      stored.email_verified &&
      stored.email_verified_for &&
      normalizedCustomerEmail &&
      stored.email_verified_for === normalizedCustomerEmail
    ) {
      return {
        ok: false,
        reason: "token_already_consumed",
        customerId: customer.id,
      }
    }

    return {
      ok: false,
      reason: "token_mismatch",
      customerId: customer.id,
    }
  }

  const state = stored.email_verification

  if (state.consumed_at) {
    return {
      ok: false,
      reason: "token_already_consumed",
      customerId: customer.id,
    }
  }

  const expiresAt = new Date(state.expires_at)

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: "token_expired",
      customerId: customer.id,
    }
  }

  const providedHash = hashEmailVerificationToken(rawToken)

  if (!secureHashEquals(providedHash, state.token_hash)) {
    return {
      ok: false,
      reason: "token_mismatch",
      customerId: customer.id,
    }
  }

  if (
    normalizedCustomerEmail &&
    state.email &&
    normalizedCustomerEmail !== state.email
  ) {
    return {
      ok: false,
      reason: "email_mismatch",
      customerId: customer.id,
    }
  }

  const alreadyVerified =
    stored.email_verified &&
    Boolean(normalizedCustomerEmail) &&
    stored.email_verified_for === normalizedCustomerEmail

  return {
    ok: true,
    customerId: customer.id,
    email: state.email,
    state,
    alreadyVerified,
  }
}

export function isCustomerEmailVerified(
  customer: EmailVerificationCustomerLike | null | undefined
): boolean {
  if (!customer) {
    return false
  }

  const stored = readEmailVerificationMetadata(customer.metadata)
  const normalizedEmail = normalizeNotificationRecipient(customer.email)

  if (!stored.email_verified) {
    return false
  }

  if (!stored.email_verified_for) {
    return false
  }

  if (!normalizedEmail) {
    return false
  }

  return stored.email_verified_for === normalizedEmail
}

export function buildEmailVerificationLink(input: {
  storefrontUrl: string
  countryCode?: string | null
  redirectPath?: string | null
  token: string
}): string {
  const base = (input.storefrontUrl || "").trim().replace(/\/+$/, "")

  if (!base) {
    throw new Error(
      "Storefront URL is required to build an email verification link"
    )
  }

  const redirectPath =
    (input.redirectPath?.trim() || DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH)
      .replace(/^\/+/, "/")
      .replace(/\/+$/g, "") || DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH
  const country = input.countryCode?.trim().toLowerCase() || ""
  const countrySegment = country ? `/${country}` : ""
  const normalizedRedirect = redirectPath.startsWith("/")
    ? redirectPath
    : `/${redirectPath}`

  const url = new URL(`${base}${countrySegment}${normalizedRedirect}`)
  url.searchParams.set("token", input.token)

  return url.toString()
}

function formatEmailVerificationTtlSuffix(ttlMinutes: number): string {
  const ttlHours = Math.round(ttlMinutes / 60)

  return ttlHours >= 1 ? `${ttlHours} ч.` : `${ttlMinutes} мин.`
}

type EmailVerificationRenderInput = {
  link: string
  ttlMinutes: number
  firstName?: string | null
}

function buildEmailVerificationTemplateInput(
  input: EmailVerificationRenderInput
): import("./email-template").EmailTemplateInput {
  const trimmedFirstName = input.firstName?.trim() || ""
  const greeting = trimmedFirstName
    ? `Здравствуйте, ${trimmedFirstName}!`
    : "Здравствуйте!"
  const ttlSuffix = formatEmailVerificationTtlSuffix(input.ttlMinutes)

  return {
    preheader:
      "Подтвердите адрес электронной почты, чтобы завершить регистрацию",
    heading: "Подтвердите email",
    intro: [
      greeting,
      "Подтвердите адрес электронной почты, чтобы завершить регистрацию.",
    ],
    action: {
      label: "Подтвердить email",
      url: input.link,
    },
    body: [
      `Ссылка действительна ${ttlSuffix}.`,
      "Если вы не регистрировались, просто проигнорируйте это письмо.",
    ],
  }
}

export function renderEmailVerificationPlainText(input: {
  link: string
  ttlMinutes: number
  firstName?: string | null
  fallbackSubject?: string | null
}): string {
  return renderBrandedEmail(buildEmailVerificationTemplateInput(input)).text
}

export function renderEmailVerificationHtml(input: {
  link: string
  ttlMinutes: number
  firstName?: string | null
}): string {
  return renderBrandedEmail(buildEmailVerificationTemplateInput(input)).html
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
