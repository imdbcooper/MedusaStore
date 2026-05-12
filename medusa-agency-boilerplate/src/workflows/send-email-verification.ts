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
  buildEmailVerificationIssueMetadata,
  buildEmailVerificationLink,
  buildEmailVerificationToken,
  DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH,
  EMAIL_VERIFICATION_DEFAULT_SUBJECT,
  EMAIL_VERIFICATION_RESOURCE_TYPE,
  EMAIL_VERIFICATION_TEMPLATE,
  EMAIL_VERIFICATION_TRIGGER_TYPE,
  generateEmailVerificationRawToken,
  getEmailVerificationRuntime,
  hashEmailVerificationToken,
  renderEmailVerificationHtml,
  renderEmailVerificationPlainText,
  sanitizeLogValue,
} from "../modules/email-verification"
import {
  getNotificationEmailRuntime,
  normalizeNotificationRecipient,
} from "../modules/notification-email"

type SendEmailVerificationInput = {
  customerId: string
  countryCode?: string | null
  storefrontUrl?: string | null
  redirectPath?: string | null
  reason?: string | null
}

type EmailVerificationCustomer = {
  id: string
  email: string | null
  first_name: string | null
  metadata?: Record<string, unknown> | null
}

export type SendEmailVerificationSkipReason =
  | "customer_not_found"
  | "missing_customer_email"
  | "missing_storefront_url"

export type SendEmailVerificationResult = {
  status: "sent" | "skipped"
  reason: SendEmailVerificationSkipReason | null
  customer_id: string
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

export type SendEmailVerificationOutput = {
  result: SendEmailVerificationResult
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

const DEFAULT_NOTIFICATION_COUNTRY_CODE = "ru"

function resolveCountryCode(value?: string | null): string {
  const normalized = value?.trim().toLowerCase()
  if (normalized) {
    return normalized
  }

  const fromEnv = process.env.NOTIFICATION_DEFAULT_COUNTRY_CODE?.trim().toLowerCase()
  if (fromEnv) {
    return fromEnv
  }

  return DEFAULT_NOTIFICATION_COUNTRY_CODE
}

function buildRedirectPath(value?: string | null): string {
  const normalized = value?.trim() || DEFAULT_EMAIL_VERIFICATION_REDIRECT_PATH

  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

const sendEmailVerificationStep = createStep(
  "send-email-verification-step",
  async (input: SendEmailVerificationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const runtime = getEmailVerificationRuntime()
    const emailRuntime = getNotificationEmailRuntime()
    const template = EMAIL_VERIFICATION_TEMPLATE
    const triggerType = EMAIL_VERIFICATION_TRIGGER_TYPE
    const countryCode = resolveCountryCode(input.countryCode)
    const reason = input.reason?.trim() || "initial"

    const storefrontUrl = resolveStorefrontUrl(input.storefrontUrl)

    if (!storefrontUrl) {
      logger.warn(
        `[email-verification] skip reason=missing_storefront_url customer_id=${sanitizeLogValue(input.customerId)} request_reason=${sanitizeLogValue(reason)}`
      )

      return new StepResponse<SendEmailVerificationResult>({
        status: "skipped",
        reason: "missing_storefront_url",
        customer_id: input.customerId,
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

    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "metadata"],
      filters: {
        id: input.customerId,
      },
    })

    const customer = customers[0] as EmailVerificationCustomer | undefined

    if (!customer) {
      logger.warn(
        `[email-verification] skip reason=customer_not_found customer_id=${sanitizeLogValue(input.customerId)} request_reason=${sanitizeLogValue(reason)}`
      )

      return new StepResponse<SendEmailVerificationResult>({
        status: "skipped",
        reason: "customer_not_found",
        customer_id: input.customerId,
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

    const normalizedRecipient = normalizeNotificationRecipient(customer.email)

    if (!normalizedRecipient) {
      logger.warn(
        `[email-verification] skip reason=missing_customer_email customer_id=${sanitizeLogValue(customer.id)} request_reason=${sanitizeLogValue(reason)}`
      )

      return new StepResponse<SendEmailVerificationResult>({
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
    const rawToken = generateEmailVerificationRawToken()
    const tokenHash = hashEmailVerificationToken(rawToken)
    const fullToken = buildEmailVerificationToken(customer.id, rawToken)
    const link = buildEmailVerificationLink({
      storefrontUrl,
      countryCode,
      redirectPath: buildRedirectPath(input.redirectPath || runtime.redirectPath),
      token: fullToken,
    })

    const nextMetadata = buildEmailVerificationIssueMetadata({
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
    const subject = EMAIL_VERIFICATION_DEFAULT_SUBJECT
    const text = renderEmailVerificationPlainText({
      link,
      ttlMinutes,
      firstName: customer.first_name,
    })
    const html = renderEmailVerificationHtml({
      link,
      ttlMinutes,
      firstName: customer.first_name,
    })
    const senderAddress =
      emailRuntime.providerId === "smtp"
        ? emailRuntime.smtpFrom
        : emailRuntime.from

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient,
      from: senderAddress,
      channel: "email",
      template,
      trigger_type: triggerType,
      resource_type: EMAIL_VERIFICATION_RESOURCE_TYPE,
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
        expires_at: nextMetadata.email_verification &&
        typeof nextMetadata.email_verification === "object"
          ? (nextMetadata.email_verification as { expires_at?: string })
              .expires_at || null
          : null,
      },
    }

    const notification = await notificationModuleService.createNotifications(
      payload
    )

    const expiresAt =
      nextMetadata.email_verification &&
      typeof nextMetadata.email_verification === "object"
        ? (nextMetadata.email_verification as { expires_at?: string })
            .expires_at || null
        : null

    logger.info(
      `[email-verification] sent customer_id=${sanitizeLogValue(customer.id)} recipient=${sanitizeLogValue(normalizedRecipient)} notification_id=${sanitizeLogValue(notification.id)} ttl_minutes=${ttlMinutes} expires_at=${sanitizeLogValue(expiresAt)} provider_requested=${emailRuntime.requestedProviderId} provider_resolved=${emailRuntime.providerId} request_reason=${sanitizeLogValue(reason)}`
    )

    return new StepResponse<SendEmailVerificationResult>({
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

const sendEmailVerificationWorkflow = createWorkflow(
  "send-email-verification-workflow",
  (input: SendEmailVerificationInput) => {
    const result = sendEmailVerificationStep(input)

    return new WorkflowResponse<SendEmailVerificationOutput>({
      result,
    })
  }
)

export default sendEmailVerificationWorkflow
export { sendEmailVerificationStep }
