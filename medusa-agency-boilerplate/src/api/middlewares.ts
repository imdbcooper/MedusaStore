import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  enforceApishipCheckoutReadinessForCartCompletion,
  enforceApishipCheckoutReadinessForPaymentSession,
} from "../modules/apiship-checkout-readiness"
import {
  enforceApishipDirectFulfillmentCancelExecutionGuard,
  enforceApishipDirectFulfillmentCreateExecutionGuard,
  enforceApishipOrderFulfillmentCancelExecutionGuard,
  enforceApishipOrderFulfillmentCreateExecutionGuard,
} from "../modules/apiship-shipment-execution-guard"
import { enforceDeliveryHubRuntimeQuarantine } from "../modules/delivery-hub-runtime-quarantine"
import { enforceOnboardingEmailForCheckout } from "../modules/onboarding-checkout-gate"
import {
  publicRateLimit,
  VK_ID_PUBLIC_RATE_LIMIT,
} from "../modules/public-rate-limit"

import { AdminAssistantReindexSchema } from "./admin/assistant/reindex/route"
import { AdminAssistantReindexProcessSchema } from "./admin/assistant/reindex/process/route"
import {
  AdminCreateMarketingCampaignSchema,
  AdminUpdateCustomerMarketingPreferencesSchema,
} from "./admin/marketing/campaigns/route"
import { AdminNotificationSmokeSchema } from "./admin/notifications/smoke/route"
import { AdminSmsNotificationSmokeSchema } from "./admin/notifications/smoke/sms/route"
import { AdminVkNotificationSmokeSchema } from "./admin/notifications/smoke/vk/route"
import { StoreAssistantHistorySchema } from "./store/assistant/history/route"
import { StoreCustomerMarketingPreferencesSchema } from "./store/customers/me/marketing-preferences/route"
import { StoreMarketingConfirmSchema } from "./store/customers/marketing/confirm/route"
import { StoreRequestEmailVerificationSchema } from "./store/customers/me/request-email-verification/route"
import { StoreUpdateCustomerPasswordSchema } from "./store/customers/me/password/route"
import { StoreAuthVkIdStartSchema } from "./store/auth/vk-id/start/route"
import { enforceVkIdStartOriginAllowlist } from "./store/auth/vk-id/start/origin-guard"
import { StoreAuthVkIdLinkConflictResolveSchema } from "./store/auth/vk-id/link-conflict-resolve/route"
import { StoreVkIdStartLinkSchema } from "./store/customers/me/vk-id/start/route"
import { StoreForgotPasswordSchema } from "./store/customers/forgot-password/route"
import { StoreResetPasswordSchema } from "./store/customers/reset-password/route"
import { StoreVerifyEmailSchema } from "./store/customers/verify-email/route"
import { StoreYooKassaPaymentStatusSchema } from "./store/payment/yookassa/route"
import { StoreYooKassaReturnSchema } from "./store/payment/yookassa/return/route"
import { StoreVkIdCallbackSchema } from "./store/vk-id/callback/route"
import { StoreOnboardingSchema } from "./store/customers/me/onboarding/route"

const adminAuth = authenticate("user", ["session", "bearer", "api-key"])

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/apiship/diagnostics",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/fulfillments",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipDirectFulfillmentCreateExecutionGuard],
    },
    {
      matcher: "/admin/fulfillments/:id/cancel",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipDirectFulfillmentCancelExecutionGuard],
    },
    {
      matcher: "/admin/orders/:id/fulfillments",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipOrderFulfillmentCreateExecutionGuard],
    },
    {
      matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/cancel",
      methods: ["POST"],
      middlewares: [adminAuth, enforceApishipOrderFulfillmentCancelExecutionGuard],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub",
      methods: ["GET"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments/:shipment_id/refresh",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments/:shipment_id/cancel",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/orders/:id/delivery-hub/shipments/:shipment_id/retry",
      methods: ["POST"],
      middlewares: [adminAuth, enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/admin/assistant/reindex",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminAssistantReindexSchema)],
    },
    {
      matcher: "/admin/assistant/reindex/process",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminAssistantReindexProcessSchema)],
    },
    {
      matcher: "/admin/assistant/reindex/intents",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/assistant/stats",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/assistant/jobs/:id",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/store/assistant/history",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(StoreAssistantHistorySchema)],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminCreateMarketingCampaignSchema)],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["PUT"],
      middlewares: [adminAuth, validateAndTransformBody(AdminUpdateCustomerMarketingPreferencesSchema)],
    },
    {
      matcher: "/admin/marketing/campaigns/:id",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/marketing/campaigns/:id",
      methods: ["POST"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/notifications/smoke",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminNotificationSmokeSchema)],
    },
    {
      matcher: "/admin/notifications/smoke/vk",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminVkNotificationSmokeSchema)],
    },
    {
      matcher: "/admin/notifications/smoke/sms",
      methods: ["POST"],
      middlewares: [adminAuth, validateAndTransformBody(AdminSmsNotificationSmokeSchema)],
    },
    {
      matcher: "/store/customers/me/marketing-preferences",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/marketing-preferences",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreCustomerMarketingPreferencesSchema),
      ],
    },
    {
      matcher: "/store/customers/me/vk-id",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/vk-id/start",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreVkIdStartLinkSchema),
      ],
    },
    {
      matcher: "/store/customers/me/vk-id/unlink",
      methods: ["POST"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      // Public, customer-less endpoint for the VK ID login flow. Phase 5.1
      // only logs in customers that already have a working VK link.
      //
      // The endpoint is deliberately unauthenticated, so we layer two
      // guardrails before hitting the handler:
      //   1. Origin/Referer allowlist stops third-party sites from minting
      //      signed state on behalf of our users (CSRF-flavored abuse) and
      //      protects our VK_ID_CLIENT_ID rate budget.
      //   2. Phase 5.4 per-IP rate limit (`publicRateLimit`, 10 req/min)
      //      shuts down state-token flooding DoS attempts. Staging runs a
      //      single Medusa replica so the in-memory limiter is enough; the
      //      primitive is swappable for a Redis-backed version without
      //      touching call sites.
      matcher: "/store/auth/vk-id/start",
      methods: ["POST"],
      middlewares: [
        publicRateLimit({
          ...VK_ID_PUBLIC_RATE_LIMIT,
          bucketKey: "vk-id-start",
        }),
        enforceVkIdStartOriginAllowlist,
        validateAndTransformBody(StoreAuthVkIdStartSchema),
      ],
    },
    {
      // Phase 5.3 conflict-resolution endpoint. Unauthenticated like
      // `/store/auth/vk-id/start` — the caller is a storefront user who
      // does not yet have a Medusa session. The security envelope is:
      //   1. Phase 5.4 per-IP rate limit (`publicRateLimit`, 10 req/min) to
      //      block password brute-force attempts against emailpass
      //      verification.
      //   2. Origin/Referer allowlist (same CSRF guard as the login start).
      //   3. Signed, short-lived `pending_token` carrying the VK identity.
      //   4. Emailpass password verification before the VK link is persisted.
      // All four must pass; any single one missing makes the flow a no-op.
      matcher: "/store/auth/vk-id/link-conflict-resolve",
      methods: ["POST"],
      middlewares: [
        publicRateLimit({
          ...VK_ID_PUBLIC_RATE_LIMIT,
          bucketKey: "vk-id-link-conflict-resolve",
        }),
        enforceVkIdStartOriginAllowlist,
        validateAndTransformBody(StoreAuthVkIdLinkConflictResolveSchema),
      ],
    },
    {
      matcher: "/store/customers/me/request-email-verification",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreRequestEmailVerificationSchema),
      ],
    },
    {
      matcher: "/store/customers/verify-email",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(StoreVerifyEmailSchema)],
    },
    {
      matcher: "/store/customers/marketing/confirm",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(StoreMarketingConfirmSchema)],
    },
    {
      // Unsubscribe POST handler performs its own validation because it
      // must also accept RFC 8058 one-click `application/x-www-form-urlencoded`
      // bodies like `List-Unsubscribe=One-Click`, which Medusa's
      // `validateAndTransformBody` rejects as unknown keys even when the
      // Zod schema uses `.passthrough()`. GET requests do not have a body
      // at all.
      matcher: "/store/customers/marketing/unsubscribe",
      methods: ["POST", "GET"],
      middlewares: [],
    },
    {
      matcher: "/admin/customers/:id/resend-email-verification",
      methods: ["POST"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/store/customers/forgot-password",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(StoreForgotPasswordSchema)],
    },
    {
      matcher: "/store/customers/reset-password",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(StoreResetPasswordSchema)],
    },
    {
      matcher: "/store/customers/me/password",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreUpdateCustomerPasswordSchema),
      ],
    },
    {
      matcher: "/store/customers/me/onboarding",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreOnboardingSchema),
      ],
    },
    {
      matcher: "/admin/customers/:id/send-password-reset",
      methods: ["POST"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/store/delivery/catalog",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/settings",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/cutover-preconditions",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/cutover-candidate",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/cutover-approval-template",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/quotes",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/quotes",
      methods: ["POST"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/pickup-points",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/pickup-windows",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/readiness",
      methods: ["GET"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["POST"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection/commit",
      methods: ["POST"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/delivery/selection",
      methods: ["DELETE"],
      middlewares: [enforceDeliveryHubRuntimeQuarantine],
    },
    {
      matcher: "/store/payment-collections/:id/payment-sessions",
      methods: ["POST"],
      middlewares: [enforceApishipCheckoutReadinessForPaymentSession],
    },
    {
      matcher: "/store/carts/:id/complete",
      methods: ["POST"],
      middlewares: [enforceOnboardingEmailForCheckout, enforceApishipCheckoutReadinessForCartCompletion],
    },
    {
      matcher: "/store/payment/yookassa",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreYooKassaPaymentStatusSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/payment/yookassa/return",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreYooKassaReturnSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/store/vk-id/callback",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreVkIdCallbackSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/yookassa/return",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(StoreYooKassaReturnSchema, {
          defaults: [],
          isList: false,
        }),
      ],
    },
    {
      matcher: "/yookassa/webhook",
      methods: ["POST"],
      middlewares: [],
    },
  ],
})
