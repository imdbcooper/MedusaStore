/**
 * Unit tests for the public homepage «Top reviews» endpoint
 * (`GET /store/reviews/top`).
 *
 * Covers (plan §9 Phase 3 п.5):
 *   - default params (no query) → `{limit:10, minRating:4, daysWindow:90}`;
 *   - full params (`limit=5&min_rating=5&days_window=30`);
 *   - `days_window=0` is forwarded as-is;
 *   - rejects `limit=0`, `limit=51`, `min_rating=0`, `min_rating=6`,
 *     `days_window=-1`, `days_window=366`;
 *   - rejects extra param;
 *   - rejects non-integer values;
 *   - 200 response shape `{items: []}`.
 *
 * Mock style mirrors
 * [`store/products/[id]/reviews/__tests__/route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/reviews/__tests__/route.unit.spec.ts:1):
 *  - relative `jest.mock` specifier matching the route's importer;
 *  - deferred `require("../route")` inside `beforeAll`.
 */

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const mockListTopApprovedProductReviewsAcrossCatalog = jest.fn<any>(
  async () => []
)
const mockGetProductReviewsPgConnection = jest.fn<any>(() => ({
  __pgConnection: true,
}))

jest.mock("../../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../../modules/product-reviews"
  ) as typeof import("../../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    listTopApprovedProductReviewsAcrossCatalog: (...args: any[]) =>
      mockListTopApprovedProductReviewsAcrossCatalog(...args),
    getProductReviewsPgConnection: (...args: any[]) =>
      mockGetProductReviewsPgConnection(...args),
  }
})

let GET: typeof import("../route")["GET"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  GET = mod.GET
})

// ---------------------------------------------------------------------------
// Tiny req/res builders.
// ---------------------------------------------------------------------------

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

function buildReq(query: Record<string, unknown> = {}): any {
  return {
    query,
    scope: buildScope(),
  }
}

beforeEach(() => {
  mockListTopApprovedProductReviewsAcrossCatalog.mockReset()
  mockListTopApprovedProductReviewsAcrossCatalog.mockImplementation(
    async () => []
  )
  mockGetProductReviewsPgConnection.mockReset()
  mockGetProductReviewsPgConnection.mockImplementation(() => ({
    __pgConnection: true,
  }))
})

// ---------------------------------------------------------------------------
// GET /store/reviews/top
// ---------------------------------------------------------------------------

describe("GET /store/reviews/top", () => {
  it("default params (no query) → {limit:10, minRating:4, daysWindow:90}", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({})

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({ items: [] })
    expect(mockListTopApprovedProductReviewsAcrossCatalog).toHaveBeenCalledTimes(
      1
    )
    const arg = mockListTopApprovedProductReviewsAcrossCatalog.mock
      .calls[0][0] as {
      limit: number
      minRating: number
      daysWindow: number
    }
    expect(arg.limit).toBe(10)
    expect(arg.minRating).toBe(4)
    expect(arg.daysWindow).toBe(90)
  })

  it("full params (limit=5&min_rating=5&days_window=30) forwarded as camelCase", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      limit: "5",
      min_rating: "5",
      days_window: "30",
    })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    const arg = mockListTopApprovedProductReviewsAcrossCatalog.mock
      .calls[0][0] as {
      limit: number
      minRating: number
      daysWindow: number
    }
    expect(arg.limit).toBe(5)
    expect(arg.minRating).toBe(5)
    expect(arg.daysWindow).toBe(30)
  })

  it("days_window=0 → forwarded as 0 (no date filter)", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ days_window: "0" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    const arg = mockListTopApprovedProductReviewsAcrossCatalog.mock
      .calls[0][0] as { daysWindow: number }
    expect(arg.daysWindow).toBe(0)
  })

  it("rejects limit=0 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ limit: "0" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
    expect(
      mockListTopApprovedProductReviewsAcrossCatalog
    ).not.toHaveBeenCalled()
  })

  it("rejects limit=51 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ limit: "51" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
    expect(
      mockListTopApprovedProductReviewsAcrossCatalog
    ).not.toHaveBeenCalled()
  })

  it("rejects min_rating=0 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ min_rating: "0" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("rejects min_rating=6 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ min_rating: "6" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("rejects days_window=-1 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ days_window: "-1" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("rejects days_window=366 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ days_window: "366" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("rejects extra param (strict schema) → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ limit: "10", evil: "yes" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
    expect(
      mockListTopApprovedProductReviewsAcrossCatalog
    ).not.toHaveBeenCalled()
  })

  it("rejects non-integer min_rating=4.5 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ min_rating: "4.5" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("rejects non-integer limit=2.5 → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ limit: "2.5" })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("returns module result as `{items: [...]}`", async () => {
    const items = [
      {
        id: "pr_1",
        product_id: "prod_1",
        rating: 5,
        helpful_count: 9,
        text: "amazing",
      },
      {
        id: "pr_2",
        product_id: "prod_2",
        rating: 4,
        helpful_count: 5,
        text: "great",
      },
    ]
    mockListTopApprovedProductReviewsAcrossCatalog.mockImplementation(
      async () => items
    )

    const { res, recorder } = buildResponse()
    const req = buildReq({})

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({ items })
  })

  it("module throw → 500 internal_error (caught)", async () => {
    mockListTopApprovedProductReviewsAcrossCatalog.mockImplementation(
      async () => {
        throw new Error("boom")
      }
    )

    const { res, recorder } = buildResponse()
    const req = buildReq({})

    await GET(req, res)

    expect(recorder.status).toBe(500)
    expect(recorder.body).toMatchObject({ code: "internal_error" })
  })
})
