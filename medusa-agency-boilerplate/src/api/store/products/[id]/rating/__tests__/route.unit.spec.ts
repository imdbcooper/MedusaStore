/**
 * Unit tests for `GET /store/products/:id/rating`.
 *
 * The handler is intentionally minimal: it only delegates to
 * [`getProductRatingSummary`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1199)
 * and validates that `:id` is non-empty. We mock the module so the test
 * stays purely synchronous and never touches Postgres (plan §10 — Phase 1
 * unit tests do not exercise SQL).
 *
 * Mock style mirrors the existing
 * [`onboarding/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/customers/me/onboarding/__tests__/route.unit.spec.ts:1):
 * - `jest.mock` with a relative specifier that resolves to the same file
 *   the route imports;
 * - deferred `require("../route")` inside `beforeAll` so the factory is
 *   wired before the route module loads its dependencies.
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

const mockGetProductRatingSummary = jest.fn<any>(async () => ({
  product_id: "prod_default",
  average_rating: null,
  total_reviews: 0,
  rating_1: 0,
  rating_2: 0,
  rating_3: 0,
  rating_4: 0,
  rating_5: 0,
  updated_at: null,
}))

const mockGetProductReviewsPgConnection = jest.fn<any>(() => ({
  // Opaque marker so the test can assert it is forwarded as-is.
  __pgConnection: true,
}))

jest.mock("../../../../../../modules/product-reviews", () => ({
  __esModule: true,
  getProductRatingSummary: (...args: any[]) =>
    mockGetProductRatingSummary(...args),
  getProductReviewsPgConnection: (...args: any[]) =>
    mockGetProductReviewsPgConnection(...args),
}))

let GET: typeof import("../route")["GET"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  GET = mod.GET
})

type ResRecorder = {
  status?: number
  body?: any
}

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

function buildReq(input: { productId?: string }): any {
  return {
    params: { id: input.productId },
    scope: {
      resolve: jest.fn(),
    },
  }
}

beforeEach(() => {
  mockGetProductRatingSummary.mockReset()
  mockGetProductRatingSummary.mockImplementation(async () => ({
    product_id: "prod_default",
    average_rating: null,
    total_reviews: 0,
    rating_1: 0,
    rating_2: 0,
    rating_3: 0,
    rating_4: 0,
    rating_5: 0,
    updated_at: null,
  }))
  mockGetProductReviewsPgConnection.mockReset()
  mockGetProductReviewsPgConnection.mockImplementation(() => ({
    __pgConnection: true,
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("GET /store/products/:id/rating", () => {
  it("returns 400 product_id_required when :id is empty", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ productId: "" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "product_id_required" })
    expect(mockGetProductRatingSummary).not.toHaveBeenCalled()
  })

  it("delegates to getProductRatingSummary and returns the row", async () => {
    const summary = {
      product_id: "prod_42",
      average_rating: 4.5,
      total_reviews: 12,
      rating_1: 0,
      rating_2: 0,
      rating_3: 1,
      rating_4: 4,
      rating_5: 7,
      updated_at: "2026-05-14T00:00:00.000Z",
    }
    mockGetProductRatingSummary.mockImplementation(async () => summary)

    const { res, recorder } = buildResponse()
    const req = buildReq({ productId: "prod_42" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual(summary)

    // Forwarded args: pg connection from container + productId.
    expect(mockGetProductRatingSummary).toHaveBeenCalledTimes(1)
    const callArg = mockGetProductRatingSummary.mock.calls[0][0] as {
      pgConnection: unknown
      productId: string
    }
    expect(callArg.productId).toBe("prod_42")
    expect(callArg.pgConnection).toEqual({ __pgConnection: true })
  })

  it("trims surrounding whitespace from :id before forwarding", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ productId: "  prod_with_spaces  " })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(mockGetProductRatingSummary).toHaveBeenCalledTimes(1)
    const callArg = mockGetProductRatingSummary.mock.calls[0][0] as {
      productId: string
    }
    expect(callArg.productId).toBe("prod_with_spaces")
  })
})
