export type DeliveryHubErrorCode =
  | "DELIVERY_HUB_VALIDATION_ERROR"
  | "DELIVERY_HUB_NOT_FOUND"
  | "DELIVERY_HUB_PROVIDER_NOT_SUPPORTED"
  | "DELIVERY_HUB_ENCRYPTION_DISABLED"
  | "DELIVERY_HUB_CREDENTIALS_REQUIRED"
  | "DELIVERY_HUB_CREDENTIALS_INVALID"
  | "DELIVERY_HUB_PROVIDER_ERROR"

export class DeliveryHubError extends Error {
  code: DeliveryHubErrorCode
  status: number
  details: Record<string, unknown> | undefined

  constructor(input: {
    code: DeliveryHubErrorCode
    message: string
    status?: number
    details?: Record<string, unknown>
  }) {
    super(input.message)
    this.name = "DeliveryHubError"
    this.code = input.code
    this.status = input.status ?? 400
    this.details = input.details
  }
}

export function isDeliveryHubError(error: unknown): error is DeliveryHubError {
  return error instanceof DeliveryHubError
}
