import type { CreateNotificationDTO, NotificationDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  claimMarketingCampaignForLaunch,
  DEFAULT_MARKETING_RESOURCE_TYPE,
  DEFAULT_MARKETING_TRIGGER_TYPE,
  type MarketingCampaignRecord,
  type MarketingDeliveryJournalRecord,
  countRecentMarketingDeliveries,
  getMarketingCampaignById,
  getMarketingPgConnection,
  insertMarketingDeliveryJournal,
  resolveMarketingAudience,
  updateMarketingCampaignStatus,
} from "../modules/marketing-layer"
import {
  applyMarketingSendMetadataUpdate,
  isCustomerChannelSubscribed,
  isCustomerGloballySubscribed,
  isMarketingSuppressedNow,
  persistCustomerMarketingMetadata,
} from "../modules/marketing-preferences"
import { getNotificationEmailRuntime } from "../modules/notification-email"
import {
  DEFAULT_NOTIFICATION_SMS_CHANNEL,
  getNotificationSmsRuntime,
} from "../modules/notification-sms"
import { getNotificationVkRuntime } from "../modules/notification-vk"
import {
  buildPublicUnsubscribeToken,
  buildUnsubscribeIssueMetadata,
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
  getMarketingUnsubscribeRuntime,
  hashUnsubscribeToken,
} from "../modules/marketing-unsubscribe"
import { renderBrandedEmail } from "../modules/email-template"

function resolveStorefrontUrl(): string | null {
  const candidate =
    process.env.STOREFRONT_URL?.trim() ||
    process.env.STOREFRONT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim() ||
    ""

  return candidate || null
}

function resolveMarketingEmailFrom(
  emailRuntime: ReturnType<typeof getNotificationEmailRuntime>
): string | null {
  const marketingFrom = process.env.MARKETING_EMAIL_FROM?.trim()

  if (marketingFrom) {
    return marketingFrom
  }

  if (emailRuntime.providerId === "smtp") {
    return emailRuntime.smtpFrom || emailRuntime.from || null
  }

  return emailRuntime.from || null
}

export function resolveMarketingUnsubscribeMailto(): string | null {
  const explicit = process.env.MARKETING_UNSUBSCRIBE_MAILTO?.trim()

  if (explicit) {
    return explicit
  }

  // No hardcoded default — when the mailbox is not configured we simply do
  // not emit a `<mailto:…>` part in the List-Unsubscribe header. The https
  // URL alone is sufficient for RFC 8058 One-Click compliance.
  return null
}

const DEFAULT_MARKETING_COUNTRY_CODE = "ru"

export function resolveMarketingCountryCode(customerMetadata: unknown): string {
  const metadata =
    customerMetadata && typeof customerMetadata === "object"
      ? (customerMetadata as Record<string, unknown>)
      : {}
  const marketing =
    metadata.marketing && typeof metadata.marketing === "object"
      ? (metadata.marketing as Record<string, unknown>)
      : undefined
  const preferred =
    marketing && typeof marketing.preferred_country_code === "string"
      ? marketing.preferred_country_code.trim()
      : ""

  if (preferred) {
    return preferred.toLowerCase()
  }

  const fromEnv = process.env.MARKETING_DEFAULT_COUNTRY_CODE?.trim()
  if (fromEnv) {
    return fromEnv.toLowerCase()
  }

  return DEFAULT_MARKETING_COUNTRY_CODE
}

type SendMarketingCampaignInput = {
  campaignId: string
  launchedBy?: string | null
}

type DeliveryDecisionReason =
  | "campaign_not_found"
  | "campaign_not_launchable"
  | "global_unsubscribe"
  | "channel_unsubscribe"
  | "suppressed_until"
  | "missing_recipient_binding"
  | "frequency_cap_exceeded"
  | "channel_runtime_disabled"
  | "notification_create_failed"
  | null

type SendMarketingCampaignResult = {
  status: "completed" | "failed"
  reason: DeliveryDecisionReason | "campaign_processing_failed"
  campaign_id: string
  campaign_status: string | null
  channel: string | null
  launched_by: string | null
  launched_at: string | null
  total_selected: number
  total_sent: number
  total_skipped: number
  total_failed: number
  journal: MarketingDeliveryJournalRecord[]
}

type SendMarketingCampaignOutput = {
  result: SendMarketingCampaignResult
}

type ChannelRuntimeSnapshot =
  | {
      channel: "email"
      requested: string
      resolved: string
      enabled: boolean
      from: string | null
    }
  | {
      channel: "sms"
      requested: string
      resolved: string
      enabled: boolean
      from: string | null
    }
  | {
      channel: "vk"
      requested: string
      resolved: string
      enabled: boolean
      from: string | null
    }

function getChannelRuntime(channel: MarketingCampaignRecord["channel"]): ChannelRuntimeSnapshot {
  if (channel === "sms") {
    const runtime = getNotificationSmsRuntime()

    return {
      channel,
      requested: runtime.requestedProviderId,
      resolved: runtime.providerId,
      enabled: runtime.providerId === "exolve",
      from: runtime.sender || null,
    }
  }

  if (channel === "vk") {
    const runtime = getNotificationVkRuntime()

    return {
      channel,
      requested: runtime.requestedProviderId,
      resolved: runtime.providerId,
      enabled: runtime.providerId === "community",
      from: null,
    }
  }

  const runtime = getNotificationEmailRuntime()

  return {
    channel: "email",
    requested: runtime.requestedProviderId,
    resolved: runtime.providerId,
    enabled: true,
    from: resolveMarketingEmailFrom(runtime) || runtime.from,
  }
}

function getCampaignMessage(campaign: MarketingCampaignRecord) {
  const text =
    typeof campaign.content.text === "string" && campaign.content.text.trim()
      ? campaign.content.text.trim()
      : typeof campaign.content.message === "string" &&
          campaign.content.message.trim()
        ? campaign.content.message.trim()
        : `Marketing campaign: ${campaign.name}`

  const html =
    typeof campaign.content.html === "string" && campaign.content.html.trim()
      ? campaign.content.html.trim()
      : `<p>${escapeHtml(text)}</p>`

  const subject =
    campaign.subject?.trim() ||
    (typeof campaign.content.subject === "string" && campaign.content.subject.trim()) ||
    campaign.name

  return {
    subject,
    text,
    html,
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

type EmailUnsubscribeContext = {
  httpsUrl: string
  mailtoUrl: string | null
  footerText: string
  footerLinkLabel: string
}

function buildListUnsubscribeHeaderValue(
  context: EmailUnsubscribeContext
): string {
  const parts: string[] = []

  if (context.mailtoUrl) {
    parts.push(`<mailto:${context.mailtoUrl}>`)
  }

  parts.push(`<${context.httpsUrl}>`)

  return parts.join(", ")
}

function buildMarketingEmailContent(
  campaign: MarketingCampaignRecord,
  unsubscribeContext: EmailUnsubscribeContext | null
) {
  const message = getCampaignMessage(campaign)

  if (!unsubscribeContext) {
    return {
      subject: message.subject,
      text: message.text,
      html: message.html,
    }
  }

  // Wrap the raw campaign content into a branded template so the
  // per-recipient unsubscribe appendix sits in a consistent footer.
  const rendered = renderBrandedEmail({
    preheader: message.subject,
    heading: message.subject,
    intro: message.text,
    body: null,
    footer: null,
    footerAppend: {
      text: unsubscribeContext.footerText,
      url: unsubscribeContext.httpsUrl,
      linkLabel: unsubscribeContext.footerLinkLabel,
    },
  })

  // If campaign supplied custom html, prefer it but still append the
  // unsubscribe footer as a plain paragraph to keep CAN-SPAM posture.
  if (
    typeof campaign.content.html === "string" &&
    campaign.content.html.trim()
  ) {
    const unsubscribeHtml = `<p style="margin:16px 0 0 0;padding:0;color:#9ca3af;font-size:12px;line-height:1.5;">${escapeHtml(
      unsubscribeContext.footerText
    )} — <a href="${escapeHtml(unsubscribeContext.httpsUrl)}">${escapeHtml(
      unsubscribeContext.footerLinkLabel
    )}</a></p>`

    return {
      subject: message.subject,
      text: `${message.text}\n\n${unsubscribeContext.footerText}: ${unsubscribeContext.httpsUrl}`,
      html: `${campaign.content.html.trim()}\n${unsubscribeHtml}`,
    }
  }

  return {
    subject: message.subject,
    text: rendered.text,
    html: rendered.html,
  }
}

function buildNotificationPayload(args: {
  campaign: MarketingCampaignRecord
  customerId: string
  recipient: string
  runtime: ChannelRuntimeSnapshot
  unsubscribeContext?: EmailUnsubscribeContext | null
}): CreateNotificationDTO {
  const { campaign, customerId, recipient, runtime } = args
  const unsubscribeContext = args.unsubscribeContext ?? null
  const message = getCampaignMessage(campaign)
  const baseData = {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    customer_id: customerId,
    recipient,
    audience_type: campaign.audience_type,
    provider_requested: runtime.requested,
    provider_resolved: runtime.resolved,
    marketing: true,
  }

  if (campaign.channel === "sms") {
    return {
      to: recipient,
      from: runtime.from || undefined,
      channel: DEFAULT_NOTIFICATION_SMS_CHANNEL,
      template: campaign.template,
      trigger_type: DEFAULT_MARKETING_TRIGGER_TYPE,
      resource_type: DEFAULT_MARKETING_RESOURCE_TYPE,
      resource_id: campaign.id,
      content: {
        text: message.text,
      },
      data: {
        ...baseData,
        text: message.text,
      },
    }
  }

  if (campaign.channel === "vk") {
    return {
      to: recipient,
      channel: "vk",
      template: campaign.template,
      trigger_type: DEFAULT_MARKETING_TRIGGER_TYPE,
      resource_type: DEFAULT_MARKETING_RESOURCE_TYPE,
      resource_id: campaign.id,
      content: {
        text: message.text,
      },
      data: {
        ...baseData,
        text: message.text,
      },
    }
  }

  const emailContent = buildMarketingEmailContent(campaign, unsubscribeContext)
  const headers: Record<string, string> = {}

  if (unsubscribeContext) {
    headers["List-Unsubscribe"] = buildListUnsubscribeHeaderValue(unsubscribeContext)
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    headers["X-Campaign-Id"] = campaign.id
  }

  return {
    to: recipient,
    from: runtime.from || undefined,
    channel: "email",
    template: campaign.template,
    trigger_type: DEFAULT_MARKETING_TRIGGER_TYPE,
    resource_type: DEFAULT_MARKETING_RESOURCE_TYPE,
    resource_id: campaign.id,
    content: {
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    },
    data: {
      ...baseData,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      ...(unsubscribeContext
        ? {
            unsubscribe_url: unsubscribeContext.httpsUrl,
            unsubscribe_mailto: unsubscribeContext.mailtoUrl,
            headers,
          }
        : {}),
    },
  }
}

const sendMarketingCampaignStep = createStep(
  "send-marketing-campaign-step",
  async (input: SendMarketingCampaignInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const pgConnection = getMarketingPgConnection(container)
    const existingCampaign = await getMarketingCampaignById(
      pgConnection,
      input.campaignId
    )

    if (!existingCampaign) {
      logger.warn(
        `[marketing-campaign] skip reason=campaign_not_found campaign_id=${input.campaignId}`
      )

      return new StepResponse<SendMarketingCampaignResult>({
        status: "failed",
        reason: "campaign_not_found",
        campaign_id: input.campaignId,
        campaign_status: null,
        channel: null,
        launched_by: input.launchedBy?.trim() || null,
        launched_at: null,
        total_selected: 0,
        total_sent: 0,
        total_skipped: 0,
        total_failed: 0,
        journal: [],
      })
    }

    if (existingCampaign.status !== "draft") {
      logger.warn(
        `[marketing-campaign] skip reason=campaign_not_launchable campaign_id=${existingCampaign.id} status=${existingCampaign.status}`
      )

      return new StepResponse<SendMarketingCampaignResult>({
        status: "failed",
        reason: "campaign_not_launchable",
        campaign_id: existingCampaign.id,
        campaign_status: existingCampaign.status,
        channel: existingCampaign.channel,
        launched_by: input.launchedBy?.trim() || null,
        launched_at: existingCampaign.launched_at,
        total_selected: existingCampaign.total_selected,
        total_sent: existingCampaign.total_sent,
        total_skipped: existingCampaign.total_skipped,
        total_failed: 0,
        journal: [],
      })
    }

    const launchedAt = new Date().toISOString()
    const campaign = await claimMarketingCampaignForLaunch(pgConnection, {
      campaignId: existingCampaign.id,
      launchedAt,
    })

    if (!campaign) {
      const currentCampaign = await getMarketingCampaignById(
        pgConnection,
        existingCampaign.id
      )

      logger.warn(
        `[marketing-campaign] skip reason=campaign_not_launchable campaign_id=${existingCampaign.id} status=${currentCampaign?.status || "missing"}`
      )

      return new StepResponse<SendMarketingCampaignResult>({
        status: "failed",
        reason: "campaign_not_launchable",
        campaign_id: existingCampaign.id,
        campaign_status: currentCampaign?.status || null,
        channel: currentCampaign?.channel || existingCampaign.channel,
        launched_by: input.launchedBy?.trim() || null,
        launched_at: currentCampaign?.launched_at || existingCampaign.launched_at,
        total_selected:
          currentCampaign?.total_selected ?? existingCampaign.total_selected,
        total_sent: currentCampaign?.total_sent ?? existingCampaign.total_sent,
        total_skipped:
          currentCampaign?.total_skipped ?? existingCampaign.total_skipped,
        total_failed: currentCampaign?.total_failed ?? existingCampaign.total_failed,
        journal: [],
      })
    }

    try {
      const runtime = getChannelRuntime(campaign.channel)
      const audience = await resolveMarketingAudience(query, campaign)
      const journal: MarketingDeliveryJournalRecord[] = []
      let sentCount = 0
      let skippedCount = 0
      let failedCount = 0

      const unsubscribeRuntime = getMarketingUnsubscribeRuntime()
      const marketingStorefrontUrl = resolveStorefrontUrl()
      const unsubscribeMailto = resolveMarketingUnsubscribeMailto()
      const isEmailChannel = campaign.channel === "email"

      for (const entry of audience) {
        const recipientBinding = entry.bindings[campaign.channel]
        const customerId = entry.customer.id
        const recipient = recipientBinding.recipient
        const recipientSnapshot = recipientBinding.recipient_snapshot

        let decisionReason: DeliveryDecisionReason = null

        if (!isCustomerGloballySubscribed(entry.preferences)) {
          decisionReason = "global_unsubscribe"
        } else if (!isCustomerChannelSubscribed(entry.preferences, campaign.channel)) {
          decisionReason = "channel_unsubscribe"
        } else if (isMarketingSuppressedNow(entry.preferences)) {
          decisionReason = "suppressed_until"
        } else if (!recipientBinding.available || !recipient) {
          decisionReason = "missing_recipient_binding"
        } else if (!runtime.enabled) {
          decisionReason = "channel_runtime_disabled"
        } else {
          const lookbackStart = new Date(
            Date.now() - campaign.frequency_cap_window_hours * 60 * 60 * 1000
          ).toISOString()
          const recentCount = await countRecentMarketingDeliveries(pgConnection, {
            customerId,
            channel: campaign.channel,
            since: lookbackStart,
          })

          if (recentCount >= campaign.frequency_cap_count) {
            decisionReason = "frequency_cap_exceeded"
          }
        }

        if (decisionReason) {
          const journalEntry = await insertMarketingDeliveryJournal(pgConnection, {
            campaignId: campaign.id,
            customerId,
            channel: campaign.channel,
            recipient,
            recipientSnapshot,
            deliveryStatus: "skipped",
            decisionReason,
            template: campaign.template,
            payload: {
              campaign_id: campaign.id,
              customer_id: customerId,
              provider_requested: runtime.requested,
              provider_resolved: runtime.resolved,
            },
          })

          journal.push(journalEntry)
          skippedCount += 1
          continue
        }

        let unsubscribeContext: EmailUnsubscribeContext | null = null
        let rotatedMetadataForPersist: Record<string, unknown> | null = null

        if (isEmailChannel && marketingStorefrontUrl) {
          try {
            const rawUnsubscribeToken = generateUnsubscribeToken()
            const unsubscribeTokenHash = hashUnsubscribeToken(rawUnsubscribeToken)
            const unsubscribePublicToken = buildPublicUnsubscribeToken(
              customerId,
              rawUnsubscribeToken
            )

            // Build rotated metadata in-memory but DO NOT persist yet — we only
            // want to rotate the unsubscribe token on the customer record if the
            // email actually leaves the system. Otherwise a failing SMTP would
            // invalidate the previously-working unsubscribe link, which breaks
            // CAN-SPAM expectations for the customer.
            rotatedMetadataForPersist = buildUnsubscribeIssueMetadata({
              currentMetadata: entry.customer.metadata,
              tokenHash: unsubscribeTokenHash,
              ttlDays: unsubscribeRuntime.tokenTtlDays,
            })

            const httpsUrl = buildUnsubscribeUrl({
              storefrontUrl: marketingStorefrontUrl,
              countryCode: resolveMarketingCountryCode(entry.customer.metadata),
              redirectPath: unsubscribeRuntime.redirectPath,
              token: unsubscribePublicToken,
              channels: [campaign.channel],
              listId: campaign.id,
            })

            unsubscribeContext = {
              httpsUrl,
              mailtoUrl: unsubscribeMailto,
              footerText: "Отписаться от рассылки",
              footerLinkLabel: "Отписаться",
            }
          } catch (tokenError) {
            const tokenMessage =
              tokenError instanceof Error
                ? tokenError.message
                : "unsubscribe_token_generation_failed"

            logger.warn(
              `[marketing-campaign] unsubscribe token build failed campaign_id=${campaign.id} customer_id=${customerId} error=${tokenMessage}`
            )
            unsubscribeContext = null
            rotatedMetadataForPersist = null
          }
        }

        try {
          const notification = (await notificationModuleService.createNotifications(
            buildNotificationPayload({
              campaign,
              customerId,
              recipient: recipient as string,
              runtime,
              unsubscribeContext,
            })
          )) as NotificationDTO

          const journalEntry = await insertMarketingDeliveryJournal(pgConnection, {
            campaignId: campaign.id,
            customerId,
            channel: campaign.channel,
            recipient,
            recipientSnapshot,
            deliveryStatus: "sent",
            decisionReason: null,
            notificationId: notification.id,
            template: campaign.template,
            payload: {
              campaign_id: campaign.id,
              customer_id: customerId,
              notification_id: notification.id,
              provider_requested: runtime.requested,
              provider_resolved: runtime.resolved,
            },
          })

          try {
            // Only persist the rotated unsubscribe token hash + last_sent update
            // after a confirmed successful send. If rotation metadata is present,
            // fold the send-side update on top so a single write captures both.
            const sourceCustomerForSendUpdate = rotatedMetadataForPersist
              ? { ...entry.customer, metadata: rotatedMetadataForPersist }
              : entry.customer
            const mergedMetadata = applyMarketingSendMetadataUpdate(
              sourceCustomerForSendUpdate,
              launchedAt
            )

            await persistCustomerMarketingMetadata(
              container,
              customerId,
              mergedMetadata
            )
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "marketing_metadata_persist_failed"

            logger.warn(
              `[marketing-campaign] metadata update failed campaign_id=${campaign.id} customer_id=${customerId} error=${message}`
            )
          }

          journal.push(journalEntry)
          sentCount += 1
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "unknown_notification_error"

          const journalEntry = await insertMarketingDeliveryJournal(pgConnection, {
            campaignId: campaign.id,
            customerId,
            channel: campaign.channel,
            recipient,
            recipientSnapshot,
            deliveryStatus: "failed",
            decisionReason: "notification_create_failed",
            template: campaign.template,
            payload: {
              campaign_id: campaign.id,
              customer_id: customerId,
              provider_requested: runtime.requested,
              provider_resolved: runtime.resolved,
              error: message,
            },
          })

          journal.push(journalEntry)
          failedCount += 1
        }
      }

      await updateMarketingCampaignStatus(pgConnection, {
        campaignId: campaign.id,
        status: failedCount > 0 && sentCount === 0 ? "failed" : "completed",
        completedAt: new Date().toISOString(),
        lastError:
          failedCount > 0 && sentCount === 0
            ? "marketing campaign finished with delivery failures"
            : null,
        totalSelected: audience.length,
        totalSent: sentCount,
        totalSkipped: skippedCount,
        totalFailed: failedCount,
      })

      logger.info(
        `[marketing-campaign] completed campaign_id=${campaign.id} channel=${campaign.channel} selected=${audience.length} sent=${sentCount} skipped=${skippedCount} failed=${failedCount}`
      )

      return new StepResponse<SendMarketingCampaignResult>({
        status: failedCount > 0 && sentCount === 0 ? "failed" : "completed",
        reason: failedCount > 0 && sentCount === 0 ? "notification_create_failed" : null,
        campaign_id: campaign.id,
        campaign_status: failedCount > 0 && sentCount === 0 ? "failed" : "completed",
        channel: campaign.channel,
        launched_by: input.launchedBy?.trim() || null,
        launched_at: launchedAt,
        total_selected: audience.length,
        total_sent: sentCount,
        total_skipped: skippedCount,
        total_failed: failedCount,
        journal,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "campaign_processing_failed"

      await updateMarketingCampaignStatus(pgConnection, {
        campaignId: campaign.id,
        status: "failed",
        completedAt: new Date().toISOString(),
        lastError: message,
      })

      logger.warn(
        `[marketing-campaign] failed campaign_id=${campaign.id} error=${message}`
      )

      return new StepResponse<SendMarketingCampaignResult>({
        status: "failed",
        reason: "campaign_processing_failed",
        campaign_id: campaign.id,
        campaign_status: "failed",
        channel: campaign.channel,
        launched_by: input.launchedBy?.trim() || null,
        launched_at: launchedAt,
        total_selected: 0,
        total_sent: 0,
        total_skipped: 0,
        total_failed: 0,
        journal: [],
      })
    }
  }
)

const sendMarketingCampaignWorkflow = createWorkflow(
  "send-marketing-campaign-workflow",
  (input: SendMarketingCampaignInput) => {
    const result = sendMarketingCampaignStep(input)

    return new WorkflowResponse<SendMarketingCampaignOutput>({
      result,
    })
  }
)

export default sendMarketingCampaignWorkflow
