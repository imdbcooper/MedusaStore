/**
 * VK ID auth helpers for issuing Medusa customer JWTs without going through
 * the public emailpass flow.
 *
 * This module is intentionally separate from `vk-id.ts` because it depends on
 * the Medusa container and on an internal helper from
 * `@medusajs/medusa/dist/api/auth/utils/generate-jwt-token`. Keeping it
 * isolated lets the pure VK ID logic in `vk-id.ts` stay easily testable.
 */

import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type {
  AuthIdentityDTO,
  IAuthModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
// Re-exports through the public package "exports" map. The module's `.d.ts`
// is colocated under `dist/api/auth/utils/generate-jwt-token.d.ts`, but the
// runtime path resolves through `@medusajs/medusa/api/*` per package.json.
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"

export type VkIdJwtIssueErrorCode =
  | "auth_identity_not_found"
  | "jwt_secret_missing"
  | "jwt_signing_failed"

export class VkIdJwtIssueError extends Error {
  readonly code: VkIdJwtIssueErrorCode

  constructor(code: VkIdJwtIssueErrorCode, message?: string) {
    super(message || code)
    this.name = "VkIdJwtIssueError"
    this.code = code
  }
}

type ConfigModuleLike = {
  projectConfig?: {
    http?: {
      jwtSecret?: string
      jwtExpiresIn?: string
      jwtOptions?: Record<string, unknown>
    }
  }
}

/**
 * Looks up the auth_identity that owns the given customer (actor_type
 * `customer`). Phase 5.1 only logs in customers that already have a working
 * Medusa auth_identity (typically created by emailpass registration). If no
 * identity exists, the caller must surface a friendly "not linked" error
 * instead of silently creating one.
 */
export async function findCustomerAuthIdentity(
  container: MedusaContainer,
  customerId: string
): Promise<AuthIdentityDTO | null> {
  const trimmed = customerId.trim()

  if (!trimmed) {
    return null
  }

  const authModule = container.resolve<IAuthModuleService>(Modules.AUTH)
  const identities = await authModule.listAuthIdentities(
    {
      app_metadata: {
        customer_id: trimmed,
      },
    },
    {
      relations: ["provider_identities"],
      take: 1,
    }
  )

  return identities[0] || null
}

/**
 * Issues a Medusa customer JWT for an auth_identity that already owns the
 * customer. Mirrors what the framework does in the emailpass callback route.
 */
export async function issueCustomerJwtForAuthIdentity(
  container: MedusaContainer,
  input: {
    authIdentity: AuthIdentityDTO
    authProvider?: string
  }
): Promise<string> {
  const config = container.resolve<ConfigModuleLike>(
    ContainerRegistrationKeys.CONFIG_MODULE
  )
  const http = config?.projectConfig?.http

  if (!http?.jwtSecret) {
    throw new VkIdJwtIssueError(
      "jwt_secret_missing",
      "Medusa JWT secret is not configured (projectConfig.http.jwtSecret)."
    )
  }

  try {
    const token = await generateJwtTokenForAuthIdentity(
      {
        authIdentity: input.authIdentity,
        actorType: "customer",
        authProvider: input.authProvider,
        container,
      },
      {
        secret: http.jwtSecret,
        expiresIn: http.jwtExpiresIn,
        options: http.jwtOptions as never,
      }
    )

    if (!token) {
      throw new VkIdJwtIssueError(
        "jwt_signing_failed",
        "Medusa JWT helper returned an empty token."
      )
    }

    return token
  } catch (error) {
    if (error instanceof VkIdJwtIssueError) {
      throw error
    }

    throw new VkIdJwtIssueError(
      "jwt_signing_failed",
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Convenience helper used by the VK ID callback for the login intent.
 *
 * Returns either a freshly minted JWT string or a structured error code that
 * the callback can translate into a `?vk_login_error=...` redirect.
 */
export async function issueCustomerJwtForVkIdentity(
  container: MedusaContainer,
  customerId: string
): Promise<
  | { ok: true; token: string; authIdentityId: string }
  | { ok: false; code: VkIdJwtIssueErrorCode }
> {
  try {
    const authIdentity = await findCustomerAuthIdentity(container, customerId)

    if (!authIdentity) {
      return { ok: false, code: "auth_identity_not_found" }
    }

    const token = await issueCustomerJwtForAuthIdentity(container, {
      authIdentity,
    })

    return { ok: true, token, authIdentityId: authIdentity.id }
  } catch (error) {
    if (error instanceof VkIdJwtIssueError) {
      return { ok: false, code: error.code }
    }

    return { ok: false, code: "jwt_signing_failed" }
  }
}
