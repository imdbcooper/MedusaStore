/**
 * Unit tests for `POST /admin/reviews/:id/approve`.
 *
 * Plan §4.3 / §6.6:
 *   - delegates to
 *     [`approveProductReview`](medusa-agency-boilerplate/src/modules/product-reviews.ts:824)
 *     with `reviewId` from params and `moderatedBy` from `auth_context.actor_id`;
 *   - calls
 *     [`revalidateStorefrontTags`](medusa-agency-boilerplate/src/lib/storefront-revalidate.ts:69)
 *     with `[product-rating-${productId}, product-reviews-${productId}]` ONLY
 *     when the module reports `recalculated: true`;
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
    review: { id: "pr_1", status: "approved", product_id: "prod_1" },
    productId: "prod_1",
    recalculated: true,
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

  it("recalculated:true → revalidateStorefrontTags called with both tags", async () => {
    mockApproveProductReview.mockImplementation(async () => ({
      review: { id: "pr_1", status: "approved", product_id: "prod_42" },
      productId: "prod_42",
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
    ])
  })

  it("recalculated:false → revalidateStorefrontTags NOT called", async () => {
    mockApproveProductReview.mockImplementation(async () => ({
      review: { id: "pr_1", status: "approved", product_id: "prod_42" },
      productId: "prod_42",
      recalculated: false,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(mockRevalidateStorefrontTags).not.toHaveBeenCalled()
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
  })

  it("missing :id → 400 review_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "" })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "review_id_required" })
    expect(mockApproveProductReview).not.toHaveBeenCalled()
  })
})
