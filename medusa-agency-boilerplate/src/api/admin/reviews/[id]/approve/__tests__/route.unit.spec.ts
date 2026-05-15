/**
 * Unit tests for `POST /admin/reviews/:id/approve`.
 *
 * Plan §4.3 / §6.6 / §9 Phase 2 шаг 6:
 *   - delegates to
 *     [`approveProductReview`](medusa-agency-boilerplate/src/modules/product-reviews.ts:824)
 *     with `reviewId` from params and `moderatedBy` from `auth_context.actor_id`;
 *   - calls
 *     [`revalidateStorefrontTags`](medusa-agency-boilerplate/src/lib/storefront-revalidate.ts:69)
 *     with `[product-rating-${productId}, product-reviews-${productId}]`
 *     plus `customer-reviews-${customer_id}` (when `customer_id !== null`)
 *     ONLY when the module reports `recalculated: true`;
 *   - calls
 *     [`sendReviewModerationEmail`](medusa-agency-boilerplate/src/modules/product-reviews-email.ts:1)
 *     with `type: "approved"` after a real approve (`recalculated: true`),
 *     and skips it on the idempotent path (`recalculated: false`);
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

const mockApproveProductReview = jest.fn<any>(async () => ({}))
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
    approveProductReview: (...args: any[]) => mockApproveProductReview(...args),
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

beforeAll(() => {
  POST = (require("../route") as typeof import("../route")).POST
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
  actorId?: string | null
}): any {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return {
    params: { id: input.reviewId },
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
  mockApproveProductReview.mockReset()
  mockApproveProductReview.mockImplementation(async () => ({
    review: {
      id: "pr_1",
      status: "approved",
      product_id: "prod_1",
      customer_id: "cust_1",
    },
    productId: "prod_1",
    statusChanged: true,
    recalculated: true,
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

describe("POST /admin/reviews/:id/approve", () => {
  it("calls approveProductReview with reviewId and moderatedBy from auth", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", actorId: "usr_42" })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    const arg = mockApproveProductReview.mock.calls[0][0] as {
      reviewId: string
      moderatedBy: string | null
    }
    expect(arg.reviewId).toBe("pr_1")
    expect(arg.moderatedBy).toBe("usr_42")
  })

  it("recalculated:true with customer_id → revalidateStorefrontTags called with all three tags", async () => {
    mockApproveProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "approved",
        product_id: "prod_42",
        customer_id: "cust_42",
      },
      productId: "prod_42",
      statusChanged: true,
      recalculated: true,
    }))

    const { res } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", actorId: "usr_admin" })

    await POST(req, res)

    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual([
      "product-rating-prod_42",
      "product-reviews-prod_42",
      "customer-reviews-cust_42",
      "top-reviews",
    ])
  })

  it("recalculated:true with anonymized customer_id:null → only product tags + top-reviews, no customer-reviews tag", async () => {
    mockApproveProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "approved",
        product_id: "prod_42",
        customer_id: null,
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
    expect(tagsArg).not.toContain("customer-reviews-null")
  })

  it("recalculated:false → revalidateStorefrontTags NOT called and email NOT sent", async () => {
    mockApproveProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "approved",
        product_id: "prod_42",
        customer_id: "cust_42",
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

  it("recalculated:true → sendReviewModerationEmail called with type='approved' and the moderation row", async () => {
    mockApproveProductReview.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        status: "approved",
        product_id: "prod_42",
        customer_id: "cust_42",
      },
      productId: "prod_42",
      statusChanged: true,
      recalculated: true,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(mockSendReviewModerationEmail).toHaveBeenCalledTimes(1)
    const [, emailArg] = mockSendReviewModerationEmail.mock.calls[0] as [
      unknown,
      { type: string; review: { id: string; customer_id: string | null } }
    ]
    expect(emailArg.type).toBe("approved")
    expect(emailArg.review.id).toBe("pr_1")
    expect(emailArg.review.customer_id).toBe("cust_42")
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
      recalculated: true,
    })
  })

  it("not_found from module → 404", async () => {
    mockApproveProductReview.mockImplementation(async () => {
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
    expect(mockApproveProductReview).not.toHaveBeenCalled()
    expect(mockSendReviewModerationEmail).not.toHaveBeenCalled()
  })
})
