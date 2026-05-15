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
import { StoreCreateProductReviewSchema } from "./store/products/[id]/reviews/route"
import { StoreUploadProductReviewImageSchema } from "./store/products/[id]/reviews/upload/route"
import { AdminRejectProductReviewSchema } from "./admin/reviews/[id]/reject/route"
import { AdminProductReviewReplySchema } from "./admin/reviews/[id]/reply/route"

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
      // Phase 1 / step 4: product reviews module — Admin API.
      // Plan §4.2 / §5.2: all `/admin/reviews*` paths use the standard
      // admin auth chain. The `api-key` branch is required so Payload can
      // call us with `Authorization: Basic <base64(sk_xxx:)>` against the
      // Medusa Secret Admin API Key (plan §5.2). No `publicRateLimit` —
      // admin is trusted.
      matcher: "/admin/reviews",
      methods: ["GET"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/reviews/:id",
      methods: ["GET", "DELETE"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/reviews/:id/approve",
      methods: ["POST"],
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/reviews/:id/reject",
      methods: ["POST"],
      middlewares: [
        adminAuth,
        validateAndTransformBody(AdminRejectProductReviewSchema),
      ],
    },
    {
      // Phase 3 / step 4 — admin reply («Ответ магазина»). POST validates
      // a strict `{ text }` body via the schema in the route file; DELETE
      // has no body but still goes through `adminAuth` so the Payload
      // basic-auth path keeps working.
      matcher: "/admin/reviews/:id/reply",
      methods: ["POST"],
      middlewares: [
        adminAuth,
        validateAndTransformBody(AdminProductReviewReplySchema),
      ],
    },
    {
      matcher: "/admin/reviews/:id/reply",
      methods: ["DELETE"],
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
      // Phase 1 / step 3: product reviews module — Store API.
      // Plan §10.1: POST /store/products/:id/reviews is rate-limited at
      // 5/min and 30/hour (IP+customer keyed via the public limiter).
      // Customer auth is required; the route reads `req.auth_context.actor_id`.
      // GET on the same matcher is public (list of approved reviews) and is
      // intentionally NOT registered here — Medusa applies route-level
      // middlewares only when the method matches.
      matcher: "/store/products/:id/reviews",
      methods: ["POST"],
      middlewares: [
        publicRateLimit({
          bucketKey: "product-reviews-create-minute",
          limit: 5,
          windowMs: 60_000,
        }),
        publicRateLimit({
          bucketKey: "product-reviews-create-hour",
          limit: 30,
          windowMs: 60 * 60_000,
        }),
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreCreateProductReviewSchema),
      ],
    },
    {
      // Phase 3 / step 5 — upload endpoint for image attachments. Reuses
      // the same per-IP rate buckets as create + adds a tighter
      // per-minute upload bucket so even one customer cannot burn S3
      // budget by holding the form open and re-uploading. JSON body
      // (`{filename, mime_type, content_base64}`) — multipart is
      // intentionally not introduced.
      //
      // Phase 3 / step 5 hotfix (P0.2) — Medusa's default body-parser
      // limit is `100kb`, but a 5 MiB raw image base64-encodes to
      // ~6.7 MiB. Without an explicit `bodyParser.sizeLimit` the request
      // is rejected with 413 *before* the route handler runs and the
      // feature is functionally broken. We allow 8 MiB to leave headroom
      // for the base64 33% inflation plus a small JSON envelope; the
      // route's own `MAX_BYTES = 5 MiB` cap on the *decoded* size is
      // unaffected (it runs after parsing).
      matcher: "/store/products/:id/reviews/upload",
      methods: ["POST"],
      bodyParser: { sizeLimit: "8mb" },
      middlewares: [
        publicRateLimit({
          bucketKey: "product-reviews-upload-minute",
          limit: 20,
          windowMs: 60_000,
        }),
        publicRateLimit({
          bucketKey: "product-reviews-upload-hour",
          limit: 100,
          windowMs: 60 * 60_000,
        }),
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StoreUploadProductReviewImageSchema),
      ],
    },
    {
      // Plan §10.1: helpful vote — 30/min IP+customer.
      matcher: "/store/reviews/:id/helpful",
      methods: ["POST"],
      middlewares: [
        publicRateLimit({
          bucketKey: "product-reviews-helpful-minute",
          limit: 30,
          windowMs: 60_000,
        }),
        authenticate("customer", ["session", "bearer"]),
      ],
    },
    {
      // Phase 3 / step 3 — public homepage «Top reviews» widget.
      // Public, GET-only, no auth. `publicRateLimit` 60/min/IP guards the
      // backend from runaway clients (plan §9 Phase 3 п.5). The widget on
      // the storefront caches with `revalidate: 300`, so steady-state load
      // hits cache, not this rate limit.
      matcher: "/store/reviews/top",
      methods: ["GET"],
      middlewares: [
        publicRateLimit({
          bucketKey: "product-reviews-top-minute",
          limit: 60,
          windowMs: 60_000,
        }),
      ],
    },
    {
      // GET my reviews — customer-only, no rate-limit (plan §10.1).
      matcher: "/store/customers/me/reviews",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      // DELETE my review — customer-only, no rate-limit (plan §10.1).
      matcher: "/store/customers/me/reviews/:id",
      methods: ["DELETE"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
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
