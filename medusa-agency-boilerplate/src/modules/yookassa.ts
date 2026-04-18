import { randomUUID } from "crypto"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrieveAccountHolderInput,
  RetrieveAccountHolderOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  MedusaError,
  ModuleProvider,
  Modules,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"

const YOOKASSA_API_BASE_URL = "https://api.yookassa.ru/v3"

export const YOOKASSA_PROVIDER_KEY = "pp_yookassa_yookassa"

export type YooKassaProviderOptions = {
  shopId: string
  secretKey: string
  returnUrl: string
  webhookSecret?: string
}

export type YooKassaPaymentSessionData = {
  id: string
  status: string
  paid: boolean
  amount?: {
    value?: string
    currency?: string
  }
  confirmation?: {
    type?: string
    confirmation_url?: string
  }
  cancellation_details?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  return_url?: string
}

type YooKassaPaymentResponse = {
  id: string
  status: string
  paid?: boolean
  amount?: {
    value?: string
    currency?: string
  }
  confirmation?: {
    type?: string
    confirmation_url?: string
  }
  cancellation_details?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

type YooKassaRequestOptions = {
  method?: "GET" | "POST"
  path: string
  config: YooKassaProviderOptions
  idempotenceKey?: string
  body?: Record<string, unknown>
}

export class YooKassaPaymentProvider extends AbstractPaymentProvider<YooKassaProviderOptions> {
  static identifier = "yookassa"

  constructor(container: Record<string, unknown>, options: YooKassaProviderOptions) {
    super(container, options)
  }

  static validateOptions(options: Record<string, unknown>) {
    const shopId = getString(options.shopId)
    const secretKey = getString(options.secretKey)
    const returnUrl = getString(options.returnUrl)

    if (!shopId || !secretKey || !returnUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "YooKassa payment provider requires shopId, secretKey, and returnUrl."
      )
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const payment = await createYooKassaPayment(this.config, input)

    return {
      id: payment.id,
      data: buildSessionData(payment, resolveReturnUrl(input.data, this.config)),
      status: PaymentSessionStatus.PENDING,
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const payment = await this.retrieveRemotePayment(input.data)
    const status = mapYooKassaStatusToSessionStatus(payment.status)

    return {
      status,
      data: buildSessionData(payment, resolveReturnUrl(input.data, this.config)),
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const paymentId = getPaymentId(input.data)

    if (!paymentId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing YooKassa payment id for capture."
      )
    }

    const payment = await captureYooKassaPayment(this.config, paymentId, input.data)

    return {
      data: buildSessionData(payment, resolveReturnUrl(input.data, this.config)),
    }
  }

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    const paymentId = getPaymentId(input.data)

    if (!paymentId) {
      return {
        data: asRecord(input.data),
      }
    }

    const payment = await cancelYooKassaPayment(this.config, paymentId)

    return {
      data: buildSessionData(payment, resolveReturnUrl(input.data, this.config)),
    }
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    const paymentId = getPaymentId(input.data)

    if (!paymentId) {
      return {
        data: asRecord(input.data),
      }
    }

    try {
      const payment = await cancelYooKassaPayment(this.config, paymentId)

      return {
        data: buildSessionData(payment, resolveReturnUrl(input.data, this.config)),
      }
    } catch {
      return {
        data: asRecord(input.data),
      }
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const payment = await this.retrieveRemotePayment(input.data)

    return {
      status: mapYooKassaStatusToSessionStatus(payment.status),
      data: buildSessionData(payment, resolveReturnUrl(input.data, this.config)),
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const payment = await this.retrieveRemotePayment(input.data)

    return {
      data: buildSessionData(payment, resolveReturnUrl(input.data, this.config)),
    }
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    const paymentId = getPaymentId(input.data)

    if (!paymentId) {
      const created = await this.initiatePayment(input)

      return {
        data: created.data,
        status: created.status,
      }
    }

    const current = await retrieveYooKassaPayment(this.config, paymentId)
    const currentStatus = mapYooKassaStatusToSessionStatus(current.status)

    if (
      currentStatus === PaymentSessionStatus.AUTHORIZED ||
      currentStatus === PaymentSessionStatus.CAPTURED ||
      currentStatus === PaymentSessionStatus.CANCELED
    ) {
      return {
        data: buildSessionData(current, resolveReturnUrl(input.data, this.config)),
        status: currentStatus,
      }
    }

    await cancelYooKassaPayment(this.config, paymentId)

    const recreated = await this.initiatePayment(input)

    return {
      data: recreated.data,
      status: recreated.status,
    }
  }

  async refundPayment(_: RefundPaymentInput): Promise<RefundPaymentOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Refunds are intentionally out of scope for YooKassa payment v1."
    )
  }

  async retrieveAccountHolder(
    input: RetrieveAccountHolderInput
  ): Promise<RetrieveAccountHolderOutput> {
    return {
      id: input.id,
      data: {},
    }
  }

  async createAccountHolder(
    input: CreateAccountHolderInput
  ): Promise<CreateAccountHolderOutput> {
    return {
      id: input.context.customer.id,
      data: {},
    }
  }

  async deleteAccountHolder(
    _: DeleteAccountHolderInput
  ): Promise<DeleteAccountHolderOutput> {
    return {
      data: {},
    }
  }

  async getWebhookActionAndData(
    data: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const object = asRecord(data.data.object)
    const metadata = asRecord(object.metadata)
    const sessionId = getString(metadata.medusa_payment_session_id)
    const status = getString(object.status)

    if (!sessionId || !status) {
      return {
        action: PaymentActions.NOT_SUPPORTED,
      }
    }

    return {
      action: mapYooKassaStatusToWebhookAction(status),
      data: {
        session_id: sessionId,
        amount: Number(asRecord(object.amount).value ?? 0),
      },
    }
  }

  private async retrieveRemotePayment(data?: Record<string, unknown>) {
    const paymentId = getPaymentId(data)

    if (!paymentId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing YooKassa payment id."
      )
    }

    return retrieveYooKassaPayment(this.config, paymentId)
  }
}

export default ModuleProvider(Modules.PAYMENT, {
  services: [YooKassaPaymentProvider],
})

export async function retrieveYooKassaPayment(
  config: YooKassaProviderOptions,
  paymentId: string
): Promise<YooKassaPaymentResponse> {
  return yookassaRequest({
    path: `/payments/${paymentId}`,
    config,
  })
}

export async function createYooKassaPayment(
  config: YooKassaProviderOptions,
  input: Pick<InitiatePaymentInput, "amount" | "currency_code" | "context" | "data">
): Promise<YooKassaPaymentResponse> {
  const returnUrl = resolveReturnUrl(input.data, config)

  return yookassaRequest({
    method: "POST",
    path: "/payments",
    config,
    idempotenceKey:
      getString(input.context?.idempotency_key) ||
      getString(input.data?.idempotency_key) ||
      randomUUID(),
    body: {
      amount: {
        value: formatAmountForYooKassa(input.amount),
        currency: input.currency_code.toUpperCase(),
      },
      capture: false,
      confirmation: {
        type: "redirect",
        return_url: returnUrl,
      },
      description: buildPaymentDescription(input),
      metadata: {
        cart_id: getString(input.data?.cart_id),
      },
    },
  })
}

export async function cancelYooKassaPayment(
  config: YooKassaProviderOptions,
  paymentId: string
): Promise<YooKassaPaymentResponse> {
  return yookassaRequest({
    method: "POST",
    path: `/payments/${paymentId}/cancel`,
    config,
    idempotenceKey: randomUUID(),
  })
}

export async function captureYooKassaPayment(
  config: YooKassaProviderOptions,
  paymentId: string,
  data?: Record<string, unknown>
): Promise<YooKassaPaymentResponse> {
  const amountValue = getAmountValueFromData(data)

  return yookassaRequest({
    method: "POST",
    path: `/payments/${paymentId}/capture`,
    config,
    idempotenceKey: randomUUID(),
    body: amountValue
      ? {
          amount: amountValue,
        }
      : undefined,
  })
}

export function mapYooKassaStatusToSessionStatus(status?: string) {
  switch (status) {
    case "waiting_for_capture":
      return PaymentSessionStatus.AUTHORIZED
    case "succeeded":
      return PaymentSessionStatus.CAPTURED
    case "canceled":
      return PaymentSessionStatus.CANCELED
    case "waiting_for_confirmation":
      return PaymentSessionStatus.REQUIRES_MORE
    case "pending":
    default:
      return PaymentSessionStatus.PENDING
  }
}

export function canPlaceOrderFromYooKassaStatus(status?: string) {
  return status === "waiting_for_capture" || status === "succeeded"
}

export function isYooKassaConfigured(config: Partial<YooKassaProviderOptions>) {
  return Boolean(config.shopId && config.secretKey && config.returnUrl)
}

function mapYooKassaStatusToWebhookAction(status: string) {
  switch (status) {
    case "waiting_for_capture":
      return PaymentActions.AUTHORIZED
    case "succeeded":
      return PaymentActions.SUCCESSFUL
    case "canceled":
      return PaymentActions.CANCELED
    case "waiting_for_confirmation":
      return PaymentActions.REQUIRES_MORE
    case "pending":
    default:
      return PaymentActions.PENDING
  }
}

function buildSessionData(
  payment: YooKassaPaymentResponse,
  returnUrl: string
): YooKassaPaymentSessionData {
  return {
    id: payment.id,
    status: payment.status,
    paid: Boolean(payment.paid),
    amount: payment.amount,
    confirmation: payment.confirmation,
    cancellation_details: payment.cancellation_details ?? null,
    metadata: payment.metadata,
    return_url: returnUrl,
  }
}

function resolveReturnUrl(
  data: Record<string, unknown> | undefined,
  config: YooKassaProviderOptions
) {
  const rawReturnUrl = getString(data?.return_url) || config.returnUrl
  const returnUrl = normalizeReturnUrlPath(
    getUrl(rawReturnUrl) || getUrl(config.returnUrl)
  )

  if (!returnUrl) {
    return config.returnUrl
  }

  const cartId = getString(data?.cart_id)
  const countryCode = getString(data?.country_code).toLowerCase()
  const storefrontOrigin = getString(data?.storefront_origin)

  if (cartId) {
    returnUrl.searchParams.set("cart_id", cartId)
  }

  if (countryCode) {
    returnUrl.searchParams.set("country_code", countryCode)
  }

  if (storefrontOrigin) {
    returnUrl.searchParams.set("storefront_origin", storefrontOrigin)
  }

  return returnUrl.toString()
}

async function yookassaRequest({
  method = "GET",
  path,
  config,
  idempotenceKey,
  body,
}: YooKassaRequestOptions): Promise<YooKassaPaymentResponse> {
  const response = await fetch(`${YOOKASSA_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.shopId}:${config.secretKey}`
      ).toString("base64")}`,
      "Content-Type": "application/json",
      ...(idempotenceKey ? { "Idempotence-Key": idempotenceKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null

  if (!response.ok || !json) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      getString(json?.description) ||
        getString(json?.type) ||
        `YooKassa request failed with status ${response.status}.`
    )
  }

  return json as unknown as YooKassaPaymentResponse
}

function buildPaymentDescription(
  input: Pick<InitiatePaymentInput, "context" | "data">
) {
  const customerEmail = getString(input.context?.customer?.email)
  const cartId = getString(input.data?.cart_id)

  if (cartId && customerEmail) {
    return `Cart ${cartId} for ${customerEmail}`
  }

  if (cartId) {
    return `Cart ${cartId}`
  }

  if (customerEmail) {
    return `Checkout for ${customerEmail}`
  }

  return "Medusa checkout payment"
}

function formatAmountForYooKassa(amount: unknown) {
  const rawAmount = asRecord(asRecord(amount).raw)
  const candidates = [
    rawAmount.value,
    (amount as { value?: number | string })?.value,
    (amount as { numeric?: number | string })?.numeric,
    amount,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeAmountCandidate(candidate)

    if (normalized) {
      return normalized
    }
  }

  return "0.00"
}

function normalizeAmountCandidate(value: unknown) {
  const normalized = getFiniteNumber(value)

  return normalized === null ? "" : normalized.toFixed(2)
}

function getAmountValueFromData(data?: Record<string, unknown>) {
  const amount = asRecord(data?.amount)
  const value = getString(amount.value)
  const currency = getString(amount.currency)

  if (!value || !currency) {
    return undefined
  }

  return {
    value,
    currency,
  }
}

function getPaymentId(data?: Record<string, unknown>) {
  return getString(data?.id)
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length ? value.trim() : ""
}

function getFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string") {
    const normalized = Number(value.trim().replace(",", "."))

    return Number.isFinite(normalized) ? normalized : null
  }

  return null
}

function getUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function normalizeReturnUrlPath(url: URL | null) {
  if (!url) {
    return null
  }

  if (url.pathname === "/store/payment/yookassa/return") {
    console.info("[YooKassa] Rewriting legacy store return URL to public return URL", {
      from: url.toString(),
    })
    url.pathname = "/yookassa/return"
  }

  return url
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}
