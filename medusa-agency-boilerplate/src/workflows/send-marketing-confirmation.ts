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
  buildChannelPendingMetadata,
  buildPublicConfirmationToken,
  DEFAULT_MARKETING_SOURCE,
  generateConfirmationToken,
  getMarketingDoubleOptinRuntime,
  hashConfirmationToken,
  sanitizeMarketingLogValue,
  type MarketingChannel,
  type MarketingCustomerRecord,
} from "../modules/marketing-preferences"
import { renderBrandedEmail } from "../modules/email-template"
import {
  getNotificationEmailRuntime,
  normalizeNotificationRecipient,
} from "../modules/notification-email"

export const MARKETING_CONFIRMATION_TEMPLATE =
  "marketing-double-optin-confirmation-v1"
export const MARKETING_CONFIRMATION_TRIGGER_TYPE =
  "marketing.subscription.confirmation_requested"
export const MARKETING_CONFIRMATION_RESOURCE_TYPE = "customer"
export const MARKETING_CONFIRMATION_DEFAULT_SUBJECT =
  "Подтвердите подписку на рассылку"
export const DEFAULT_MARKETING_CONFIRMATION_REDIRECT_PATH =
  "/marketing/confirm"

type SendMarketingConfirmationInput = {
  customerId: string
  channel: MarketingChannel
  countryCode?: string | null
  storefrontUrl?: string | null
  redirectPath?: string | null
  source?: string | null
}

export type SendMarketingConfirmationSkipReason =
  | "customer_not_found"
  | "missing_customer_email"
  | "missing_storefront_url"
  | "unsupported_channel"

export type SendMarketingConfirmationResult = {
  status: "sent" | "skipped"
  reason: SendMarketingConfirmationSkipReason | null
  customer_id: string
  channel: MarketingChannel
  recipient: string | null
  template: string
  trigger_type: string
  provider_requested: ReturnType<
    typeof getNotificationEmailRuntime
  >["requestedProviderId"]
  provider_resolved: ReturnType<typeof getNotificationEmailRuntime>["providerId"]
  token_ttl_days: number
  expires_at: string | null
  country_code: string | null
  notification?: NotificationDTO
}

export type SendMarketingConfirmationOutput = {
  result: SendMarketingConfirmationResult
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

function resolveRedirectPath(value?: string | null): string {
  const base =
    value?.trim() ||
    process.env.MARKETING_CONFIRMATION_REDIRECT_PATH?.trim() ||
    DEFAULT_MARKETING_CONFIRMATION_REDIRECT_PATH

  return base.startsWith("/") ? base : `/${base}`
}

function buildConfirmationLink(input: {
  storefrontUrl: string
  countryCode: string | null
  redirectPath: string
  token: string
}): string {
  const base = (input.storefrontUrl || "").trim().replace(/\/+$/, "")

  if (!base) {
    throw new Error(
      "Storefront URL is required to build a marketing confirmation link"
    )
  }

  const country = input.countryCode?.trim().toLowerCase() || ""
  const countrySegment = country ? `/${country}` : ""
  const redirectPath = input.redirectPath.startsWith("/")
    ? input.redirectPath
    : `/${input.redirectPath}`

  const url = new URL(`${base}${countrySegment}${redirectPath}`)
  url.searchParams.set("token", input.token)

  return url.toString()
}

function formatTtlSuffix(ttlDays: number): string {
  if (ttlDays === 1) {
    return "1 день"
  }

  if (ttlDays < 5) {
    return `${ttlDays} дня`
  }

  return `${ttlDays} дней`
}

function resolveMarketingSender(
  emailRuntime: ReturnType<typeof getNotificationEmailRuntime>
) {
  const marketingFrom = process.env.MARKETING_EMAIL_FROM?.trim()
  const marketingFromName = process.env.MARKETING_EMAIL_FROM_NAME?.trim()
  const marketingReplyTo = process.env.MARKETING_EMAIL_REPLY_TO?.trim()

  const defaultFrom =
    emailRuntime.providerId === "smtp"
      ? emailRuntime.smtpFrom
      : emailRuntime.from

  return {
    from: marketingFrom || defaultFrom,
    fromName: marketingFromName || undefined,
    replyTo: marketingReplyTo || undefined,
  }
}

const sendMarketingConfirmationStep = createStep(
  "send-marketing-confirmation-step",
  async (input: SendMarketingConfirmationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const runtime = getMarketingDoubleOptinRuntime()
    const emailRuntime = getNotificationEmailRuntime()
    const template = MARKETING_CONFIRMATION_TEMPLATE
    const triggerType = MARKETING_CONFIRMATION_TRIGGER_TYPE
    const countryCode = resolveCountryCode(input.countryCode)
    const redirectPath = resolveRedirectPath(input.redirectPath)
    const storefrontUrl = resolveStorefrontUrl(input.storefrontUrl)
    const channel = input.channel

    if (channel !== "email") {
      logger.warn(
        `[marketing-confirmation] skip reason=unsupported_channel customer_id=${sanitizeMarketingLogValue(input.customerId)} channel=${sanitizeMarketingLogValue(channel)}`
      )

      return new StepResponse<SendMarketingConfirmationResult>({
        status: "skipped",
        reason: "unsupported_channel",
        customer_id: input.customerId,
        channel,
        recipient: null,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_days: runtime.tokenTtlDays,
        expires_at: null,
        country_code: countryCode,
      })
    }

    if (!storefrontUrl) {
      logger.warn(
        `[marketing-confirmation] skip reason=missing_storefront_url customer_id=${sanitizeMarketingLogValue(input.customerId)}`
      )

      return new StepResponse<SendMarketingConfirmationResult>({
        status: "skipped",
        reason: "missing_storefront_url",
        customer_id: input.customerId,
        channel,
        recipient: null,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_days: runtime.tokenTtlDays,
        expires_at: null,
        country_code: countryCode,
      })
    }

    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "phone", "metadata"],
      filters: {
        id: input.customerId,
      },
    })

    const customer = customers[0] as MarketingCustomerRecord | undefined

    if (!customer) {
      logger.warn(
        `[marketing-confirmation] skip reason=customer_not_found customer_id=${sanitizeMarketingLogValue(input.customerId)}`
      )

      return new StepResponse<SendMarketingConfirmationResult>({
        status: "skipped",
        reason: "customer_not_found",
        customer_id: input.customerId,
        channel,
        recipient: null,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_days: runtime.tokenTtlDays,
        expires_at: null,
        country_code: countryCode,
      })
    }

    const normalizedRecipient = normalizeNotificationRecipient(customer.email)

    if (!normalizedRecipient) {
      logger.warn(
        `[marketing-confirmation] skip reason=missing_customer_email customer_id=${sanitizeMarketingLogValue(customer.id)}`
      )

      return new StepResponse<SendMarketingConfirmationResult>({
        status: "skipped",
        reason: "missing_customer_email",
        customer_id: customer.id,
        channel,
        recipient: null,
        template,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        token_ttl_days: runtime.tokenTtlDays,
        expires_at: null,
        country_code: countryCode,
      })
    }

    const now = new Date()
    const rawToken = generateConfirmationToken()
    const tokenHash = hashConfirmationToken(rawToken)
    const fullToken = buildPublicConfirmationToken(
      customer.id,
      channel,
      rawToken
    )

    const nextMetadata = buildChannelPendingMetadata({
      customer,
      channel,
      tokenHash,
      now,
      ttlDays: runtime.tokenTtlDays,
      source: input.source || DEFAULT_MARKETING_SOURCE,
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

    const link = buildConfirmationLink({
      storefrontUrl,
      countryCode,
      redirectPath,
      token: fullToken,
    })

    const rendered = renderBrandedEmail({
      preheader: "Подтвердите подписку на маркетинговую рассылку",
      heading: "Подтвердите подписку",
      intro: [
        "Здравствуйте!",
        "Вы включили подписку на маркетинговую рассылку. Чтобы начать получать письма, подтвердите адрес.",
      ],
      action: {
        label: "Подтвердить подписку",
        url: link,
      },
      body: [
        `Ссылка действительна ${formatTtlSuffix(runtime.tokenTtlDays)}.`,
        "Если вы не запрашивали подписку, просто проигнорируйте это письмо — подписка не будет активирована.",
      ],
    })

    const marketingSender = resolveMarketingSender(emailRuntime)
    const expiresAtIso = new Date(
      now.getTime() + runtime.tokenTtlDays * 24 * 60 * 60 * 1000
    ).toISOString()

    const payload: CreateNotificationDTO = {
      to: normalizedRecipient,
      from: marketingSender.from,
      channel: "email",
      template,
      trigger_type: triggerType,
      resource_type: MARKETING_CONFIRMATION_RESOURCE_TYPE,
      resource_id: customer.id,
      content: {
        subject: MARKETING_CONFIRMATION_DEFAULT_SUBJECT,
        text: rendered.text,
        html: rendered.html,
      },
      data: {
        subject: MARKETING_CONFIRMATION_DEFAULT_SUBJECT,
        customer_id: customer.id,
        recipient: normalizedRecipient,
        trigger_type: triggerType,
        provider_requested: emailRuntime.requestedProviderId,
        provider_resolved: emailRuntime.providerId,
        country_code: countryCode,
        channel,
        link,
        ttl_days: runtime.tokenTtlDays,
        expires_at: expiresAtIso,
        marketing_confirmation: true,
      },
    }

    const notification = await notificationModuleService.createNotifications(
      payload
    )

    logger.info(
      `[marketing-confirmation] sent customer_id=${sanitizeMarketingLogValue(customer.id)} recipient=${sanitizeMarketingLogValue(normalizedRecipient)} channel=${channel} notification_id=${sanitizeMarketingLogValue(notification.id)} ttl_days=${runtime.tokenTtlDays}`
    )

    return new StepResponse<SendMarketingConfirmationResult>({
      status: "sent",
      reason: null,
      customer_id: customer.id,
      channel,
      recipient: normalizedRecipient,
      template,
      trigger_type: triggerType,
      provider_requested: emailRuntime.requestedProviderId,
      provider_resolved: emailRuntime.providerId,
      token_ttl_days: runtime.tokenTtlDays,
      expires_at: expiresAtIso,
      country_code: countryCode,
      notification,
    })
  }
)

const sendMarketingConfirmationWorkflow = createWorkflow(
  "send-marketing-confirmation-workflow",
  (input: SendMarketingConfirmationInput) => {
    const result = sendMarketingConfirmationStep(input)

    return new WorkflowResponse<SendMarketingConfirmationOutput>({
      result,
    })
  }
)

export default sendMarketingConfirmationWorkflow
export { sendMarketingConfirmationStep }
