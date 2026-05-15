/**
 * Unit tests for `POST /admin/reviews/:id/reject`.
 *
 * Plan §4.2 / §4.3 / §6.6 / §9 Phase 2 шаг 6:
 *   - body schema is strict (`{ reason }` required, max 500 chars; extra
 *     keys → 400 from `validateAndTransformBody`);
 *   - delegates to
 *     [`rejectProductReview`](medusa-agency-boilerplate/src/modules/product-reviews.ts:899)
 *     with `reviewId`, `moderatedBy`, `reason`;
 *   - calls
 *     [`revalidateStorefrontTags`](medusa-agency-boilerplate/src/lib/storefront-revalidate.ts:69)
 *     with `[product-rating-${productId}, product-reviews-${productId}]`
 *     ONLY when the module reports `recalculated: true` (already-rejected
 *     idempotent path leaves aggregates intact). Adds
 *     `customer-reviews-${customer_id}` whenever `statusChanged: true` AND
 *     `customer_id !== null` — the «Мои отзывы» surface refreshes both on
 *     `pending → rejected` and `approved → rejected`;
 *   - calls
 *     [`sendReviewModerationEmail`](medusa-agency-boilerplate/src/modules/product-reviews-email.ts:1)
 *     with `type: "rejected"` and the request reason whenever
 *     `statusChanged: true` (i.e. NOT on the idempotent already-rejected
 *     path);
 *   - email failure is best-effort and does NOT break the 200 response;
 *   - maps `ProductReviewError("not_found")` → 404.
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const mockRejectProductReview = jest.fn<any>(async () => ({}))
const mockRevalidateStorefrontTags = jest.fn<any>(async () => ({
  ok: true,
  status: 200,
  revalidated: [],
}))
const mockSendReviewModerationEmail = jest.fn<any>(async () => ({
  ok: true,
  status: "sent",
  recipient: "buyer@example.com",
}))

jest.mock("../../../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../../../modules/product-reviews"
  ) as typeof import("../../../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    rejectProductReview: (...args: any[]) => mockRejectProductReview(...args),
  }
})

jest.mock("../../../../../../modules/product-reviews-email", () => ({
  __esModule: true,
  sendReviewModerationEmail: (...args: any[]) =>
    mockSendReviewModerationEmail(...args),
}))

jest.mock("../../../../../../lib/storefront-revalidate", () => ({
  __esModule: true,
  revalidateStorefrontTags: (...args: any[]) =>
    mockRevalidateStorefrontTags(...args),
}))

const { ProductReviewError } = jest.requireActual(
  "../../../../../../modules/product-reviews"
) as typeof import("../../../../../../modules/product-reviews")

let POST: typeof import("../route")["POST"]
let AdminRejectProductReviewSchema: typeof import("../route")["AdminRejectProductReviewSchema"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  POST = mod.POST
  AdminRejectProductReviewSchema = mod.AdminRejectProductReviewSchema
})

type ResRecorder = { status?: number; body?: any }

function buildResponse(): { res: any; recorder: ResRecorder } {
  const recorder: ResRecorder = {}
  const res: any = {
    status(code: number) {
      recorder.status = code
      return this
    },
    json(payload: unknown) {
      recorder.body = payload
      return this
    },
  }
  return { res, recorder }
}

function buildReq(input: {
  reviewId?: string
  validatedBody?: { reason: string }
  actorId?: string | null
}): any {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return {
    params: { id: input.reviewId },
    validatedBody: input.validatedBody ?? { reason: "spam" },
    auth_context: {
      actor_id: input.actorId ?? "usr_admin",
      actor_type: "user",
    },
    scope: {
      resolve: jest.fn((key: any) =>
        key === ContainerRegistrationKeys.LOGGER ? logger : undefined
      ),
    },
  }
}

beforeEach(() => {
  mockRejectProductReview.mockReset()
  mockRejectProductReview.mockImplementation(async () => ({
    review: {
      id: "pr_1",
      status: "rejected",
      product_id: "prod_1",
      customer_id: "cust_1",
      rejection_reason: "spam",
    },
    productId: "prod_1",
    statusChanged: true,
    recalculated: false,
  }))
  mockRevalidateStorefrontTags.mockReset()
  mockRevalidateStorefrontTags.mockImplementation(async () => ({
    ok: true,
    status: 200,
    revalidated: [],
  }))
  mockSendReviewModerationEmail.mockReset()
  mockSendReviewModerationEmail.mockImplementation(async () => ({
    ok: true,
    status: "sent",
    recipient: "buyer@example.com",
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Schema-only tests (validateAndTransformBody runs before the handler).
// ---------------------------------------------------------------------------

describe("AdminRejectProductReviewSchema (strict)", () => {
  it("accepts a single required reason", () => {
    expect(
      AdminRejectProductReviewSchema.safeParse({ reason: "spam" }).success
    ).toBe(true)
  })

  it("rejects empty / missing reason", () => {
    expect(AdminRejectProductReviewSchema.safeParse({}).success).toBe(false)
    expect(
      AdminRejectProductReviewSchema.safeParse({ reason: "" }).success
    ).toBe(false)
  })

  it("rejects reason over 500 chars", () => {
    expect(
      AdminRejectProductReviewSchema.safeParse({
        reason: "x".repeat(501),
      }).success
    ).toBe(false)
    expect(
      AdminRejectProductReviewSchema.safeParse({
        reason: "x".repeat(500),
      }).success
    ).toBe(true)
  })

  it("rejects unknown keys", () => {
    expect(
      AdminRejectProductReviewSchema.safeParse({
        reason: "spam",
        evil: "yes",
      }).success
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/reviews/:id/reject — handler tests
// ---------------------------------------------------------------------------

describe("POST /admin/reviews/:id/reject", () => {
  it("calls rejectProductReview with reviewId / moderatedBy / reason", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      reviewId: "pr_1",
      actorId: "usr_42",
      validatedBody: { reason: "off-topic" },
    })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    const arg = mockRejectProductReview.mock.calls[0][0] as {
      reviewId: string
      moderatedBy: string | null
      reason: string
    }
    expect(arg.reviewId).toBe("pr_1")
    expect(arg.moderatedBy).toBe("usr_42")
    expect(arg.reason).toBe("off-topic")
  })

  it("recalculated:true (approved → rejected) → revalidate with all three tags", async () => {
    mockRejectProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "rejected",
        product_id: "prod_42",
        customer_id: "cust_42",
        rejection_reason: "spam",
      },
      productId: "prod_42",
      statusChanged: true,
      recalculated: true,
    }))

    const { res } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual([
      "product-rating-prod_42",
      "product-reviews-prod_42",
      "top-reviews",
      "customer-reviews-cust_42",
    ])
  })

  it("statusChanged:true + recalculated:false (pending → rejected) → only customer-reviews tag", async () => {
    mockRejectProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "rejected",
        product_id: "prod_42",
        customer_id: "cust_42",
        rejection_reason: "spam",
      },
      productId: "prod_42",
      statusChanged: true,
      recalculated: false,
    }))

    const { res } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual(["customer-reviews-cust_42"])
  })

  it("anonymized customer_id:null on approved → rejected → no customer-reviews tag", async () => {
    mockRejectProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "rejected",
        product_id: "prod_42",
        customer_id: null,
        rejection_reason: "spam",
      },
      productId: "prod_42",
      statusChanged: true,
      recalculated: true,
    }))

    const { res } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual([
      "product-rating-prod_42",
      "product-reviews-prod_42",
      "top-reviews",
    ])
  })

  it("statusChanged:false (idempotent already-rejected) → no revalidate, no email", async () => {
    mockRejectProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "rejected",
        product_id: "prod_42",
        customer_id: "cust_42",
        rejection_reason: "spam",
      },
      productId: "prod_42",
      statusChanged: false,
      recalculated: false,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(mockRevalidateStorefrontTags).not.toHaveBeenCalled()
    expect(mockSendReviewModerationEmail).not.toHaveBeenCalled()
  })

  it("statusChanged:true → sendReviewModerationEmail called with rejected type and the reason", async () => {
    mockRejectProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "rejected",
        product_id: "prod_42",
        customer_id: "cust_42",
        rejection_reason: "off-topic",
      },
      productId: "prod_42",
      statusChanged: true,
      recalculated: false,
    }))

    const { res } = buildResponse()
    const req = buildReq({
      reviewId: "pr_1",
      validatedBody: { reason: "off-topic" },
    })

    await POST(req, res)

    expect(mockSendReviewModerationEmail).toHaveBeenCalledTimes(1)
    const [, emailArg] = mockSendReviewModerationEmail.mock.calls[0] as [
      unknown,
      {
        type: string
        review: { id: string; rejection_reason: string | null }
        rejectionReason?: string | null
      }
    ]
    expect(emailArg.type).toBe("rejected")
    expect(emailArg.review.id).toBe("pr_1")
    expect(emailArg.rejectionReason).toBe("off-topic")
  })

  it("email failure does not break the 200 response", async () => {
    mockSendReviewModerationEmail.mockImplementation(async () => {
      throw new Error("smtp_down")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toMatchObject({
      productId: "prod_1",
    })
  })

  it("not_found from module → 404", async () => {
    mockRejectProductReview.mockImplementation(async () => {
      throw new ProductReviewError("not_found")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_404" })

    await POST(req, res)

    expect(recorder.status).toBe(404)
    expect(recorder.body).toMatchObject({ code: "not_found" })
    expect(mockRevalidateStorefrontTags).not.toHaveBeenCalled()
    expect(mockSendReviewModerationEmail).not.toHaveBeenCalled()
  })

  it("missing :id → 400 review_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "" })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "review_id_required" })
    expect(mockRejectProductReview).not.toHaveBeenCalled()
    expect(mockSendReviewModerationEmail).not.toHaveBeenCalled()
  })
})
