import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { renderBrandedEmail } from "./email-template"
import { normalizeNotificationRecipient } from "./notification-email"

export const DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES = 60
export const DEFAULT_PASSWORD_RESET_REDIRECT_PATH = "/account/reset-password"
export const PASSWORD_RESET_METADATA_KEY = "password_reset"
export const PASSWORD_RESET_TRIGGER_TYPE =
  "customer.password_reset.requested"
export const PASSWORD_RESET_TEMPLATE = "customer-password-reset-v1"
export const PASSWORD_RESET_RESOURCE_TYPE = "customer"
export const PASSWORD_RESET_DEFAULT_SUBJECT =
  "Восстановление пароля"

export const DEFAULT_PASSWORD_MIN_LENGTH = 8
export const ABSOLUTE_PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const PASSWORD_RESET_FAILURE_REASONS = [
  "invalid_token_format",
  "customer_not_found",
  "token_mismatch",
  "token_expired",
  "token_already_consumed",
  "email_mismatch",
] as const

export type PasswordResetFailureReason =
  (typeof PASSWORD_RESET_FAILURE_REASONS)[number]

export const PASSWORD_STRENGTH_FAILURE_REASONS = [
  "password_too_short",
  "password_too_long",
  "password_missing_letter",
  "password_missing_digit",
] as const

export type PasswordStrengthFailureReason =
  (typeof PASSWORD_STRENGTH_FAILURE_REASONS)[number]

export type PasswordResetRuntime = {
  tokenTtlMinutes: number
  redirectPath: string
  passwordMinLength: number
  passwordRequireLetter: boolean
  passwordRequireDigit: boolean
}

export type PasswordResetState = {
  token_hash: string
  email: string
  issued_at: string
  expires_at: string
  consumed_at: string | null
}

export type StoredPasswordResetMetadata = {
  password_reset: PasswordResetState | null
}

export type PasswordResetCustomerLike = {
  id: string
  email?: string | null
  metadata?: unknown
}

export type TokenParseResult =
  | { ok: true; customerId: string; rawToken: string }
  | { ok: false; reason: "invalid_token_format" }

export type VerifyPasswordResetTokenResult =
  | {
      ok: true
      customerId: string
      email: string
      state: PasswordResetState
    }
  | {
      ok: false
      reason: PasswordResetFailureReason
      customerId?: string
    }

export type PasswordStrengthResult =
  | { ok: true }
  | { ok: false; reason: PasswordStrengthFailureReason }

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

function parseBooleanFlag(value: unknown, defaultValue: boolean) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value !== "string") {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false
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

export function getPasswordResetRuntime(): PasswordResetRuntime {
  const tokenTtlMinutes = parsePositiveInteger(
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES,
    DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES
  )
  const redirectPath =
    process.env.PASSWORD_RESET_REDIRECT_PATH?.trim() ||
    DEFAULT_PASSWORD_RESET_REDIRECT_PATH
  const passwordMinLengthRaw = parsePositiveInteger(
    process.env.PASSWORD_MIN_LENGTH,
    DEFAULT_PASSWORD_MIN_LENGTH
  )
  const passwordMinLength = Math.max(
    ABSOLUTE_PASSWORD_MIN_LENGTH,
    passwordMinLengthRaw
  )
  const passwordRequireLetter = parseBooleanFlag(
    process.env.PASSWORD_REQUIRE_LETTER,
    true
  )
  const passwordRequireDigit = parseBooleanFlag(
    process.env.PASSWORD_REQUIRE_DIGIT,
    true
  )

  return {
    tokenTtlMinutes,
    redirectPath,
    passwordMinLength,
    passwordRequireLetter,
    passwordRequireDigit,
  }
}

export function generatePasswordResetRawToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error(
      "Password reset token byte length must be an integer >= 16"
    )
  }

  return base64UrlEncode(randomBytes(byteLength))
}

export function hashPasswordResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

export function buildPasswordResetToken(
  customerId: string,
  rawToken: string
): string {
  const normalizedId = customerId.trim()

  if (!normalizedId) {
    throw new Error("Customer id is required to build a password reset token")
  }

  if (!rawToken) {
    throw new Error("Raw token is required to build a password reset token")
  }

  if (normalizedId.includes(".")) {
    throw new Error(
      "Customer id must not contain '.' character for password reset token encoding"
    )
  }

  return `${normalizedId}.${rawToken}`
}

export function parsePasswordResetToken(
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

export function readPasswordResetMetadata(
  metadata?: unknown
): StoredPasswordResetMetadata {
  const root = asRecord(metadata)
  const stored = asRecord(root[PASSWORD_RESET_METADATA_KEY])
  const tokenHash = normalizeString(stored.token_hash)
  const email = normalizeNotificationRecipient(stored.email as string | null)
  const expiresAt = normalizeIsoDate(stored.expires_at)
  const issuedAt = normalizeIsoDate(stored.issued_at)
  const consumedAt = normalizeIsoDate(stored.consumed_at)

  let state: PasswordResetState | null = null

  if (tokenHash && email && expiresAt && issuedAt) {
    state = {
      token_hash: tokenHash,
      email,
      issued_at: issuedAt,
      expires_at: expiresAt,
      consumed_at: consumedAt,
    }
  }

  return {
    password_reset: state,
  }
}

export function buildPasswordResetIssueMetadata(input: {
  currentMetadata?: unknown
  email: string
  tokenHash: string
  now?: Date
  ttlMinutes?: number
}): Record<string, unknown> {
  const normalizedEmail = normalizeNotificationRecipient(input.email)

  if (!normalizedEmail) {
    throw new Error(
      "Normalized email is required to build password reset metadata"
    )
  }

  if (!input.tokenHash?.trim()) {
    throw new Error("Token hash is required to build password reset metadata")
  }

  const ttlMinutes = parsePositiveInteger(
    input.ttlMinutes,
    DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES
  )
  const now = input.now ? new Date(input.now) : new Date()
  const nowIso = now.toISOString()
  const expiresAt = new Date(
    now.getTime() + ttlMinutes * 60 * 1000
  ).toISOString()
  const currentMetadata = asRecord(input.currentMetadata)

  const stored: PasswordResetState = {
    token_hash: input.tokenHash.trim(),
    email: normalizedEmail,
    issued_at: nowIso,
    expires_at: expiresAt,
    consumed_at: null,
  }

  return {
    ...currentMetadata,
    [PASSWORD_RESET_METADATA_KEY]: stored,
  }
}

export function buildPasswordResetConsumeMetadata(input: {
  currentMetadata?: unknown
  consumedAt?: Date
}): Record<string, unknown> {
  const currentMetadata = asRecord(input.currentMetadata)
  const current = readPasswordResetMetadata(currentMetadata)
  const consumedAtIso = (input.consumedAt
    ? new Date(input.consumedAt)
    : new Date()
  ).toISOString()

  const state: PasswordResetState | null = current.password_reset
    ? {
        ...current.password_reset,
        consumed_at: consumedAtIso,
      }
    : null

  return {
    ...currentMetadata,
    [PASSWORD_RESET_METADATA_KEY]: state,
  }
}

export function buildPasswordResetClearedMetadata(input: {
  currentMetadata?: unknown
}): Record<string, unknown> {
  const currentMetadata = asRecord(input.currentMetadata)

  return {
    ...currentMetadata,
    [PASSWORD_RESET_METADATA_KEY]: null,
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

export function verifyPasswordResetToken(input: {
  customer: PasswordResetCustomerLike
  rawToken: string
  now?: Date
}): VerifyPasswordResetTokenResult {
  const { customer, rawToken } = input
  const normalizedCustomerEmail = normalizeNotificationRecipient(customer.email)
  const now = input.now ? new Date(input.now) : new Date()
  const stored = readPasswordResetMetadata(customer.metadata)

  if (!stored.password_reset) {
    return {
      ok: false,
      reason: "token_mismatch",
      customerId: customer.id,
    }
  }

  const state = stored.password_reset

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

  const providedHash = hashPasswordResetToken(rawToken)

  if (!secureHashEquals(providedHash, state.token_hash)) {
    return {
      ok: false,
      reason: "token_mismatch",
      customerId: customer.id,
    }
  }

  if (
    !normalizedCustomerEmail ||
    !state.email ||
    normalizedCustomerEmail !== state.email
  ) {
    return {
      ok: false,
      reason: "email_mismatch",
      customerId: customer.id,
    }
  }

  return {
    ok: true,
    customerId: customer.id,
    email: state.email,
    state,
  }
}

export function validatePasswordStrength(
  password: string,
  runtime: Pick<
    PasswordResetRuntime,
    "passwordMinLength" | "passwordRequireLetter" | "passwordRequireDigit"
  > = getPasswordResetRuntime()
): PasswordStrengthResult {
  if (typeof password !== "string") {
    return { ok: false, reason: "password_too_short" }
  }

  if (password.length < runtime.passwordMinLength) {
    return { ok: false, reason: "password_too_short" }
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, reason: "password_too_long" }
  }

  if (runtime.passwordRequireLetter && !/[A-Za-zА-Яа-яЁё]/.test(password)) {
    return { ok: false, reason: "password_missing_letter" }
  }

  if (runtime.passwordRequireDigit && !/\d/.test(password)) {
    return { ok: false, reason: "password_missing_digit" }
  }

  return { ok: true }
}

export function buildPasswordResetLink(input: {
  storefrontUrl: string
  countryCode?: string | null
  redirectPath?: string | null
  token: string
}): string {
  const base = (input.storefrontUrl || "").trim().replace(/\/+$/, "")

  if (!base) {
    throw new Error(
      "Storefront URL is required to build a password reset link"
    )
  }

  const redirectPath =
    (input.redirectPath?.trim() || DEFAULT_PASSWORD_RESET_REDIRECT_PATH)
      .replace(/^\/+/, "/")
      .replace(/\/+$/g, "") || DEFAULT_PASSWORD_RESET_REDIRECT_PATH
  const country = input.countryCode?.trim().toLowerCase() || ""
  const countrySegment = country ? `/${country}` : ""
  const normalizedRedirect = redirectPath.startsWith("/")
    ? redirectPath
    : `/${redirectPath}`

  const url = new URL(`${base}${countrySegment}${normalizedRedirect}`)
  url.searchParams.set("token", input.token)

  return url.toString()
}

type PasswordResetRenderInput = {
  link: string
  ttlMinutes: number
  firstName?: string | null
}

function buildPasswordResetTemplateInput(
  input: PasswordResetRenderInput
): import("./email-template").EmailTemplateInput {
  const ttlSuffix = formatTtlSuffix(input.ttlMinutes)
  const trimmedFirstName = input.firstName?.trim() || ""
  const greeting = trimmedFirstName
    ? `Здравствуйте, ${trimmedFirstName}!`
    : "Здравствуйте!"

  return {
    preheader: `Восстановление пароля — ссылка действительна ${ttlSuffix}`,
    heading: "Восстановление пароля",
    intro: [
      greeting,
      "Мы получили запрос на восстановление пароля для вашей учётной записи.",
    ],
    action: {
      label: "Создать новый пароль",
      url: input.link,
    },
    body: [
      `Ссылка действительна ${ttlSuffix}.`,
      "Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо — пароль не будет изменён.",
    ],
  }
}

export function renderPasswordResetPlainText(input: {
  link: string
  ttlMinutes: number
  firstName?: string | null
}): string {
  return renderBrandedEmail(buildPasswordResetTemplateInput(input)).text
}

export function renderPasswordResetHtml(input: {
  link: string
  ttlMinutes: number
  firstName?: string | null
}): string {
  return renderBrandedEmail(buildPasswordResetTemplateInput(input)).html
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

function formatTtlSuffix(ttlMinutes: number): string {
  if (ttlMinutes >= 60) {
    const hours = Math.round(ttlMinutes / 60)
    return hours === 1 ? "1 час" : `${hours} ч.`
  }

  return `${ttlMinutes} мин.`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
