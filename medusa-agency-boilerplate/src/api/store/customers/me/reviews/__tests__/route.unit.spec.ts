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
  it("delegates to listProductReviewsForCustomer and returns whitelisted MINE items", async () => {
    // Hotfix Phase 3 P0: customer-only items are mapped through
    // `toMineReview` — `status` and `rejection_reason` ARE kept (the
    // `/account/reviews` UI needs them), but `customer_id` / `order_id` /
    // `moderated_by` / `moderated_at` are stripped.
    const fullRow = {
      id: "pr_1",
      product_id: "prod_1",
      customer_id: "cus_42",
      order_id: "ord_1",
      rating: 4,
      title: "Хорошо",
      text: "x".repeat(50),
      pros: null,
      cons: null,
      status: "rejected",
      moderated_by: "admin_1",
      moderated_at: "2026-01-01T00:00:00.000Z",
      rejection_reason: "ненормативная лексика",
      verified_purchase: true,
      helpful_count: 0,
      images: null,
      customer_name: "Иван И.",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }
    mockListProductReviewsForCustomer.mockImplementation(async () => ({
      items: [fullRow],
      total: 1,
      page: 1,
      pageSize: 20,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ customerId: "cus_42" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body.total).toBe(1)
    expect(Array.isArray(recorder.body.items)).toBe(true)
    expect(recorder.body.items).toHaveLength(1)

    const item = recorder.body.items[0]
    // Mine-only fields kept:
    expect(item.id).toBe("pr_1")
    expect(item.product_id).toBe("prod_1")
    expect(item.customer_name).toBe("Иван И.")
    expect(item.status).toBe("rejected")
    expect(item.rejection_reason).toBe("ненормативная лексика")
    expect(item.rating).toBe(4)
    expect(item.verified_purchase).toBe(true)
    // Stripped fields (Phase 3 P0):
    expect(item).not.toHaveProperty("customer_id")
    expect(item).not.toHaveProperty("order_id")
    expect(item).not.toHaveProperty("moderated_by")
    expect(item).not.toHaveProperty("moderated_at")

    const arg = mockListProductReviewsForCustomer.mock.calls[0][0] as {
      customerId: string
      page: number
      pageSize: number
    }
    expect(arg.customerId).toBe("cus_42")
    expect(arg.page).toBe(1)
    expect(arg.pageSize).toBe(20)
  })

  it("response items have status + rejection_reason but NO customer_id / order_id", async () => {
    const fullRow = {
      id: "pr_2",
      product_id: "prod_2",
      customer_id: "cus_42",
      order_id: null,
      rating: 5,
      title: null,
      text: "x".repeat(50),
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
    mockListProductReviewsForCustomer.mockImplementation(async () => ({
      items: [fullRow],
      total: 1,
      page: 1,
      pageSize: 20,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ customerId: "cus_42" })

    await GET(req, res)

    expect(recorder.status).toBe(200)
    const item = recorder.body.items[0]
    expect(item).toHaveProperty("status", "approved")
    expect(item).toHaveProperty("rejection_reason", null)
    expect(item).not.toHaveProperty("customer_id")
    expect(item).not.toHaveProperty("order_id")
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
