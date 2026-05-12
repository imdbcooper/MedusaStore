import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import {
  buildChannelUnsubscribedMetadata,
  getMarketingCustomerById,
  MARKETING_CHANNELS,
  sanitizeMarketingLogValue,
  type MarketingChannel,
  type MarketingCustomerRecord,
} from "../modules/marketing-preferences"
import {
  buildUnsubscribeConsumeMetadata,
  parsePublicUnsubscribeToken,
  verifyUnsubscribeToken,
  type MarketingUnsubscribeFailureReason,
} from "../modules/marketing-unsubscribe"

type ApplyMarketingUnsubscribeInput = {
  token: string
  channels?: MarketingChannel[] | null
}

/**
 * Unsubscribe is idempotent: even failures return a generic `failed` status
 * with a sanitized reason; the route-level handler never surfaces reason to
 * the client (generic `ok: true`). Failure reason is only for internal logs
 * and tests.
 */
export type ApplyMarketingUnsubscribeResult = {
  status: "applied" | "failed"
  reason: MarketingUnsubscribeFailureReason | null
  customer_id: string | null
  channels_applied: MarketingChannel[]
}

export type ApplyMarketingUnsubscribeOutput = {
  result: ApplyMarketingUnsubscribeResult
}

function normalizeRequestedChannels(
  channels?: MarketingChannel[] | null
): MarketingChannel[] {
  if (!Array.isArray(channels) || !channels.length) {
    // Default: unsubscribe from email only. Keep SMS/VK intact unless
    // explicitly requested. This matches CAN-SPAM/GDPR expectations where
    // email is the primary marketing channel.
    return ["email"]
  }

  const allowed = new Set<MarketingChannel>()

  for (const candidate of channels) {
    if (
      typeof candidate === "string" &&
      (MARKETING_CHANNELS as readonly string[]).includes(candidate)
    ) {
      allowed.add(candidate as MarketingChannel)
    }
  }

  if (!allowed.size) {
    return ["email"]
  }

  return Array.from(allowed)
}

const applyMarketingUnsubscribeStep = createStep(
  "apply-marketing-unsubscribe-step",
  async (input: ApplyMarketingUnsubscribeInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const parsed = parsePublicUnsubscribeToken(input.token)

    if (!parsed.ok) {
      logger.info(
        `[marketing-unsubscribe] apply failed reason=${parsed.reason} token_length=${input.token?.length ?? 0}`
      )

      return new StepResponse<ApplyMarketingUnsubscribeResult>({
        status: "failed",
        reason: parsed.reason,
        customer_id: null,
        channels_applied: [],
      })
    }

    const customer = await getMarketingCustomerById(query, parsed.customerId)

    if (!customer) {
      logger.info(
        `[marketing-unsubscribe] apply failed reason=customer_not_found customer_id=${sanitizeMarketingLogValue(parsed.customerId)}`
      )

      return new StepResponse<ApplyMarketingUnsubscribeResult>({
        status: "failed",
        reason: "customer_not_found",
        customer_id: parsed.customerId,
        channels_applied: [],
      })
    }

    const verification = verifyUnsubscribeToken({
      customer: customer as MarketingCustomerRecord,
      rawToken: parsed.rawToken,
    })

    if (!verification.ok) {
      logger.info(
        `[marketing-unsubscribe] apply failed reason=${verification.reason} customer_id=${sanitizeMarketingLogValue(customer.id)}`
      )

      return new StepResponse<ApplyMarketingUnsubscribeResult>({
        status: "failed",
        reason: verification.reason,
        customer_id: customer.id,
        channels_applied: [],
      })
    }

    const channelsToApply = normalizeRequestedChannels(input.channels)
    let runningMetadata: Record<string, unknown> | null = null
    const baseCustomer: MarketingCustomerRecord = customer

    for (const channel of channelsToApply) {
      const effectiveCustomer: MarketingCustomerRecord = runningMetadata
        ? { ...baseCustomer, metadata: runningMetadata }
        : baseCustomer

      runningMetadata = buildChannelUnsubscribedMetadata({
        customer: effectiveCustomer,
        channel,
        source: "unsubscribe_link",
      })
    }

    // Consume unsubscribe token to prevent reuse. This runs on the latest
    // in-memory metadata so single-transaction persist captures both the
    // channel transitions and the token consumption.
    const consumedMetadata = buildUnsubscribeConsumeMetadata({
      currentMetadata: runningMetadata ?? baseCustomer.metadata,
    })

    await updateCustomersWorkflow(container).run({
      input: {
        selector: {
          id: [customer.id],
        },
        update: {
          metadata: consumedMetadata,
        },
      },
    })

    logger.info(
      `[marketing-unsubscribe] apply success customer_id=${sanitizeMarketingLogValue(customer.id)} channels=${channelsToApply.join(",")}`
    )

    return new StepResponse<ApplyMarketingUnsubscribeResult>({
      status: "applied",
      reason: null,
      customer_id: customer.id,
      channels_applied: channelsToApply,
    })
  }
)

const applyMarketingUnsubscribeWorkflow = createWorkflow(
  "apply-marketing-unsubscribe-workflow",
  (input: ApplyMarketingUnsubscribeInput) => {
    const result = applyMarketingUnsubscribeStep(input)

    return new WorkflowResponse<ApplyMarketingUnsubscribeOutput>({
      result,
    })
  }
)

export default applyMarketingUnsubscribeWorkflow
export { applyMarketingUnsubscribeStep }
