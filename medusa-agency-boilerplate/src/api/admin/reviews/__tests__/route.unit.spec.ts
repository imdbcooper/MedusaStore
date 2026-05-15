/**
 * Unit tests for `GET /admin/reviews` (moderation queue list).
 *
 * Plan §4.2 / §1.1 п.20: strict Zod query schema, filters propagated to
 * [`listProductReviewsForAdmin`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1318).
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

const mockListProductReviewsForAdmin = jest.fn<any>(async () => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
}))
const mockGetProductReviewsPgConnection = jest.fn<any>(() => ({
  __pgConnection: true,
}))

jest.mock("../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../modules/product-reviews"
  ) as typeof import("../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    listProductReviewsForAdmin: (...args: any[]) =>
      mockListProductReviewsForAdmin(...args),
    getProductReviewsPgConnection: (...args: any[]) =>
      mockGetProductReviewsPgConnection(...args),
  }
})

let GET: typeof import("../route")["GET"]

beforeAll(() => {
  GET = (require("../route") as typeof import("../route")).GET
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

function buildReq(input: { query?: Record<string, unknown> }): any {
  return {
    query: input.query || {},
    auth_context: { actor_id: "usr_admin", actor_type: "user" },
    scope: { resolve: jest.fn() },
  }
}

beforeEach(() => {
  mockListProductReviewsForAdmin.mockReset()
  mockListProductReviewsForAdmin.mockImplementation(async () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  }))
  mockGetProductReviewsPgConnection.mockReset()
  mockGetProductReviewsPgConnection.mockImplementation(() => ({
    __pgConnection: true,
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("GET /admin/reviews", () => {
  it("delegates to listProductReviewsForAdmin and returns its result", async () => {
    const result = {
      items: [{ id: "pr_1", status: "pending" }],
      total: 1,
      page: 1,
      pageSize: 20,
    }
    mockListProductReviewsForAdmin.mockImplementation(async () => result)

    const { res, recorder } = buildResponse()
    const req = buildReq({ query: {} })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual(result)
  })

  it("forwards filters: status / product_id / dateFrom / dateTo / page / pageSize", async () => {
    const { res } = buildResponse()
    const req = buildReq({
      query: {
        status: "pending",
        product_id: "prod_42",
        dateFrom: "2026-05-01T00:00:00.000Z",
        dateTo: "2026-05-31T23:59:59.999Z",
        page: "2",
        pageSize: "10",
      },
    })

    await GET(req, res)

    const arg = mockListProductReviewsForAdmin.mock.calls[0][0] as {
      filters: {
        status?: string
        productId?: string
        dateFrom?: string
        dateTo?: string
      }
      page: number
      pageSize: number
    }
    expect(arg.filters.status).toBe("pending")
    expect(arg.filters.productId).toBe("prod_42")
    expect(arg.filters.dateFrom).toBe("2026-05-01T00:00:00.000Z")
    expect(arg.filters.dateTo).toBe("2026-05-31T23:59:59.999Z")
    expect(arg.page).toBe(2)
    expect(arg.pageSize).toBe(10)
  })

  it("unknown query key → 400 invalid_query (strict)", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ query: { state: "pending" } })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
    expect(mockListProductReviewsForAdmin).not.toHaveBeenCalled()
  })

  it("invalid status enum → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ query: { status: "draft" } })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })

  it("invalid datetime → 400 invalid_query", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ query: { dateFrom: "not-a-date" } })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
  })
})
