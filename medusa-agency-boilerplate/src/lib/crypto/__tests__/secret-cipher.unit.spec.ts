/**
 * Unit tests for the AES-256-GCM secret cipher utility.
 *
 * @see {@link medusa-agency-boilerplate/src/lib/crypto/secret-cipher.ts}
 */

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals"
import { randomBytes } from "node:crypto"

import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  isEncryptionConfigured,
  getEncryptionKey,
  resetEncryptionKeyCacheForTests,
} from "../secret-cipher"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validKey(): string {
  return randomBytes(32).toString("base64")
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let originalEnv: string | undefined

beforeEach(() => {
  originalEnv = process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY
  resetEncryptionKeyCacheForTests()
})

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY
  } else {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = originalEnv
  }
  resetEncryptionKeyCacheForTests()
})

// ---------------------------------------------------------------------------
// getEncryptionKey
// ---------------------------------------------------------------------------

describe("getEncryptionKey", () => {
  it("throws when ENV is not set", () => {
    delete process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY
    expect(() => getEncryptionKey()).toThrow("not set or empty")
  })

  it("throws when ENV is empty string", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = ""
    expect(() => getEncryptionKey()).toThrow("not set or empty")
  })

  it("throws when ENV is whitespace only", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = "   "
    expect(() => getEncryptionKey()).toThrow("not set or empty")
  })

  it("throws when ENV is not valid base64", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = "not-valid-base64!!!"
    expect(() => getEncryptionKey()).toThrow("not valid base64")
  })

  it("throws when decoded length is less than 32 bytes (16 bytes)", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = randomBytes(16).toString("base64")
    expect(() => getEncryptionKey()).toThrow("exactly 32 bytes")
  })

  it("throws when decoded length is more than 32 bytes (64 bytes)", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = randomBytes(64).toString("base64")
    expect(() => getEncryptionKey()).toThrow("exactly 32 bytes")
  })

  it("throws when key is all zeros (weak key)", () => {
    const zeroKey = Buffer.alloc(32, 0).toString("base64")
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = zeroKey
    expect(() => getEncryptionKey()).toThrow("weak key")
  })

  it("throws when key is all 0xFF (weak key)", () => {
    const ffKey = Buffer.alloc(32, 0xff).toString("base64")
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = ffKey
    expect(() => getEncryptionKey()).toThrow("weak key")
  })

  it.each(["change-me", "changeme", "test", "default"])(
    "throws for blacklisted value: %s",
    (blacklisted) => {
      process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = blacklisted
      expect(() => getEncryptionKey()).toThrow("blacklisted")
    }
  )

  it("succeeds with a valid random key", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = validKey()
    const key = getEncryptionKey()
    expect(Buffer.isBuffer(key)).toBe(true)
    expect(key.length).toBe(32)
  })

  it("caches the key after first successful call", () => {
    const key1Str = validKey()
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = key1Str
    const result1 = getEncryptionKey()

    // Change ENV — should still return cached value
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = validKey()
    const result2 = getEncryptionKey()

    expect(result1).toBe(result2) // same reference
  })

  it("re-reads ENV after resetEncryptionKeyCacheForTests()", () => {
    const key1Str = validKey()
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = key1Str
    const result1 = getEncryptionKey()

    resetEncryptionKeyCacheForTests()

    const key2Str = validKey()
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = key2Str
    const result2 = getEncryptionKey()

    expect(result1).not.toBe(result2)
    expect(result2).toEqual(Buffer.from(key2Str, "base64"))
  })
})

// ---------------------------------------------------------------------------
// encryptSecret / decryptSecret round-trip
// ---------------------------------------------------------------------------

describe("encryptSecret / decryptSecret", () => {
  beforeEach(() => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = validKey()
  })

  it.each([1, 16, 64, 1024])(
    "round-trip works for string of length %d",
    (len) => {
      const plain = "a".repeat(len)
      const encrypted = encryptSecret(plain)
      const decrypted = decryptSecret(encrypted)
      expect(decrypted).toBe(plain)
    }
  )

  it("produces different ciphertext and IV for the same plaintext", () => {
    const plain = "my-secret-api-key-12345"
    const enc1 = encryptSecret(plain)
    const enc2 = encryptSecret(plain)

    expect(enc1.iv.equals(enc2.iv)).toBe(false)
    expect(enc1.ciphertext.equals(enc2.ciphertext)).toBe(false)
  })

  it("last4 is correct for long strings", () => {
    const plain = "sk-abcdefghijklmnop"
    const encrypted = encryptSecret(plain)
    expect(encrypted.last4).toBe("mnop")
  })

  it("last4 is padded with asterisks for short strings", () => {
    expect(encryptSecret("x").last4).toBe("***x")
    expect(encryptSecret("ab").last4).toBe("**ab")
    expect(encryptSecret("abc").last4).toBe("*abc")
    expect(encryptSecret("abcd").last4).toBe("abcd")
  })

  it("throws on empty plain", () => {
    expect(() => encryptSecret("")).toThrow("non-empty string")
  })

  it("throws on non-string plain", () => {
    // @ts-expect-error testing runtime guard
    expect(() => encryptSecret(null)).toThrow("non-empty string")
    // @ts-expect-error testing runtime guard
    expect(() => encryptSecret(123)).toThrow("non-empty string")
  })
})

// ---------------------------------------------------------------------------
// Tamper detection
// ---------------------------------------------------------------------------

describe("decryptSecret tamper detection", () => {
  beforeEach(() => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = validKey()
  })

  it("throws 'decryption failed' when ciphertext is tampered", () => {
    const encrypted = encryptSecret("secret-value")
    // Flip one byte in ciphertext
    encrypted.ciphertext[0] ^= 0xff
    expect(() => decryptSecret(encrypted)).toThrow("decryption failed")
  })

  it("throws 'decryption failed' when tag is tampered", () => {
    const encrypted = encryptSecret("secret-value")
    // Flip one byte in tag
    encrypted.tag[0] ^= 0xff
    expect(() => decryptSecret(encrypted)).toThrow("decryption failed")
  })

  it("throws 'invalid ciphertext format' when IV length != 12", () => {
    const encrypted = encryptSecret("secret-value")
    expect(() =>
      decryptSecret({ ...encrypted, iv: Buffer.alloc(8) })
    ).toThrow("invalid ciphertext format")

    expect(() =>
      decryptSecret({ ...encrypted, iv: Buffer.alloc(16) })
    ).toThrow("invalid ciphertext format")
  })

  it("throws 'invalid ciphertext format' when tag length != 16", () => {
    const encrypted = encryptSecret("secret-value")
    expect(() =>
      decryptSecret({ ...encrypted, tag: Buffer.alloc(8) })
    ).toThrow("invalid ciphertext format")

    expect(() =>
      decryptSecret({ ...encrypted, tag: Buffer.alloc(32) })
    ).toThrow("invalid ciphertext format")
  })
})

// ---------------------------------------------------------------------------
// maskSecret
// ---------------------------------------------------------------------------

describe("maskSecret", () => {
  it("uses default prefix 'sk-'", () => {
    expect(maskSecret("abcd")).toBe("sk-***abcd")
  })

  it("uses custom prefix when provided", () => {
    expect(maskSecret("1234", "key-")).toBe("key-***1234")
  })

  it("works with empty prefix", () => {
    expect(maskSecret("wxyz", "")).toBe("***wxyz")
  })
})

// ---------------------------------------------------------------------------
// isEncryptionConfigured
// ---------------------------------------------------------------------------

describe("isEncryptionConfigured", () => {
  it("returns false when ENV is not set", () => {
    delete process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY
    expect(isEncryptionConfigured()).toBe(false)
  })

  it("returns false when ENV is invalid", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = "not-base64!!!"
    expect(isEncryptionConfigured()).toBe(false)
  })

  it("returns false when key is wrong length", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = randomBytes(16).toString("base64")
    expect(isEncryptionConfigured()).toBe(false)
  })

  it("returns true when key is valid", () => {
    process.env.ASSISTANT_SETTINGS_ENCRYPTION_KEY = validKey()
    expect(isEncryptionConfigured()).toBe(true)
  })
})
