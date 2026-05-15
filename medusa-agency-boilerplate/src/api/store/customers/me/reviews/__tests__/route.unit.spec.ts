/**
 * Unit tests for `GET /store/customers/me/reviews`.
 *
 * Plan §6.5: lists the customer's own reviews across all products including
 * pending/rejected entries. The handler is a thin delegation to
 * [`listProductReviewsForCustomer`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1237)
 * with strict query validation.
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

const mockListProductReviewsForCustomer = jest.fn<any>(async () => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
}))
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
    listProductReviewsForCustomer: (...args: any[]) =>
      mockListProductReviewsForCustomer(...args),
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

function buildReq(input: {
  customerId?: string | null
  query?: Record<string, unknown>
}): any {
  return {
    query: input.query || {},
    auth_context: {
      actor_id: input.customerId ?? "cus_1",
      actor_type: "customer",
    },
    scope: { resolve: jest.fn() },
  }
}

beforeEach(() => {
  mockListProductReviewsForCustomer.mockReset()
  mockListProductReviewsForCustomer.mockImplementation(async () => ({
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

describe("GET /store/customers/me/reviews", () => {
  it("delegates to listProductReviewsForCustomer and returns its result", async () => {
    const result = {
      items: [{ id: "pr_1", product_id: "prod_1", status: "pending" }],
      total: 1,
      page: 1,
      pageSize: 20,
    }
    mockListProductReviewsForCustomer.mockImplementation(async () => result)

    const { res, recorder } = buildResponse()
    const req = buildReq({ customerId: "cus_42" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual(result)

    const arg = mockListProductReviewsForCustomer.mock.calls[0][0] as {
      customerId: string
      page: number
      pageSize: number
    }
    expect(arg.customerId).toBe("cus_42")
    expect(arg.page).toBe(1)
    expect(arg.pageSize).toBe(20)
  })

  it("missing auth (empty actor_id) → 401 customer_auth_required", async () => {
    // The middleware normally guarantees auth, but the handler also has its
    // own guard — exercise it explicitly to lock the contract.
    const { res, recorder } = buildResponse()
    const req = buildReq({ customerId: "" })

    await GET(req, res)

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({ code: "customer_auth_required" })
    expect(mockListProductReviewsForCustomer).not.toHaveBeenCalled()
  })

  it("unknown query key → 400 invalid_query (strict)", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      customerId: "cus_1",
      query: { page: "1", evil: "yes" },
    })

    await GET(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "invalid_query" })
    expect(mockListProductReviewsForCustomer).not.toHaveBeenCalled()
  })

  it("forwards parsed page/pageSize to the module", async () => {
    const { res } = buildResponse()
    const req = buildReq({
      customerId: "cus_1",
      query: { page: "2", pageSize: "5" },
    })

    await GET(req, res)

    const arg = mockListProductReviewsForCustomer.mock.calls[0][0] as {
      page: number
      pageSize: number
    }
    expect(arg.page).toBe(2)
    expect(arg.pageSize).toBe(5)
  })
})
