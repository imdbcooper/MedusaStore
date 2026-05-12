import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import {
  buildPasswordResetClearedMetadata,
  PasswordStrengthFailureReason,
  sanitizeLogValue,
  validatePasswordStrength,
} from "../modules/password-reset"
import { normalizeNotificationRecipient } from "../modules/notification-email"
import { EMAILPASS_PROVIDER_ID } from "./apply-password-reset"

type UpdateCustomerPasswordInput = {
  customerId: string
  currentPassword: string
  newPassword: string
}

type UpdateCustomerPasswordCustomer = {
  id: string
  email: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateCustomerPasswordFailureReason =
  | PasswordStrengthFailureReason
  | "customer_not_found"
  | "missing_customer_email"
  | "invalid_current_password"
  | "provider_update_failed"
  | "same_password"

export type UpdateCustomerPasswordResult =
  | {
      status: "updated"
      customer_id: string
      email: string
    }
  | {
      status: "failed"
      reason: UpdateCustomerPasswordFailureReason
      customer_id: string | null
    }

export type UpdateCustomerPasswordOutput = {
  result: UpdateCustomerPasswordResult
}

const updateCustomerPasswordStep = createStep(
  "update-customer-password-step",
  async (input: UpdateCustomerPasswordInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const authModule = container.resolve(Modules.AUTH)

    const customerId = input.customerId?.trim()

    if (!customerId) {
      logger.warn(
        "[password-update] failed reason=customer_not_found customer_id=n/a"
      )

      return new StepResponse<UpdateCustomerPasswordResult>({
        status: "failed",
        reason: "customer_not_found",
        customer_id: null,
      })
    }

    if (input.currentPassword === input.newPassword) {
      logger.info(
        `[password-update] failed reason=same_password customer_id=${sanitizeLogValue(customerId)}`
      )

      return new StepResponse<UpdateCustomerPasswordResult>({
        status: "failed",
        reason: "same_password",
        customer_id: customerId,
      })
    }

    const strength = validatePasswordStrength(input.newPassword)

    if (!strength.ok) {
      logger.warn(
        `[password-update] failed reason=${strength.reason} customer_id=${sanitizeLogValue(customerId)}`
      )

      return new StepResponse<UpdateCustomerPasswordResult>({
        status: "failed",
        reason: strength.reason,
        customer_id: customerId,
      })
    }

    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "metadata"],
      filters: {
        id: customerId,
      },
    })

    const customer = customers[0] as UpdateCustomerPasswordCustomer | undefined

    if (!customer) {
      logger.warn(
        `[password-update] failed reason=customer_not_found customer_id=${sanitizeLogValue(customerId)}`
      )

      return new StepResponse<UpdateCustomerPasswordResult>({
        status: "failed",
        reason: "customer_not_found",
        customer_id: customerId,
      })
    }

    const normalizedEmail = normalizeNotificationRecipient(customer.email)

    if (!normalizedEmail) {
      logger.warn(
        `[password-update] failed reason=missing_customer_email customer_id=${sanitizeLogValue(customer.id)}`
      )

      return new StepResponse<UpdateCustomerPasswordResult>({
        status: "failed",
        reason: "missing_customer_email",
        customer_id: customer.id,
      })
    }

    // Verify current password via Auth Module authenticate flow
    const authCheck = await authModule.authenticate(EMAILPASS_PROVIDER_ID, {
      body: {
        email: normalizedEmail,
        password: input.currentPassword,
      },
    })

    if (!authCheck?.success) {
      logger.warn(
        `[password-update] failed reason=invalid_current_password customer_id=${sanitizeLogValue(customer.id)}`
      )

      return new StepResponse<UpdateCustomerPasswordResult>({
        status: "failed",
        reason: "invalid_current_password",
        customer_id: customer.id,
      })
    }

    const providerUpdate = await authModule.updateProvider(
      EMAILPASS_PROVIDER_ID,
      {
        entity_id: normalizedEmail,
        password: input.newPassword,
      }
    )

    if (!providerUpdate?.success) {
      logger.warn(
        `[password-update] failed reason=provider_update_failed customer_id=${sanitizeLogValue(customer.id)} provider_error=${sanitizeLogValue(providerUpdate?.error)}`
      )

      return new StepResponse<UpdateCustomerPasswordResult>({
        status: "failed",
        reason: "provider_update_failed",
        customer_id: customer.id,
      })
    }

    // Invalidate any outstanding password reset tokens after a successful
    // authenticated password change.
    const clearedMetadata = buildPasswordResetClearedMetadata({
      currentMetadata: customer.metadata,
    })

    try {
      await updateCustomersWorkflow(container).run({
        input: {
          selector: {
            id: [customer.id],
          },
          update: {
            metadata: clearedMetadata,
          },
        },
      })
    } catch (clearError) {
      // Compensation race: password was already changed by the auth provider,
      // but we failed to clear the outstanding password_reset metadata.
      // Any previously-issued reset token therefore remains valid until its
      // natural TTL, even though the current password has already been rotated.
      // We cannot roll back the password change here; we log loudly so
      // operators can investigate and, if needed, force-clear the metadata.
      const clearMessage =
        clearError instanceof Error ? clearError.message : "unknown_clear_error"
      logger.error(
        `[password-update] metadata_clear_failed password_changed=true outstanding_reset_token_valid=true customer_id=${sanitizeLogValue(customer.id)} error=${sanitizeLogValue(clearMessage)}`
      )
    }

    logger.info(
      `[password-update] updated customer_id=${sanitizeLogValue(customer.id)} email=${sanitizeLogValue(normalizedEmail)}`
    )

    return new StepResponse<UpdateCustomerPasswordResult>({
      status: "updated",
      customer_id: customer.id,
      email: normalizedEmail,
    })
  }
)

const updateCustomerPasswordWorkflow = createWorkflow(
  "update-customer-password-workflow",
  (input: UpdateCustomerPasswordInput) => {
    const result = updateCustomerPasswordStep(input)

    return new WorkflowResponse<UpdateCustomerPasswordOutput>({
      result,
    })
  }
)

export default updateCustomerPasswordWorkflow
export { updateCustomerPasswordStep }
