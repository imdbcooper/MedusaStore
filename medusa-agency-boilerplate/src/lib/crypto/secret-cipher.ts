/**
 * AES-256-GCM encryption utility for storing LLM provider API keys.
 *
 * Uses `node:crypto` exclusively — no external dependencies.
 * The encryption key is read from `ASSISTANT_SETTINGS_ENCRYPTION_KEY` env var
 * (base64-encoded, must decode to exactly 32 bytes).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncryptedSecret {
  /** AES-256-GCM ciphertext */
  ciphertext: Buffer
  /** 12-byte initialization vector */
  iv: Buffer
  /** 16-byte GCM authentication tag */
  tag: Buffer
  /** Last 4 characters of the plain secret (for display masking) */
  last4: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

const ENV_VAR_NAME = "ASSISTANT_SETTINGS_ENCRYPTION_KEY"

/** Known-weak key values (compared against the raw env string, lowercased) */
const BLACKLISTED_RAW_VALUES = ["change-me", "changeme", "test", "default"]

// ---------------------------------------------------------------------------
// Key cache
// ---------------------------------------------------------------------------

let cachedKey: Buffer | null = null

/**
 * Returns the 32-byte encryption key derived from the environment variable.
 * The result is cached after the first successful call.
 *
 * @throws {Error} if the key is missing, malformed, or weak.
 */
export function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey
  }

  const raw = process.env[ENV_VAR_NAME]

  if (!raw || raw.trim().length === 0) {
    throw new Error(
      `${ENV_VAR_NAME} is not set or empty. ` +
        `Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    )
  }

  const trimmed = raw.trim()

  // Blacklist check on raw string
  if (BLACKLISTED_RAW_VALUES.includes(trimmed.toLowerCase())) {
    throw new Error(
      `${ENV_VAR_NAME} contains a blacklisted placeholder value ("${trimmed}"). ` +
        `Please generate a real random key.`
    )
  }

  // Validate base64
  let decoded: Buffer
  try {
    decoded = Buffer.from(trimmed, "base64")
    // Verify round-trip to catch non-base64 strings
    if (decoded.toString("base64") !== trimmed) {
      throw new Error("round-trip mismatch")
    }
  } catch {
    throw new Error(
      `${ENV_VAR_NAME} is not valid base64. ` +
        `The value must be a base64-encoded 32-byte key.`
    )
  }

  // Length check
  if (decoded.length !== KEY_LENGTH) {
    throw new Error(
      `${ENV_VAR_NAME} must decode to exactly ${KEY_LENGTH} bytes, ` +
        `got ${decoded.length} bytes.`
    )
  }

  // Weak key check: all bytes identical
  const firstByte = decoded[0]
  if (decoded.every((b) => b === firstByte)) {
    throw new Error(
      `${ENV_VAR_NAME} is a weak key (all bytes identical). ` +
        `Please generate a cryptographically random key.`
    )
  }

  cachedKey = decoded
  return cachedKey
}

/**
 * Resets the cached encryption key. Intended for unit tests only.
 */
export function resetEncryptionKeyCacheForTests(): void {
  cachedKey = null
}

// ---------------------------------------------------------------------------
// Encryption / Decryption
// ---------------------------------------------------------------------------

/**
 * Encrypts a plain-text secret using AES-256-GCM.
 *
 * @param plain - The secret string to encrypt. Must be non-empty.
 * @returns An object containing ciphertext, iv, tag, and last4.
 * @throws {Error} if `plain` is empty or not a string.
 */
export function encryptSecret(plain: string): EncryptedSecret {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("plain must be a non-empty string")
  }

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  const last4 = computeLast4(plain)

  return { ciphertext: encrypted, iv, tag, last4 }
}

/**
 * Decrypts an AES-256-GCM encrypted secret.
 *
 * @param parts - Object with ciphertext, iv, and tag buffers.
 * @returns The decrypted plain-text string.
 * @throws {Error} "invalid ciphertext format" if iv/tag lengths are wrong.
 * @throws {Error} "decryption failed" if authentication fails (tampered data).
 */
export function decryptSecret(parts: {
  ciphertext: Buffer
  iv: Buffer
  tag: Buffer
}): string {
  if (!Buffer.isBuffer(parts.iv) || parts.iv.length !== IV_LENGTH) {
    throw new Error("invalid ciphertext format")
  }
  if (!Buffer.isBuffer(parts.tag) || parts.tag.length !== TAG_LENGTH) {
    throw new Error("invalid ciphertext format")
  }

  const key = getEncryptionKey()

  try {
    const decipher = createDecipheriv(ALGORITHM, key, parts.iv, {
      authTagLength: TAG_LENGTH,
    })
    decipher.setAuthTag(parts.tag)
    const decrypted = Buffer.concat([
      decipher.update(parts.ciphertext),
      decipher.final(),
    ])
    return decrypted.toString("utf8")
  } catch {
    throw new Error("decryption failed")
  }
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

/**
 * Produces a masked representation of a secret for display purposes.
 *
 * @param last4 - The last 4 characters of the original secret.
 * @param prefix - Optional prefix (defaults to `"sk-"`).
 * @returns A masked string like `"sk-***abcd"`.
 */
export function maskSecret(last4: string, prefix = "sk-"): string {
  return `${prefix}***${last4}`
}

// ---------------------------------------------------------------------------
// Configuration check
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the encryption key environment variable is set and valid.
 * Never throws — returns `false` on any error.
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeLast4(plain: string): string {
  if (plain.length >= 4) {
    return plain.slice(-4)
  }
  return plain.padStart(4, "*")
}
