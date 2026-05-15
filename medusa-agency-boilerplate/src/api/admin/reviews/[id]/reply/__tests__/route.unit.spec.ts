/**
 * Unit tests for `POST /admin/reviews/:id/reply` and
 * `DELETE /admin/reviews/:id/reply` (Phase 3 / step 4).
 *
 * Plan §9 Phase 3 п.3 + §6.6:
 *   - body schema is strict (`{ text }`, 1..1000 chars after trim;
 *     extra keys → 400 from `validateAndTransformBody`);
 *   - delegates to
 *     [`setProductReviewMerchantReply`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1)
 *     with `text` and `authorId` derived from `auth_context.actor_id`;
 *   - calls
 *     [`revalidateStorefrontTags`](medusa-agency-boilerplate/src/lib/storefront-revalidate.ts:69)
 *     with `[product-reviews-${productId}, top-reviews]` on every success;
 *   - maps `ProductReviewError("not_found")` → 404 and the size-related
 *     module errors → 400 (defence in depth — Zod normally catches them).
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

const mockSetProductReviewMerchantReply = jest.fn<any>(async () => ({}))
const mockClearProductReviewMerchantReply = jest.fn<any>(async () => ({}))
const mockRevalidateStorefrontTags = jest.fn<any>(async () => ({
  ok: true,
  status: 200,
  revalidated: [],
}))

jest.mock("../../../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../../../modules/product-reviews"
  ) as typeof import("../../../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    setProductReviewMerchantReply: (...args: any[]) =>
      mockSetProductReviewMerchantReply(...args),
    clearProductReviewMerchantReply: (...args: any[]) =>
      mockClearProductReviewMerchantReply(...args),
  }
})

jest.mock("../../../../../../lib/storefront-revalidate", () => ({
  __esModule: true,
  revalidateStorefrontTags: (...args: any[]) =>
    mockRevalidateStorefrontTags(...args),
}))

const { ProductReviewError } = jest.requireActual(
  "../../../../../../modules/product-reviews"
) as typeof import("../../../../../../modules/product-reviews")

let POST: typeof import("../route")["POST"]
let DELETE: typeof import("../route")["DELETE"]
let AdminProductReviewReplySchema: typeof import("../route")["AdminProductReviewReplySchema"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  POST = mod.POST
  DELETE = mod.DELETE
  AdminProductReviewReplySchema = mod.AdminProductReviewReplySchema
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
  validatedBody?: { text: string }
  /**
   * `undefined` → defaults to `"usr_admin"` so the happy-path tests don't
   * have to spell it out. `null` is passed THROUGH verbatim so we can
   * exercise the empty-actor branch (route maps it to `authorId: null`).
   */
  actorId?: string | null
}): any {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const actorId =
    input.actorId === undefined ? "usr_admin" : input.actorId
  return {
    params: { id: input.reviewId },
    validatedBody: input.validatedBody ?? { text: "Спасибо за отзыв!" },
    auth_context: {
      actor_id: actorId,
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
  mockSetProductReviewMerchantReply.mockReset()
  mockSetProductReviewMerchantReply.mockImplementation(async () => ({
    review: {
      id: "pr_1",
      product_id: "prod_1",
      customer_id: "cust_1",
      merchant_reply_text: "Спасибо за отзыв!",
      merchant_reply_by: "usr_admin",
      merchant_reply_at: "2026-05-15T00:00:00.000Z",
    },
    productId: "prod_1",
    statusChanged: false,
    recalculated: false,
  }))
  mockClearProductReviewMerchantReply.mockReset()
  mockClearProductReviewMerchantReply.mockImplementation(async () => ({
    review: {
      id: "pr_1",
      product_id: "prod_1",
      customer_id: "cust_1",
      merchant_reply_text: null,
      merchant_reply_by: null,
      merchant_reply_at: null,
    },
    productId: "prod_1",
    statusChanged: false,
    recalculated: false,
  }))
  mockRevalidateStorefrontTags.mockReset()
  mockRevalidateStorefrontTags.mockImplementation(async () => ({
    ok: true,
    status: 200,
    revalidated: [],
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Schema tests (validateAndTransformBody runs before the handler)
// ---------------------------------------------------------------------------

describe("AdminProductReviewReplySchema (strict)", () => {
  it("accepts a valid 1..1000 char text (after trim)", () => {
    expect(
      AdminProductReviewReplySchema.safeParse({ text: "thanks" }).success
    ).toBe(true)
    expect(
      AdminProductReviewReplySchema.safeParse({
        text: "x".repeat(1000),
      }).success
    ).toBe(true)
  })

  it("rejects empty/whitespace-only text", () => {
    expect(AdminProductReviewReplySchema.safeParse({}).success).toBe(false)
    expect(
      AdminProductReviewReplySchema.safeParse({ text: "" }).success
    ).toBe(false)
    expect(
      AdminProductReviewReplySchema.safeParse({ text: "   " }).success
    ).toBe(false)
  })

  it("rejects text over 1000 chars", () => {
    expect(
      AdminProductReviewReplySchema.safeParse({
        text: "x".repeat(1001),
      }).success
    ).toBe(false)
  })

  it("rejects unknown keys", () => {
    expect(
      AdminProductReviewReplySchema.safeParse({
        text: "thanks",
        evil: "yes",
      }).success
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/reviews/:id/reply
// ---------------------------------------------------------------------------

describe("POST /admin/reviews/:id/reply", () => {
  it("calls setProductReviewMerchantReply with reviewId, text and authorId", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      reviewId: "pr_1",
      actorId: "usr_42",
      validatedBody: { text: "thank you" },
    })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    const arg = mockSetProductReviewMerchantReply.mock.calls[0][0] as {
      reviewId: string
      text: string
      authorId: string | null
    }
    expect(arg.reviewId).toBe("pr_1")
    expect(arg.text).toBe("thank you")
    expect(arg.authorId).toBe("usr_42")
  })

  it("invalidates the right tags on success: product-reviews-${id} + top-reviews", async () => {
    mockSetProductReviewMerchantReply.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        product_id: "prod_42",
        customer_id: "cust_42",
        merchant_reply_text: "Спасибо!",
        merchant_reply_by: "usr_42",
        merchant_reply_at: "2026-05-15T00:00:00.000Z",
      },
      productId: "prod_42",
      statusChanged: false,
      recalculated: false,
    }))

    const { res } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual(["product-reviews-prod_42", "top-reviews"])
  })

  it("not_found from module → 404, no revalidation", async () => {
    mockSetProductReviewMerchantReply.mockImplementation(async () => {
      throw new ProductReviewError("not_found")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_404" })

    await POST(req, res)

    expect(recorder.status).toBe(404)
    expect(recorder.body).toMatchObject({ code: "not_found" })
    expect(mockRevalidateStorefrontTags).not.toHaveBeenCalled()
  })

  it("reply_text_required from module → 400 (defence-in-depth path)", async () => {
    mockSetProductReviewMerchantReply.mockImplementation(async () => {
      throw new ProductReviewError("reply_text_required")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "reply_text_required" })
    expect(mockRevalidateStorefrontTags).not.toHaveBeenCalled()
  })

  it("reply_text_too_long from module → 400 (defence-in-depth path)", async () => {
    mockSetProductReviewMerchantReply.mockImplementation(async () => {
      throw new ProductReviewError("reply_text_too_long")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "reply_text_too_long" })
  })

  it("missing :id → 400 review_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "" })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "review_id_required" })
    expect(mockSetProductReviewMerchantReply).not.toHaveBeenCalled()
  })

  it("missing actor_id → authorId is null", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      reviewId: "pr_1",
      actorId: null,
      validatedBody: { text: "thanks" },
    })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    const arg = mockSetProductReviewMerchantReply.mock.calls[0][0] as {
      authorId: string | null
    }
    expect(arg.authorId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// DELETE /admin/reviews/:id/reply
// ---------------------------------------------------------------------------

describe("DELETE /admin/reviews/:id/reply", () => {
  it("happy path: 200 with cleared review and invalidates tags", async () => {
    mockClearProductReviewMerchantReply.mockImplementation(async () => ({
      review: {
        id: "pr_1",
        product_id: "prod_42",
        customer_id: "cust_42",
        merchant_reply_text: null,
        merchant_reply_by: null,
        merchant_reply_at: null,
      },
      productId: "prod_42",
      statusChanged: false,
      recalculated: false,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(200)
    expect(mockClearProductReviewMerchantReply).toHaveBeenCalledTimes(1)
    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual(["product-reviews-prod_42", "top-reviews"])
  })

  it("not_found from module → 404, no revalidation", async () => {
    mockClearProductReviewMerchantReply.mockImplementation(async () => {
      throw new ProductReviewError("not_found")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_404" })

    await DELETE(req, res)

    expect(recorder.status).toBe(404)
    expect(recorder.body).toMatchObject({ code: "not_found" })
    expect(mockRevalidateStorefrontTags).not.toHaveBeenCalled()
  })

  it("missing :id → 400 review_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "" })

    await DELETE(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "review_id_required" })
    expect(mockClearProductReviewMerchantReply).not.toHaveBeenCalled()
  })
})
