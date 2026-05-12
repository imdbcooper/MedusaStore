import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import {
  buildPasswordResetConsumeMetadata,
  parsePasswordResetToken,
  PASSWORD_RESET_FAILURE_REASONS,
  PasswordResetFailureReason,
  PasswordStrengthFailureReason,
  sanitizeLogValue,
  validatePasswordStrength,
  verifyPasswordResetToken,
} from "../modules/password-reset"
import { normalizeNotificationRecipient } from "../modules/notification-email"

export const EMAILPASS_PROVIDER_ID = "emailpass"

type ApplyPasswordResetInput = {
  token: string
  newPassword: string
}

type ApplyPasswordResetCustomer = {
  id: string
  email: string | null
  metadata?: Record<string, unknown> | null
}

export type ApplyPasswordResetFailureReason =
  | PasswordResetFailureReason
  | PasswordStrengthFailureReason
  | "provider_update_failed"

export type ApplyPasswordResetResult =
  | {
      status: "applied"
      customer_id: string
      email: string
    }
  | {
      status: "failed"
      reason: ApplyPasswordResetFailureReason
      customer_id: string | null
    }

export type ApplyPasswordResetOutput = {
  result: ApplyPasswordResetResult
}

const applyPasswordResetStep = createStep(
  "apply-password-reset-step",
  async (input: ApplyPasswordResetInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const authModule = container.resolve(Modules.AUTH)

    const parsed = parsePasswordResetToken(input.token)

    if (!parsed.ok) {
      logger.warn(
        `[password-reset] apply failed reason=invalid_token_format token_length=${input.token?.length ?? 0}`
      )

      return new StepResponse<ApplyPasswordResetResult>({
        status: "failed",
        reason: "invalid_token_format",
        customer_id: null,
      })
    }

    const strength = validatePasswordStrength(input.newPassword)

    if (!strength.ok) {
      logger.warn(
        `[password-reset] apply failed reason=${strength.reason} customer_id=${sanitizeLogValue(parsed.customerId)}`
      )

      return new StepResponse<ApplyPasswordResetResult>({
        status: "failed",
        reason: strength.reason,
        customer_id: parsed.customerId,
      })
    }

    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "metadata"],
      filters: {
        id: parsed.customerId,
      },
    })

    const customer = customers[0] as ApplyPasswordResetCustomer | undefined

    if (!customer) {
      logger.warn(
        `[password-reset] apply failed reason=customer_not_found customer_id=${sanitizeLogValue(parsed.customerId)}`
      )

      return new StepResponse<ApplyPasswordResetResult>({
        status: "failed",
        reason: "customer_not_found",
        customer_id: parsed.customerId,
      })
    }

    const verification = verifyPasswordResetToken({
      customer,
      rawToken: parsed.rawToken,
    })

    if (!verification.ok) {
      logger.warn(
        `[password-reset] apply failed reason=${verification.reason} customer_id=${sanitizeLogValue(customer.id)}`
      )

      return new StepResponse<ApplyPasswordResetResult>({
        status: "failed",
        reason: verification.reason,
        customer_id: customer.id,
      })
    }

    const normalizedEmail = normalizeNotificationRecipient(customer.email)

    if (!normalizedEmail || normalizedEmail !== verification.email) {
      logger.warn(
        `[password-reset] apply failed reason=email_mismatch customer_id=${sanitizeLogValue(customer.id)}`
      )

      return new StepResponse<ApplyPasswordResetResult>({
        status: "failed",
        reason: "email_mismatch",
        customer_id: customer.id,
      })
    }

    // Update password via Medusa Auth Module. emailpass uses email as entity_id.
    const providerUpdate = await authModule.updateProvider(
      EMAILPASS_PROVIDER_ID,
      {
        entity_id: normalizedEmail,
        password: input.newPassword,
      }
    )

    if (!providerUpdate?.success) {
      logger.warn(
        `[password-reset] apply failed reason=provider_update_failed customer_id=${sanitizeLogValue(customer.id)} provider_error=${sanitizeLogValue(providerUpdate?.error)}`
      )

      return new StepResponse<ApplyPasswordResetResult>({
        status: "failed",
        reason: "provider_update_failed",
        customer_id: customer.id,
      })
    }

    const nextMetadata = buildPasswordResetConsumeMetadata({
      currentMetadata: customer.metadata,
    })

    try {
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
    } catch (markError) {
      // Compensation race: password was already changed by the auth provider,
      // but we failed to mark the reset token as consumed in customer metadata.
      // The token therefore remains valid until its natural TTL, even though
      // the new password is already active. We cannot roll back the password
      // change here; we log loudly so operators can investigate and, if needed,
      // force-consume the token manually.
      const markMessage =
        markError instanceof Error ? markError.message : "unknown_mark_error"
      logger.error(
        `[password-reset] apply consumed_mark_failed password_changed=true reset_token_still_active=true customer_id=${sanitizeLogValue(customer.id)} error=${sanitizeLogValue(markMessage)}`
      )
    }

    logger.info(
      `[password-reset] applied customer_id=${sanitizeLogValue(customer.id)} email=${sanitizeLogValue(normalizedEmail)}`
    )

    return new StepResponse<ApplyPasswordResetResult>({
      status: "applied",
      customer_id: customer.id,
      email: normalizedEmail,
    })
  }
)

const applyPasswordResetWorkflow = createWorkflow(
  "apply-password-reset-workflow",
  (input: ApplyPasswordResetInput) => {
    const result = applyPasswordResetStep(input)

    return new WorkflowResponse<ApplyPasswordResetOutput>({
      result,
    })
  }
)

export default applyPasswordResetWorkflow
export { applyPasswordResetStep }

// Re-export failure reason set for route-level logging/consistency
export const APPLY_PASSWORD_RESET_TOKEN_FAILURES = PASSWORD_RESET_FAILURE_REASONS
