export type DeliveryHubCredentials = {
  token: string
  oauthToken?: string | null
  apiKey?: string | null
}

export type DeliveryHubCredentialsEnvelope = {
  version: "dh.v1"
  mode: "sealed"
  iv: string
  tag: string
  ciphertext: string
}

export type DeliveryHubCredentialsState =
  | "empty"
  | "sealed"
  | "disabled"
  | "invalid"
