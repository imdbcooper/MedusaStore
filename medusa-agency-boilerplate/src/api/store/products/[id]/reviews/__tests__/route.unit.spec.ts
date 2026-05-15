/**
 * Unit tests for the customer-facing review endpoints
 * (`/store/products/:id/reviews`, GET + POST).
 *
 * Covers (plan §1.1 п.20 / §9 шаг 10 / §10):
 *   - strict Zod schema (`images` and other unknown keys → `.safeParse` fails);
 *   - honeypot branch (handler short-circuits to 201 without calling
 *     `createProductReview`);
 *   - verified-purchase branch (`REVIEWS_REQUIRE_PURCHASE` env, 403 + verify,
 *     pass-through);
 *   - module error mapping (UNIQUE → 409, customer_not_found → 401);
 *   - daily cap → 429;
 *   - `REVIEWS_AUTO_APPROVE` env propagation;
 *   - GET delegation + strict query schema.
 *
 * Mock style mirrors
 * [`onboarding/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/customers/me/onboarding/__tests__/route.unit.spec.ts:1):
 *  - relative `jest.mock` specifier matching the route's importer;
 *  - deferred `require("../route")` inside `beforeAll`.
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

// ---------------------------------------------------------------------------
// Mocks for the product-reviews module — preserve `ProductReviewError` real so
// the handler's `instanceof` check fires correctly when we throw the error.
// ---------------------------------------------------------------------------

const mockCreateProductReview = jest.fn<any>(async () => ({}))
const mockListApprovedProductReviews = jest.fn<any>(async () => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
}))
const mockVerifyCustomerPurchasedProduct = jest.fn<any>(async () => ({
  verified: false,
  orderId: null,
}))
const mockCountCustomerReviewsInLastDay = jest.fn<any>(async () => 0)

const mockGetProductReviewsPgConnection = jest.fn<any>(() => ({
  __pgConnection: true,
}))

jest.mock("../../../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../../../modules/product-reviews"
  ) as typeof import("../../../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    createProductReview: (...args: any[]) => mockCreateProductReview(...args),
    listApprovedProductReviews: (...args: any[]) =>
      mockListApprovedProductReviews(...args),
    verifyCustomerPurchasedProduct: (...args: any[]) =>
      mockVerifyCustomerPurchasedProduct(...args),
    countCustomerReviewsInLastDay: (...args: any[]) =>
      mockCountCustomerReviewsInLastDay(...args),
    getProductReviewsPgConnection: (...args: any[]) =>
      mockGetProductReviewsPgConnection(...args),
  }
})

// We need the real `ProductReviewError` class to throw from the create mock so
// the handler's `instanceof` check matches.
const { ProductReviewError } = jest.requireActual(
  "../../../../../../modules/product-reviews"
) as typeof import("../../../../../../modules/product-reviews")

let GET: typeof import("../route")["GET"]
let POST: typeof import("../route")["POST"]
let StoreCreateProductReviewSchema: typeof import("../route")["StoreCreateProductReviewSchema"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  GET = mod.GET
  POST = mod.POST
  StoreCreateProductReviewSchema = mod.StoreCreateProductReviewSchema
})

// ---------------------------------------------------------------------------
// Tiny req/res builders (kept inline — same convention as the onboarding test).
// ---------------------------------------------------------------------------

type ResRecorder = {
  status?: number
  body?: any
  ended?: boolean
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
    end() {
      recorder.ended = true
      return this
    },
  }
  return { res, recorder }
}

function buildLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}

function buildScope() {
  const logger = buildLogger()
  return {
    logger,
    resolve: jest.fn((key: any) => {
      if (key === ContainerRegistrationKeys.LOGGER) {
        return logger
      }
      return undefined
    }),
  }
}

function buildReq(input: {
  productId?: string
  customerId?: string | null
  validatedBody?: Record<string, unknown>
  query?: Record<string, unknown>
}): any {
  const scope = buildScope()
  return {
    params: { id: input.productId },
    query: input.query || {},
    validatedBody: input.validatedBody,
    auth_context: {
      actor_id: input.customerId ?? "cus_1",
      actor_type: "customer",
    },
    scope,
  }
}

// Snapshot env keys we touch so we can restore them between tests.
const ENV_KEYS = ["REVIEWS_REQUIRE_PURCHASE", "REVIEWS_AUTO_APPROVE"]
const originalEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k]
    delete process.env[k]
  }

  mockCreateProductReview.mockReset()
  mockCreateProductReview.mockImplementation(async () => ({
    id: "pr_1",
    product_id: "prod_1",
    customer_id: "cus_1",
    status: "pending",
    rating: 5,
    text: "x".repeat(50),
  }))
  mockListApprovedProductReviews.mockReset()
  mockListApprovedProductReviews.mockImplementation(async () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  }))
  mockVerifyCustomerPurchasedProduct.mockReset()
  mockVerifyCustomerPurchasedProduct.mockImplementation(async () => ({
    verified: false,
    orderId: null,
  }))
  mockCountCustomerReviewsInLastDay.mockReset()
  mockCountCustomerReviewsInLastDay.mockImplementation(async () => 0)
  mockGetProductReviewsPgConnection.mockReset()
  mockGetProductReviewsPgConnection.mockImplementation(() => ({
    __pgConnection: true,
  }))
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = originalEnv[k]
    }
  }
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Schema-only tests — `validateAndTransformBody` middleware enforces these
// before the handler runs, so we exercise the schema directly (per task
// "Если расхождение" note).
// ---------------------------------------------------------------------------

describe("StoreCreateProductReviewSchema (strict)", () => {
  it("rejects unknown keys including `images` (Phase 1 §13)", () => {
    const parse = StoreCreateProductReviewSchema.safeParse({
      rating: 5,
      text: "x".repeat(50),
      images: [],
    })
    expect(parse.success).toBe(false)
  })

  it("accepts the minimal valid payload", () => {
    const parse = StoreCreateProductReviewSchema.safeParse({
      rating: 5,
      text: "x".repeat(50),
    })
    expect(parse.success).toBe(true)
  })

  it("rejects non-integer / out-of-range rating", () => {
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 0,
        text: "x".repeat(50),
      }).success
    ).toBe(false)
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 6,
        text: "x".repeat(50),
      }).success
    ).toBe(false)
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: "5",
        text: "x".repeat(50),
      }).success
    ).toBe(false)
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 4.5,
        text: "x".repeat(50),
      }).success
    ).toBe(false)
  })

  it("rejects text under MIN and over MAX (defaults 10/2000)", () => {
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 5,
        text: "short",
      }).success
    ).toBe(false)
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 5,
        text: "x".repeat(2001),
      }).success
    ).toBe(false)
  })

  it("title 120 chars ok, 121 chars rejected", () => {
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 5,
        text: "x".repeat(50),
        title: "t".repeat(120),
      }).success
    ).toBe(true)
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 5,
        text: "x".repeat(50),
        title: "t".repeat(121),
      }).success
    ).toBe(false)
  })

  it("pros / cons over 1000 chars rejected", () => {
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 5,
        text: "x".repeat(50),
        pros: "p".repeat(1001),
      }).success
    ).toBe(false)
    expect(
      StoreCreateProductReviewSchema.safeParse({
        rating: 5,
        text: "x".repeat(50),
        cons: "c".repeat(1001),
      }).success
    ).toBe(false)
  })

  it("`website` honeypot is allowed", () => {
    const parse = StoreCreateProductReviewSchema.safeParse({
      rating: 5,
      text: "x".repeat(50),
      website: "http://spam.example",
    })
    expect(parse.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /store/products/:id/reviews — handler tests
// ---------------------------------------------------------------------------

describe("POST /store/products/:id/reviews", () => {
  it("honeypot branch: returns 201 without calling createProductReview", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: {
        rating: 5,
        text: "x".repeat(50),
        website: "http://spam.example",
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(201)
    expect(recorder.body).toEqual({ ok: true })
    expect(mockCreateProductReview).not.toHaveBeenCalled()
    expect(mockCountCustomerReviewsInLastDay).not.toHaveBeenCalled()
    expect(mockVerifyCustomerPurchasedProduct).not.toHaveBeenCalled()
  })

  it("verified_purchase=true required, verify returns false → 403 require_purchase", async () => {
    process.env.REVIEWS_REQUIRE_PURCHASE = "true"
    mockVerifyCustomerPurchasedProduct.mockImplementation(async () => ({
      verified: false,
      orderId: null,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(403)
    expect(recorder.body).toMatchObject({ code: "require_purchase" })
    expect(mockVerifyCustomerPurchasedProduct).toHaveBeenCalledTimes(1)
    expect(mockCreateProductReview).not.toHaveBeenCalled()
  })

  it("verified_purchase=true required, verify returns true → continues to create", async () => {
    process.env.REVIEWS_REQUIRE_PURCHASE = "true"
    mockVerifyCustomerPurchasedProduct.mockImplementation(async () => ({
      verified: true,
      orderId: "ord_1",
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(201)
    expect(mockVerifyCustomerPurchasedProduct).toHaveBeenCalledTimes(1)
    expect(mockCreateProductReview).toHaveBeenCalledTimes(1)
  })

  it("REVIEWS_REQUIRE_PURCHASE not set → verify NOT called", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(201)
    expect(mockVerifyCustomerPurchasedProduct).not.toHaveBeenCalled()
    expect(mockCreateProductReview).toHaveBeenCalledTimes(1)
  })

  it("REVIEWS_REQUIRE_PURCHASE='false' → verify NOT called", async () => {
    process.env.REVIEWS_REQUIRE_PURCHASE = "false"

    const { res } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(mockVerifyCustomerPurchasedProduct).not.toHaveBeenCalled()
  })

  it("UNIQUE conflict from module → 409 duplicate_review", async () => {
    mockCreateProductReview.mockImplementation(async () => {
      throw new ProductReviewError("duplicate_review", "Already reviewed")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(409)
    expect(recorder.body).toMatchObject({ code: "duplicate_review" })
  })

  it("daily cap (>=10) → 429 rate_limited; createProductReview NOT called", async () => {
    mockCountCustomerReviewsInLastDay.mockImplementation(async () => 10)

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(429)
    expect(recorder.body).toMatchObject({ code: "rate_limited" })
    expect(mockCreateProductReview).not.toHaveBeenCalled()
  })

  it("customer_not_found from module → 401", async () => {
    mockCreateProductReview.mockImplementation(async () => {
      throw new ProductReviewError("customer_not_found")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({ code: "customer_not_found" })
  })

  it("REVIEWS_AUTO_APPROVE='true' → createProductReview called with autoApprove:true", async () => {
    process.env.REVIEWS_AUTO_APPROVE = "true"

    const { res } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    const arg = mockCreateProductReview.mock.calls[0][0] as {
      autoApprove: boolean
      productId: string
      customerId: string
    }
    expect(arg.autoApprove).toBe(true)
    expect(arg.productId).toBe("prod_1")
    expect(arg.customerId).toBe("cus_1")
  })

  it("without REVIEWS_AUTO_APPROVE → createProductReview called with autoApprove:false", async () => {
    const { res } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    const arg = mockCreateProductReview.mock.calls[0][0] as {
      autoApprove: boolean
    }
    expect(arg.autoApprove).toBe(false)
  })

  it("missing :id → 400 product_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "product_id_required" })
  })

  it("missing customer auth → 401 customer_auth_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({ code: "customer_auth_required" })
  })
})

// ---------------------------------------------------------------------------
// GET /store/products/:id/reviews — handler tests
// ---------------------------------------------------------------------------

describe("GET /store/products/:id/reviews", () => {
  it("delegates to listApprovedProductReviews and returns its result", async () => {
    const result = {
      items: [
        {
          id: "pr_1",
          product_id: "prod_1",
          customer_id: "cus_1",
          rating: 5,
          text: "great",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }
    mockListApprovedProductReviews.mockImplementation(async () => result)

    const { res, recorder } = buildResponse()
    const req = buildReq({ productId: "prod_1" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual(result)

    const arg = mockListApprovedProductReviews.mock.calls[0][0] as {
      productId: string
      page: number
      pageSize: number
      sort: string
    }
    expect(arg.productId).toBe("prod_1")
    expect(arg.page).toBe(1)
    expect(arg.pageSize).toBe(20)
    expect(arg.sort).toBe("newest")
  })

  it("missing :id → 400 product_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ productId: "" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "product_id_required" })
    expect(mockListApprovedProductReviews).not.toHaveBeenCalled()
  })

  it("unknown query key → 400 invalid_query (strict schema)", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      query: { page: "1", evil: "yes" },
    })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
    expect(mockListApprovedProductReviews).not.toHaveBeenCalled()
  })

  it("invalid sort enum → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      query: { sort: "not_a_sort" },
    })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("clamps query: page=0 / pageSize=0 → 400; pageSize=200 → 400", async () => {
    {
      const { res, recorder } = buildResponse()
      const req = buildReq({ productId: "prod_1", query: { page: "0" } })
      await GET(req, res)
      expect(recorder.status).toBe(400)
    }
    {
      const { res, recorder } = buildResponse()
      const req = buildReq({ productId: "prod_1", query: { pageSize: "0" } })
      await GET(req, res)
      expect(recorder.status).toBe(400)
    }
    {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { pageSize: "200" },
      })
      await GET(req, res)
      expect(recorder.status).toBe(400)
    }
  })

  it("forwards parsed page/pageSize/sort to module", async () => {
    const { res } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      query: { page: "3", pageSize: "5", sort: "helpful" },
    })

    await GET(req, res)

    const arg = mockListApprovedProductReviews.mock.calls[0][0] as {
      page: number
      pageSize: number
      sort: string
    }
    expect(arg.page).toBe(3)
    expect(arg.pageSize).toBe(5)
    expect(arg.sort).toBe("helpful")
  })
})
