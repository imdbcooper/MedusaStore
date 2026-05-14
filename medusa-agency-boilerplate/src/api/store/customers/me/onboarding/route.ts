import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import {
  isPlaceholderEmail,
  lookupCustomerByEmail,
} from "../../../../../modules/vk-id"

/**
 * Validation schema for the onboarding endpoint.
 *
 * - `email` is REQUIRED for completion when the customer's current email is a
 *   VK placeholder (handler enforces this; schema keeps it optional for the
 *   forward-compatible "phone-only update" path on customers who already have
 *   a real email — currently rejected by handler with `email_already_set`).
 * - `phone` is OPTIONAL. The customer can leave it blank and complete
 *   onboarding with email only; phone can be added later in profile or at
 *   checkout.
 *
 * Phone normalization: we accept user-friendly inputs like
 * "+7 (900) 123-45-67" or "8 900 123-45-67" by stripping spaces, dashes and
 * parentheses BEFORE regex validation, so the form's placeholder format and
 * realistic clipboard pastes pass.
 */
const PHONE_NORMALIZE_RE = /[\s\-()]/g
const PHONE_VALIDATE_RE = /^(?:\+7\d{10}|8\d{10}|\+\d{10,15})$/

export const StoreOnboardingSchema = z
  .object({
    email: z.string().trim().email("Invalid email format").max(255).optional(),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(PHONE_NORMALIZE_RE, ""))
      .refine((v) => v === "" || PHONE_VALIDATE_RE.test(v), {
        message:
          "Invalid phone format. Use E.164 or Russian format (+7XXXXXXXXXX or 8XXXXXXXXXX)",
      })
      .optional(),
  })
  .strict()

export type StoreOnboardingRequestBody = z.infer<typeof StoreOnboardingSchema>

type OnboardingMetadata = {
  status: "pending" | "complete"
  missing_fields: string[]
  placeholder_email: boolean
  vk_phone_verified?: boolean
  created_at?: string
  completed_at?: string
}

function readOnboardingMetadata(metadata: unknown): OnboardingMetadata | null {
  if (!metadata || typeof metadata !== "object") return null
  const root = metadata as Record<string, unknown>
  const onboarding = root.onboarding
  if (!onboarding || typeof onboarding !== "object") return null
  const ob = onboarding as Record<string, unknown>
  if (ob.status !== "pending" && ob.status !== "complete") return null
  return {
    status: ob.status as "pending" | "complete",
    missing_fields: Array.isArray(ob.missing_fields)
      ? (ob.missing_fields as string[])
      : [],
    placeholder_email: Boolean(ob.placeholder_email),
    vk_phone_verified: Boolean(ob.vk_phone_verified),
    created_at: typeof ob.created_at === "string" ? ob.created_at : undefined,
    completed_at:
      typeof ob.completed_at === "string" ? ob.completed_at : undefined,
  }
}

/**
 * POST /store/customers/me/onboarding
 *
 * Completes VK ID post-registration onboarding.
 *
 * Contract:
 * - `email` is required for completion if current customer email is a VK
 *   placeholder. Phone is optional; when not provided onboarding still
 *   completes with email only.
 * - When both fields are provided, both are saved.
 *
 * Requires authenticated customer session.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreOnboardingRequestBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
      message: "Authentication required",
    })
    return
  }

  const validatedBody = (req.validatedBody || {}) as Partial<StoreOnboardingRequestBody>
  const emailInput = validatedBody.email?.trim().toLowerCase() || null
  // Phone is already trimmed + normalized (spaces/dashes/parens stripped) by
  // the Zod transform; the schema allows the resulting empty string.
  const phoneInput =
    typeof validatedBody.phone === "string" && validatedBody.phone.length > 0
      ? validatedBody.phone
      : null

  // Fetch current customer
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  let customer: {
    id: string
    email: string
    phone: string | null
    metadata: Record<string, unknown> | null
  }

  try {
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "phone", "metadata"],
      filters: { id: [customerId] },
      pagination: { take: 1, skip: 0 },
    })

    if (!data || !data.length) {
      res.status(404).json({
        ok: false,
        code: "customer_not_found",
        message: "Customer not found",
      })
      return
    }

    customer = data[0] as typeof customer
  } catch (error) {
    logger.error(
      `[onboarding] failed to fetch customer customer_id=${customerId}`
    )
    res.status(500).json({
      ok: false,
      code: "internal_error",
      message: "Failed to fetch customer data",
    })
    return
  }

  // Read current onboarding metadata
  const onboarding = readOnboardingMetadata(customer.metadata)

  if (!onboarding || onboarding.status === "complete") {
    res.status(400).json({
      ok: false,
      code: "onboarding_already_complete",
      message: "Onboarding is already complete",
    })
    return
  }

  // Email is required when current email is still a VK placeholder. Without
  // a real email we cannot complete onboarding (email is needed for order
  // confirmations, password reset, etc).
  const currentEmailIsPlaceholder = isPlaceholderEmail(customer.email)
  if (currentEmailIsPlaceholder && !emailInput) {
    res.status(400).json({
      ok: false,
      code: "email_required",
      message: "Email is required to complete onboarding",
    })
    return
  }

  const updateData: Record<string, unknown> = {}
  // Phone is optional and never blocks completion — drop it from
  // missing_fields up front. Email is removed once a real email is saved.
  const updatedMissingFields = onboarding.missing_fields.filter(
    (field) => field !== "phone"
  )
  let updatedPlaceholderEmail = onboarding.placeholder_email

  // Handle email update
  if (emailInput) {
    if (!currentEmailIsPlaceholder) {
      res.status(400).json({
        ok: false,
        code: "email_already_set",
        message: "Customer already has a real email",
      })
      return
    }

    // Check email uniqueness
    const pgConnection = req.scope.resolve(
      ContainerRegistrationKeys.PG_CONNECTION
    )
    const existingCustomer = await lookupCustomerByEmail(
      pgConnection,
      emailInput
    )

    if (existingCustomer && existingCustomer.id !== customerId) {
      res.status(409).json({
        ok: false,
        code: "email_already_exists",
        message: "This email is already used by another account",
      })
      return
    }

    updateData.email = emailInput
    updatedPlaceholderEmail = false

    // Remove "email" from missing_fields
    const emailIdx = updatedMissingFields.indexOf("email")
    if (emailIdx !== -1) {
      updatedMissingFields.splice(emailIdx, 1)
    }
  }

  // Handle phone update (optional)
  if (phoneInput) {
    if (customer.phone) {
      // Phone already set — skip but don't error
      logger.info(
        `[onboarding] phone already set for customer_id=${customerId}, skipping`
      )
    } else {
      updateData.phone = phoneInput
    }
  }

  // Determine new onboarding status. Phone is intentionally excluded from
  // the completion gate: as long as the email is real, onboarding is done.
  const newStatus =
    updatedMissingFields.length === 0 && !updatedPlaceholderEmail
      ? "complete"
      : "pending"

  const updatedOnboarding: OnboardingMetadata = {
    ...onboarding,
    status: newStatus,
    missing_fields: updatedMissingFields,
    placeholder_email: updatedPlaceholderEmail,
    ...(newStatus === "complete"
      ? { completed_at: new Date().toISOString() }
      : {}),
  }

  // Build metadata update — merge with existing metadata
  const currentMetadata = (customer.metadata || {}) as Record<string, unknown>
  const updatedMetadata: Record<string, unknown> = {
    ...currentMetadata,
    onboarding: updatedOnboarding,
  }

  // If email was updated, also update email_verified flags
  if (updateData.email) {
    updatedMetadata.email_verified = false
    updatedMetadata.email_verified_at = null
    updatedMetadata.email_verified_for = null
  }

  // Nothing to update? This is a no-op only if email was not required.
  // (We already 400'd above when current email is a placeholder and no
  // email was provided.)
  if (Object.keys(updateData).length === 0) {
    res.status(200).json({
      ok: true,
      onboarding: {
        status: updatedOnboarding.status,
        missing_fields: updatedOnboarding.missing_fields,
        placeholder_email: updatedOnboarding.placeholder_email,
      },
    })
    return
  }

  try {
    await updateCustomersWorkflow(req.scope).run({
      input: {
        selector: { id: [customerId] },
        update: {
          ...updateData,
          metadata: updatedMetadata,
        },
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_error"
    logger.error(
      `[onboarding] update failed customer_id=${customerId} error_length=${message.length}`
    )
    res.status(500).json({
      ok: false,
      code: "update_failed",
      message: "Failed to update customer data",
    })
    return
  }

  res.status(200).json({
    ok: true,
    onboarding: {
      status: updatedOnboarding.status,
      missing_fields: updatedOnboarding.missing_fields,
      placeholder_email: updatedOnboarding.placeholder_email,
    },
  })
}
