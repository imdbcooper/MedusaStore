import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  MARKETING_CHANNELS,
  MARKETING_GLOBAL_STATUS_VALUES,
  MARKETING_MUTABLE_CHANNEL_STATUS_VALUES,
  STOREFRONT_MARKETING_SOURCE,
  buildCustomerMarketingMetadata,
  getMarketingCustomerById,
  persistCustomerMarketingMetadata,
  resolveMarketingPreferences,
  sanitizeMarketingLogValue,
  type MarketingChannel,
} from "../../../../../modules/marketing-preferences"
import sendMarketingConfirmationWorkflow from "../../../../../workflows/send-marketing-confirmation"

export const StoreCustomerMarketingPreferencesSchema = z.object({
  global_status: z.enum(MARKETING_GLOBAL_STATUS_VALUES).optional(),
  channels: z
    .object({
      email: z
        .object({
          status: z.enum(MARKETING_MUTABLE_CHANNEL_STATUS_VALUES).optional(),
        })
        .optional(),
      sms: z
        .object({
          status: z.enum(MARKETING_MUTABLE_CHANNEL_STATUS_VALUES).optional(),
        })
        .optional(),
      vk: z
        .object({
          status: z.enum(MARKETING_MUTABLE_CHANNEL_STATUS_VALUES).optional(),
        })
        .optional(),
    })
    .optional(),
  country_code: z.string().trim().min(1).max(8).nullable().optional(),
})

type StoreCustomerMarketingPreferencesRequestBody = z.infer<
  typeof StoreCustomerMarketingPreferencesSchema
>

/**
 * Channels that require double opt-in before marketing sends are allowed.
 * Only email is in scope for Phase 4; SMS/VK remain single-toggle until a
 * confirmation flow is designed for those channels.
 */
const DOUBLE_OPTIN_CHANNELS = new Set<MarketingChannel>(["email"])

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customer = await getMarketingCustomerById(query, customerId)

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
    })
    return
  }

  const resolution = resolveMarketingPreferences(customer.metadata, customer)

  res.status(200).json({
    ok: true,
    customer_id: customer.id,
    marketing: resolution.preferences,
    bindings: resolution.bindings,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<StoreCustomerMarketingPreferencesRequestBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customer = await getMarketingCustomerById(query, customerId)

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
    })
    return
  }

  const currentResolution = resolveMarketingPreferences(
    customer.metadata,
    customer
  )

  // Compute which double-opt-in channels are transitioning from a
  // non-confirmed state to a requested "subscribed" state. These must go
  // through the confirmation flow instead of flipping straight to
  // subscribed.
  const confirmationTargets: MarketingChannel[] = []

  for (const channel of MARKETING_CHANNELS) {
    if (!DOUBLE_OPTIN_CHANNELS.has(channel)) {
      continue
    }

    const requestedStatus = req.validatedBody.channels?.[channel]?.status

    if (requestedStatus !== "subscribed") {
      continue
    }

    const currentStatus = currentResolution.preferences.channels[channel].status

    if (currentStatus === "subscribed") {
      continue
    }

    confirmationTargets.push(channel)
  }

  // Filter the straight-apply channels so we do not blindly flip a
  // double-opt-in channel to "subscribed"; those get queued as "pending"
  // by the confirmation workflow below.
  const filteredChannels: StoreCustomerMarketingPreferencesRequestBody["channels"] =
    {}

  for (const channel of MARKETING_CHANNELS) {
    const requested = req.validatedBody.channels?.[channel]
    if (!requested) {
      continue
    }

    if (
      DOUBLE_OPTIN_CHANNELS.has(channel) &&
      requested.status === "subscribed" &&
      confirmationTargets.includes(channel)
    ) {
      // Skip — will be handled by the confirmation workflow.
      continue
    }

    filteredChannels[channel] = requested
  }

  const nextMetadata = buildCustomerMarketingMetadata(customer, {
    global_status: req.validatedBody.global_status || null,
    channels: filteredChannels,
    source: STOREFRONT_MARKETING_SOURCE,
  })

  await persistCustomerMarketingMetadata(req.scope, customer.id, nextMetadata)

  // Trigger the confirmation flow for every requested double-opt-in
  // channel. Workflow builds its own `pending` state + token hash and
  // persists it on customer.metadata. Errors are swallowed here so the
  // client still gets a coherent response; the workflow logs failures.
  const confirmationsSent: MarketingChannel[] = []

  for (const channel of confirmationTargets) {
    try {
      const { result } = await sendMarketingConfirmationWorkflow(req.scope).run(
        {
          input: {
            customerId: customer.id,
            channel,
            countryCode: req.validatedBody.country_code || null,
            source: STOREFRONT_MARKETING_SOURCE,
          },
        }
      )

      if (result.result.status === "sent") {
        confirmationsSent.push(channel)
      } else {
        logger.info(
          `[marketing-confirmation] send skipped channel=${channel} reason=${result.result.reason} customer_id=${sanitizeMarketingLogValue(customer.id)}`
        )
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown_workflow_error"

      logger.warn(
        `[marketing-confirmation] send failed channel=${channel} customer_id=${sanitizeMarketingLogValue(customer.id)} error=${sanitizeMarketingLogValue(message)}`
      )
    }
  }

  const updatedCustomer = await getMarketingCustomerById(query, customer.id)
  const resolution = resolveMarketingPreferences(
    updatedCustomer?.metadata || nextMetadata,
    updatedCustomer || {
      ...customer,
      metadata: nextMetadata,
    }
  )

  res.status(200).json({
    ok: true,
    customer_id: customer.id,
    marketing: resolution.preferences,
    bindings: resolution.bindings,
    updated_channels: MARKETING_CHANNELS.filter((channel) => {
      return Boolean(req.validatedBody.channels?.[channel])
    }),
    confirmation_pending: confirmationTargets,
    confirmation_sent: confirmationsSent,
  })
}
