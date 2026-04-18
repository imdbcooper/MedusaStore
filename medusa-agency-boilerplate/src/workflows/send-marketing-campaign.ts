import type { CreateNotificationDTO, NotificationDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
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
    from: runtime.from,
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

function buildNotificationPayload(args: {
  campaign: MarketingCampaignRecord
  customerId: string
  recipient: string
  runtime: ChannelRuntimeSnapshot
}): CreateNotificationDTO {
  const { campaign, customerId, recipient, runtime } = args
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

  return {
    to: recipient,
    from: runtime.from || undefined,
    channel: "email",
    template: campaign.template,
    trigger_type: DEFAULT_MARKETING_TRIGGER_TYPE,
    resource_type: DEFAULT_MARKETING_RESOURCE_TYPE,
    resource_id: campaign.id,
    content: {
      subject: message.subject,
      text: message.text,
      html: message.html,
    },
    data: {
      ...baseData,
      subject: message.subject,
      text: message.text,
      html: message.html,
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
    const campaign = await getMarketingCampaignById(pgConnection, input.campaignId)

    if (!campaign) {
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

    if (campaign.status !== "draft") {
      logger.warn(
        `[marketing-campaign] skip reason=campaign_not_launchable campaign_id=${campaign.id} status=${campaign.status}`
      )

      return new StepResponse<SendMarketingCampaignResult>({
        status: "failed",
        reason: "campaign_not_launchable",
        campaign_id: campaign.id,
        campaign_status: campaign.status,
        channel: campaign.channel,
        launched_by: input.launchedBy?.trim() || null,
        launched_at: campaign.launched_at,
        total_selected: campaign.total_selected,
        total_sent: campaign.total_sent,
        total_skipped: campaign.total_skipped,
        total_failed: 0,
        journal: [],
      })
    }

    const launchedAt = new Date().toISOString()

    await updateMarketingCampaignStatus(pgConnection, {
      campaignId: campaign.id,
      status: "running",
      launchedAt,
      completedAt: null,
      lastError: null,
      totalSelected: 0,
      totalSent: 0,
      totalSkipped: 0,
    })

    try {
      const runtime = getChannelRuntime(campaign.channel)
      const audience = await resolveMarketingAudience(query, campaign)
      const journal: MarketingDeliveryJournalRecord[] = []
      let sentCount = 0
      let skippedCount = 0
      let failedCount = 0

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

        try {
          const notification = (await notificationModuleService.createNotifications(
            buildNotificationPayload({
              campaign,
              customerId,
              recipient: recipient as string,
              runtime,
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
            await persistCustomerMarketingMetadata(
              container,
              customerId,
              applyMarketingSendMetadataUpdate(entry.customer, launchedAt)
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
        totalSkipped: skippedCount + failedCount,
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
