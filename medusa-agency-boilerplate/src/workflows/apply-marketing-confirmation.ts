import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import {
  buildChannelConfirmedMetadata,
  getMarketingCustomerById,
  type MarketingChannel,
  type MarketingChannelConfirmationFailureReason,
  MARKETING_CHANNEL_CONFIRMATION_FAILURE_REASONS,
  parsePublicConfirmationToken,
  sanitizeMarketingLogValue,
  verifyConfirmationToken,
} from "../modules/marketing-preferences"

type ApplyMarketingConfirmationInput = {
  token: string
}

export type ApplyMarketingConfirmationResult =
  | {
      status: "confirmed"
      reason: null
      customer_id: string
      channel: MarketingChannel
    }
  | {
      status: "failed"
      reason: MarketingChannelConfirmationFailureReason
      customer_id: string | null
      channel: MarketingChannel | null
    }

export type ApplyMarketingConfirmationOutput = {
  result: ApplyMarketingConfirmationResult
}

const applyMarketingConfirmationStep = createStep(
  "apply-marketing-confirmation-step",
  async (input: ApplyMarketingConfirmationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const parsed = parsePublicConfirmationToken(input.token)

    if (!parsed.ok) {
      logger.info(
        `[marketing-confirmation] apply failed reason=${parsed.reason} token_length=${input.token?.length ?? 0}`
      )

      return new StepResponse<ApplyMarketingConfirmationResult>({
        status: "failed",
        reason: parsed.reason,
        customer_id: null,
        channel: null,
      })
    }

    const customer = await getMarketingCustomerById(query, parsed.customerId)

    if (!customer) {
      logger.info(
        `[marketing-confirmation] apply failed reason=customer_not_found customer_id=${sanitizeMarketingLogValue(parsed.customerId)}`
      )

      return new StepResponse<ApplyMarketingConfirmationResult>({
        status: "failed",
        reason: "customer_not_found",
        customer_id: parsed.customerId,
        channel: parsed.channel,
      })
    }

    const verification = verifyConfirmationToken({
      customer,
      channel: parsed.channel,
      rawToken: parsed.rawToken,
    })

    if (!verification.ok) {
      const reason: MarketingChannelConfirmationFailureReason =
        (MARKETING_CHANNEL_CONFIRMATION_FAILURE_REASONS as readonly string[]).includes(
          verification.reason
        )
          ? verification.reason
          : "token_mismatch"

      logger.info(
        `[marketing-confirmation] apply failed reason=${reason} customer_id=${sanitizeMarketingLogValue(customer.id)} channel=${parsed.channel}`
      )

      return new StepResponse<ApplyMarketingConfirmationResult>({
        status: "failed",
        reason,
        customer_id: customer.id,
        channel: parsed.channel,
      })
    }

    const nextMetadata = buildChannelConfirmedMetadata({
      customer,
      channel: parsed.channel,
      source: "storefront",
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

    logger.info(
      `[marketing-confirmation] apply success customer_id=${sanitizeMarketingLogValue(customer.id)} channel=${parsed.channel}`
    )

    return new StepResponse<ApplyMarketingConfirmationResult>({
      status: "confirmed",
      reason: null,
      customer_id: customer.id,
      channel: parsed.channel,
    })
  }
)

const applyMarketingConfirmationWorkflow = createWorkflow(
  "apply-marketing-confirmation-workflow",
  (input: ApplyMarketingConfirmationInput) => {
    const result = applyMarketingConfirmationStep(input)

    return new WorkflowResponse<ApplyMarketingConfirmationOutput>({
      result,
    })
  }
)

export default applyMarketingConfirmationWorkflow
export { applyMarketingConfirmationStep }
