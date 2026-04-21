import { redactRecord } from "../../security/redaction"

export function redactYandexHeaders(headers: Record<string, string>) {
  return redactRecord(headers)
}

export function redactYandexPayload(payload: Record<string, unknown>) {
  return redactRecord(payload)
}
