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
    order_id: "ord_1",
    status: "pending",
    moderated_by: null,
    moderated_at: null,
    rejection_reason: null,
    rating: 5,
    title: null,
    text: "x".repeat(50),
    pros: null,
    cons: null,
    verified_purchase: false,
    helpful_count: 0,
    images: null,
    customer_name: "Иван И.",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
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
  it("response.review whitelisted: no customer_id / order_id / moderation metadata (Phase 3 P0)", async () => {
    // The mocked module returns the full row (set up in beforeEach); after
    // `toPublicReview` the response.review must have only the public shape.
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: { rating: 5, text: "x".repeat(50) },
    })

    await POST(req, res)

    expect(recorder.status).toBe(201)
    expect(recorder.body).toHaveProperty("review")
    const review = recorder.body.review
    expect(review.id).toBe("pr_1")
    expect(review.product_id).toBe("prod_1")
    expect(review.customer_name).toBe("Иван И.")
    expect(review).not.toHaveProperty("customer_id")
    expect(review).not.toHaveProperty("order_id")
    expect(review).not.toHaveProperty("status")
    expect(review).not.toHaveProperty("moderated_by")
    expect(review).not.toHaveProperty("moderated_at")
    expect(review).not.toHaveProperty("rejection_reason")
  })

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
  it("delegates to listApprovedProductReviews and returns whitelisted public items", async () => {
    // Hotfix Phase 3 P0: the module returns the full row, the route maps it
    // through `toPublicReview` and the response items must NOT contain
    // `customer_id`, `order_id` or moderation metadata.
    const fullRow = {
      id: "pr_1",
      product_id: "prod_1",
      customer_id: "cus_1",
      order_id: "ord_1",
      rating: 5,
      title: "great",
      text: "great",
      pros: null,
      cons: null,
      status: "approved",
      moderated_by: "admin_1",
      moderated_at: "2026-01-01T00:00:00.000Z",
      rejection_reason: null,
      verified_purchase: true,
      helpful_count: 3,
      images: null,
      customer_name: "Иван И.",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }
    mockListApprovedProductReviews.mockImplementation(async () => ({
      items: [fullRow],
      total: 1,
      page: 1,
      pageSize: 20,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ productId: "prod_1" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body.total).toBe(1)
    expect(recorder.body.page).toBe(1)
    expect(recorder.body.pageSize).toBe(20)
    expect(Array.isArray(recorder.body.items)).toBe(true)

    const item = recorder.body.items[0]
    expect(item.id).toBe("pr_1")
    expect(item.product_id).toBe("prod_1")
    expect(item.customer_name).toBe("Иван И.")
    expect(item.rating).toBe(5)
    expect(item.verified_purchase).toBe(true)
    expect(item.helpful_count).toBe(3)

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

  it("response items have no customer_id / order_id / moderation metadata (Phase 3 P0)", async () => {
    const fullRow = {
      id: "pr_1",
      product_id: "prod_1",
      customer_id: "cus_1",
      order_id: "ord_1",
      rating: 5,
      title: null,
      text: "great",
      pros: null,
      cons: null,
      status: "approved",
      moderated_by: "admin_1",
      moderated_at: "2026-01-01T00:00:00.000Z",
      rejection_reason: null,
      verified_purchase: true,
      helpful_count: 0,
      images: null,
      customer_name: "Иван И.",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }
    mockListApprovedProductReviews.mockImplementation(async () => ({
      items: [fullRow],
      total: 1,
      page: 1,
      pageSize: 20,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ productId: "prod_1" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    const item = recorder.body.items[0]
    expect(item).not.toHaveProperty("customer_id")
    expect(item).not.toHaveProperty("order_id")
    expect(item).not.toHaveProperty("status")
    expect(item).not.toHaveProperty("moderated_by")
    expect(item).not.toHaveProperty("moderated_at")
    expect(item).not.toHaveProperty("rejection_reason")
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

  // -------------------------------------------------------------------------
  // Phase 3 / step 2 — rating range + verified_only query filters
  // -------------------------------------------------------------------------

  describe("filters: min_rating / max_rating / verified_only", () => {
    it("accepts min_rating=3, max_rating=5, verified_only=true and forwards to module in camelCase", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: {
          min_rating: "3",
          max_rating: "5",
          verified_only: "true",
        },
      })

      await GET(req, res)

      expect(recorder.status).toBe(200)
      const arg = mockListApprovedProductReviews.mock.calls[0][0] as {
        productId: string
        minRating?: number
        maxRating?: number
        verifiedOnly?: boolean
      }
      expect(arg.productId).toBe("prod_1")
      expect(arg.minRating).toBe(3)
      expect(arg.maxRating).toBe(5)
      expect(arg.verifiedOnly).toBe(true)
    })

    it("accepts the exact-rating preset min_rating=max_rating=5", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { min_rating: "5", max_rating: "5" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(200)
      const arg = mockListApprovedProductReviews.mock.calls[0][0] as {
        minRating?: number
        maxRating?: number
        verifiedOnly?: boolean
      }
      expect(arg.minRating).toBe(5)
      expect(arg.maxRating).toBe(5)
      expect(arg.verifiedOnly).toBeUndefined()
    })

    it("accepts verified_only=false (no-op filter, forwarded as boolean)", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { verified_only: "false" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(200)
      const arg = mockListApprovedProductReviews.mock.calls[0][0] as {
        verifiedOnly?: boolean
      }
      expect(arg.verifiedOnly).toBe(false)
    })

    it("rejects min_rating=0 → 400 invalid_query", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { min_rating: "0" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(400)
      expect(recorder.body).toMatchObject({ code: "invalid_query" })
      expect(mockListApprovedProductReviews).not.toHaveBeenCalled()
    })

    it("rejects max_rating=6 → 400 invalid_query", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { max_rating: "6" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(400)
      expect(recorder.body).toMatchObject({ code: "invalid_query" })
      expect(mockListApprovedProductReviews).not.toHaveBeenCalled()
    })

    it("rejects min_rating=5 & max_rating=3 → 400 invalid_rating_range", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { min_rating: "5", max_rating: "3" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(400)
      expect(recorder.body).toMatchObject({ code: "invalid_query" })
      // The Zod refine message is propagated as the 400 body.message so the
      // storefront can branch on it if needed.
      expect(recorder.body.message).toBe("invalid_rating_range")
      expect(mockListApprovedProductReviews).not.toHaveBeenCalled()
    })

    it("rejects verified_only with non-boolean string → 400 invalid_query", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { verified_only: "invalid_string" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(400)
      expect(recorder.body).toMatchObject({ code: "invalid_query" })
      expect(mockListApprovedProductReviews).not.toHaveBeenCalled()
    })

    it("rejects non-integer min_rating=3.5 → 400 invalid_query", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { min_rating: "3.5" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(400)
      expect(recorder.body).toMatchObject({ code: "invalid_query" })
    })

    it("omitted filters → module receives undefined for all three", async () => {
      const { res, recorder } = buildResponse()
      const req = buildReq({
        productId: "prod_1",
        query: { page: "1", pageSize: "20", sort: "newest" },
      })

      await GET(req, res)

      expect(recorder.status).toBe(200)
      const arg = mockListApprovedProductReviews.mock.calls[0][0] as {
        minRating?: number
        maxRating?: number
        verifiedOnly?: boolean
      }
      expect(arg.minRating).toBeUndefined()
      expect(arg.maxRating).toBeUndefined()
      expect(arg.verifiedOnly).toBeUndefined()
    })
  })
})
