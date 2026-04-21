import crypto from "node:crypto"
import type {
  DeliveryHubCredentials,
  DeliveryHubCredentialsEnvelope,
} from "../domain/credentials"
import { DeliveryHubError } from "../errors"

export type DeliveryHubEncryptionState =
  | { mode: "sealed"; key: Buffer }
  | { mode: "disabled" }

export function getDeliveryHubEncryptionState(): DeliveryHubEncryptionState {
  const rawKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY?.trim()

  if (!rawKey) {
    return { mode: "disabled" }
  }

  const normalized = normalizeKey(rawKey)
  return {
    mode: "sealed",
    key: normalized,
  }
}

export function encryptDeliveryHubCredentials(
  credentials: DeliveryHubCredentials,
  state = getDeliveryHubEncryptionState()
): DeliveryHubCredentialsEnvelope {
  if (state.mode !== "sealed") {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_ENCRYPTION_DISABLED",
      message: "Delivery Hub encryption key is not configured",
      status: 409,
    })
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", state.key, iv)
  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8")
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    version: "dh.v1",
    mode: "sealed",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  }
}

export function decryptDeliveryHubCredentials(
  envelope: DeliveryHubCredentialsEnvelope | null,
  state = getDeliveryHubEncryptionState()
): DeliveryHubCredentials {
  if (!envelope) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_CREDENTIALS_REQUIRED",
      message: "Delivery Hub credentials are not configured",
      status: 409,
    })
  }

  if (state.mode !== "sealed") {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_ENCRYPTION_DISABLED",
      message: "Delivery Hub encryption key is not configured",
      status: 409,
    })
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      state.key,
      Buffer.from(envelope.iv, "base64")
    )

    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"))

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ])

    return JSON.parse(plaintext.toString("utf8")) as DeliveryHubCredentials
  } catch {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_CREDENTIALS_INVALID",
      message: "Delivery Hub credentials cannot be decrypted",
      status: 409,
    })
  }
}

export function createCredentialsFingerprint(credentials: DeliveryHubCredentials) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ token: credentials.token }))
    .digest("hex")
}

function normalizeKey(rawKey: string) {
  const base64 = tryBase64(rawKey)

  if (base64 && base64.length === 32) {
    return base64
  }

  return crypto.createHash("sha256").update(rawKey, "utf8").digest()
}

function tryBase64(rawKey: string) {
  try {
    return Buffer.from(rawKey, "base64")
  } catch {
    return null
  }
}
