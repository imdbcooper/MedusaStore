/**
 * Unit tests for `GET` and `DELETE /admin/reviews/:id`.
 *
 * Plan §4.2 / §4.3 / §6.6 / §9 Phase 2 шаг 6:
 *   - GET returns `{ review }` when found, 404 `{ code: "not_found" }` otherwise;
 *   - DELETE returns 204 on success and triggers
 *     [`revalidateStorefrontTags`](medusa-agency-boilerplate/src/lib/storefront-revalidate.ts:69)
 *     ONLY when the module reports `recalculated: true`. Deleting a
 *     pending/rejected row keeps the aggregates intact, so no invalidation.
 *   - The customer-scoped `customer-reviews-${customer_id}` tag is added
 *     to the invalidation set ONLY when `recalculated: true` AND
 *     `customerId` is non-null (anonymized rows have no surface to
 *     refresh). Plan §9 Phase 2 шаг 6 explicitly: «при approved cleanup».
 *   - DELETE NEVER sends a moderation email — admin removal is treated as
 *     an admin decision, not customer-facing feedback (plan §6.3).
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

const mockGetProductReviewById = jest.fn<any>(async () => null)
const mockDeleteProductReviewAsAdmin = jest.fn<any>(async () => ({}))
const mockGetProductReviewsPgConnection = jest.fn<any>(() => ({
  __pgConnection: true,
}))
const mockRevalidateStorefrontTags = jest.fn<any>(async () => ({
  ok: true,
  status: 200,
  revalidated: [],
}))

jest.mock("../../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../../modules/product-reviews"
  ) as typeof import("../../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    getProductReviewById: (...args: any[]) =>
      mockGetProductReviewById(...args),
    deleteProductReviewAsAdmin: (...args: any[]) =>
      mockDeleteProductReviewAsAdmin(...args),
    getProductReviewsPgConnection: (...args: any[]) =>
      mockGetProductReviewsPgConnection(...args),
  }
})

jest.mock("../../../../../lib/storefront-revalidate", () => ({
  __esModule: true,
  revalidateStorefrontTags: (...args: any[]) =>
    mockRevalidateStorefrontTags(...args),
}))

const { ProductReviewError } = jest.requireActual(
  "../../../../../modules/product-reviews"
) as typeof import("../../../../../modules/product-reviews")

let GET: typeof import("../route")["GET"]
let DELETE: typeof import("../route")["DELETE"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  GET = mod.GET
  DELETE = mod.DELETE
})

type ResRecorder = { status?: number; body?: any; ended?: boolean }

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
    end() {
      recorder.ended = true
      return this
    },
  }
  return { res, recorder }
}

function buildReq(input: { reviewId?: string }): any {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return {
    params: { id: input.reviewId },
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: {
      resolve: jest.fn((key: any) =>
        key === ContainerRegistrationKeys.LOGGER ? logger : undefined
      ),
    },
  }
}

beforeEach(() => {
  mockGetProductReviewById.mockReset()
  mockGetProductReviewById.mockImplementation(async () => null)
  mockDeleteProductReviewAsAdmin.mockReset()
  mockDeleteProductReviewAsAdmin.mockImplementation(async () => ({
    productId: "prod_1",
    customerId: "cust_1",
    recalculated: false,
  }))
  mockGetProductReviewsPgConnection.mockReset()
  mockGetProductReviewsPgConnection.mockImplementation(() => ({
    __pgConnection: true,
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
// GET
// ---------------------------------------------------------------------------

describe("GET /admin/reviews/:id", () => {
  it("returns 200 { review } when row exists", async () => {
    const review = {
      id: "pr_1",
      product_id: "prod_1",
      rating: 5,
      status: "approved",
    }
    mockGetProductReviewById.mockImplementation(async () => review)

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({ review })
  })

  it("returns 404 not_found when row missing", async () => {
    mockGetProductReviewById.mockImplementation(async () => null)

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_404" })

    await GET(req, res)

    expect(recorder.status).toBe(404)
    expect(recorder.body).toMatchObject({ code: "not_found" })
  })

  it("missing :id → 400 review_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "review_id_required" })
    expect(mockGetProductReviewById).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe("DELETE /admin/reviews/:id", () => {
  it("success with recalculated:true and customer_id → 204 + all three tags", async () => {
    mockDeleteProductReviewAsAdmin.mockImplementation(async () => ({
      productId: "prod_42",
      customerId: "cust_42",
      recalculated: true,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(204)
    expect(recorder.ended).toBe(true)

    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual([
      "product-rating-prod_42",
      "product-reviews-prod_42",
      "customer-reviews-cust_42",
      "top-reviews",
    ])
  })

  it("success with recalculated:true and anonymized customerId:null → product tags + top-reviews", async () => {
    mockDeleteProductReviewAsAdmin.mockImplementation(async () => ({
      productId: "prod_42",
      customerId: null,
      recalculated: true,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(204)
    expect(mockRevalidateStorefrontTags).toHaveBeenCalledTimes(1)
    const tagsArg = mockRevalidateStorefrontTags.mock.calls[0][0] as string[]
    expect(tagsArg).toEqual([
      "product-rating-prod_42",
      "product-reviews-prod_42",
      "top-reviews",
    ])
  })

  it("success with recalculated:false (deleted pending/rejected) → 204 + no revalidate even if customerId is set", async () => {
    mockDeleteProductReviewAsAdmin.mockImplementation(async () => ({
      productId: "prod_42",
      customerId: "cust_42",
      recalculated: false,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(204)
    expect(mockRevalidateStorefrontTags).not.toHaveBeenCalled()
  })

  it("not_found from module → 404 not_found", async () => {
    mockDeleteProductReviewAsAdmin.mockImplementation(async () => {
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
    expect(mockDeleteProductReviewAsAdmin).not.toHaveBeenCalled()
  })

  it("non-typed error → 500 internal_error", async () => {
    mockDeleteProductReviewAsAdmin.mockImplementation(async () => {
      throw new Error("boom")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(500)
    expect(recorder.body).toMatchObject({ code: "internal_error" })
  })
})
