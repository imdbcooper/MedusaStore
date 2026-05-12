import type {
  CreateNotificationDTO,
  NotificationDTO,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import {
  buildPasswordResetIssueMetadata,
  buildPasswordResetLink,
  buildPasswordResetToken,
  DEFAULT_PASSWORD_RESET_REDIRECT_PATH,
  generatePasswordResetRawToken,
  getPasswordResetRuntime,
  hashPasswordResetToken,
  PASSWORD_RESET_DEFAULT_SUBJECT,
  PASSWORD_RESET_RESOURCE_TYPE,
  PASSWORD_RESET_TEMPLATE,
  PASSWORD_RESET_TRIGGER_TYPE,
  renderPasswordResetHtml,
  renderPasswordResetPlainText,
  sanitizeLogValue,
} from "../modules/password-reset"
import {
  getNotificationEmailRuntime,
  normalizeNotificationRecipient,
} from "../modules/notification-email"

type SendPasswordResetInput = {
  email: string
  countryCode?: string | null
  storefrontUrl?: string | null
  redirectPath?: string | null
  reason?: string | null
}

type PasswordResetCustomer = {
  id: string
  email: string | null
  first_name: string | null
  metadata?: Record<string, unknown> | null
}

export type SendPasswordResetSkipReason =
  | "missing_email"
  | "customer_not_found"
  | "missing_customer_email"
  | "missing_storefront_url"

export type SendPasswordResetResult = {
  status: "sent" | "skipped"
  reason: SendPasswordResetSkipReason | null
  customer_id: string | null
  recipient: string | null
  recipient_normalized: string | null
  template: string
  trigger_type: string
  provider_requested: ReturnType<
    typeof getNotificationEmailRuntime
  >["requestedProviderId"]
  provider_resolved: ReturnType<typeof getNotificationEmailRuntime>["providerId"]
  token_ttl_minutes: number
  expires_at: string | null
  country_code: string | null
  notification?: NotificationDTO
}

export type SendPasswordResetOutput = {
  result: SendPasswordResetResult
}

function resolveStorefrontUrl(explicit?: string | null): string | null {
  const candidate =
    explicit?.trim() ||
    process.env.STOREFRONT_URL?.trim() ||
    process.env.STOREFRONT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim() ||
    ""

  return candidate || null
}

function resolveCountryCode(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase()

  return normalized || null
}

function buildRedirectPath(value?: string | null): string {
  const normalized = value?.trim() || DEFAULT_PASSWORD_RESET_REDIRECT_PATH

  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

const sendPasswordResetStep = createStep(
  "send-password-reset-step",
  async (input: SendPasswordResetInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const runtime = getPasswordResetRuntime()
    const emailRuntime = getNotificationEmailRuntime()
    const template = PASSWORD_RESET_TEMPLATE
    const triggerType = PASSWORD_RESET_TRIGGER_TYPE
    const countryCode = resolveCountryCode(input.countryCode)
    const reason = input.reason?.trim() || "forgot_password"
    const normalizedEmail = normalizeNotificationRecipient(input.email)

    if (!normalizedEmail) {
      logger.warn(
        `[password-reset] skip reason=missing_email request_reason=${sanitizeLogValue(reason)}`
      )

      return new StepResponse<SendPasswordResetResult>({
        status: "skipped",
        reason: "missing_email",
        customer_id: null,
        recipient: null,
        recipient_normalized: null,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_minutes: runtime.tokenTtlMinutes,
        expires_at: null,
        country_code: countryCode,
      })
    }

    const storefrontUrl = resolveStorefrontUrl(input.storefrontUrl)

    if (!storefrontUrl) {
      logger.warn(
        `[password-reset] skip reason=missing_storefront_url recipient=${sanitizeLogValue(normalizedEmail)} request_reason=${sanitizeLogValue(reason)}`
      )

      return new StepResponse<SendPasswordResetResult>({
        status: "skipped",
        reason: "missing_storefront_url",
        customer_id: null,
        recipient: null,
        recipient_normalized: normalizedEmail,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_minutes: runtime.tokenTtlMinutes,
        expires_at: null,
        country_code: countryCode,
      })
    }

    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "metadata"],
      filters: {
        email: normalizedEmail,
      },
    })

    const customer = customers[0] as PasswordResetCustomer | undefined

    if (!customer) {
      logger.info(
        `[password-reset] skip reason=customer_not_found recipient=${sanitizeLogValue(normalizedEmail)} request_reason=${sanitizeLogValue(reason)}`
      )

      return new StepResponse<SendPasswordResetResult>({
        status: "skipped",
        reason: "customer_not_found",
        customer_id: null,
        recipient: null,
        recipient_normalized: normalizedEmail,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_minutes: runtime.tokenTtlMinutes,
        expires_at: null,
        country_code: countryCode,
      })
    }

    const normalizedRecipient = normalizeNotificationRecipient(customer.email)

    if (!normalizedRecipient) {
      logger.warn(
        `[password-reset] skip reason=missing_customer_email customer_id=${sanitizeLogValue(customer.id)} request_reason=${sanitizeLogValue(reason)}`
      )

      return new StepResponse<SendPasswordResetResult>({
        status: "skipped",
        reason: "missing_customer_email",
        customer_id: customer.id,
        recipient: null,
        recipient_normalized: null,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_minutes: runtime.tokenTtlMinutes,
        expires_at: null,
        country_code: countryCode,
      })
    }

    const now = new Date()
    const rawToken = generatePasswordResetRawToken()
    const tokenHash = hashPasswordResetToken(rawToken)
    const fullToken = buildPasswordResetToken(customer.id, rawToken)
    const link = buildPasswordResetLink({
      storefrontUrl,
      countryCode,
      redirectPath: buildRedirectPath(input.redirectPath || runtime.redirectPath),
      token: fullToken,
    })

    const nextMetadata = buildPasswordResetIssueMetadata({
      currentMetadata: customer.metadata,
      email: normalizedRecipient,
      tokenHash,
      now,
      ttlMinutes: runtime.tokenTtlMinutes,
    })

    await updateCustomersWorkflow(container).run({
      input: {
        selector: {
          id: [customer.id],
        },
        update: {
          metadata: nextMetadata,
        },
      },
    })

    const ttlMinutes = runtime.tokenTtlMinutes
    const subject = PASSWORD_RESET_DEFAULT_SUBJECT
    const text = renderPasswordResetPlainText({
      link,
      ttlMinutes,
      firstName: customer.first_name,
    })
    const html = renderPasswordResetHtml({
      link,
      ttlMinutes,
      firstName: customer.first_name,
    })
    const senderAddress =
      emailRuntime.providerId === "smtp"
        ? emailRuntime.smtpFrom
        : emailRuntime.from

    const storedState =
      nextMetadata.password_reset &&
      typeof nextMetadata.password_reset === "object"
        ? (nextMetadata.password_reset as { expires_at?: string })
        : null
    const expiresAt = storedState?.expires_at ?? null

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient,
      from: senderAddress,
      channel: "email",
      template,
      trigger_type: triggerType,
      resource_type: PASSWORD_RESET_RESOURCE_TYPE,
      resource_id: customer.id,
      content: {
        subject,
        text,
        html,
      },
      data: {
        subject,
        customer_id: customer.id,
        recipient: normalizedRecipient,
        recipient_normalized: normalizedRecipient,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        request_reason: reason,
        country_code: countryCode,
        link,
        ttl_minutes: ttlMinutes,
        expires_at: expiresAt,
      },
    }

    const notification = await notificationModuleService.createNotifications(
      payload
    )

    logger.info(
      `[password-reset] sent customer_id=${sanitizeLogValue(customer.id)} recipient=${sanitizeLogValue(normalizedRecipient)} notification_id=${sanitizeLogValue(notification.id)} ttl_minutes=${ttlMinutes} expires_at=${sanitizeLogValue(expiresAt)} provider_requested=${emailRuntime.requestedProviderId} provider_resolved=${emailRuntime.providerId} request_reason=${sanitizeLogValue(reason)}`
    )

    return new StepResponse<SendPasswordResetResult>({
      status: "sent",
      reason: null,
      customer_id: customer.id,
      recipient: normalizedRecipient,
      recipient_normalized: normalizedRecipient,
      template,
      trigger_type: triggerType,
      provider_requested: emailRuntime.requestedProviderId,
      provider_resolved: emailRuntime.providerId,
      token_ttl_minutes: ttlMinutes,
      expires_at: expiresAt,
      country_code: countryCode,
      notification,
    })
  }
)

const sendPasswordResetWorkflow = createWorkflow(
  "send-password-reset-workflow",
  (input: SendPasswordResetInput) => {
    const result = sendPasswordResetStep(input)

    return new WorkflowResponse<SendPasswordResetOutput>({
      result,
    })
  }
)

export default sendPasswordResetWorkflow
export { sendPasswordResetStep }
