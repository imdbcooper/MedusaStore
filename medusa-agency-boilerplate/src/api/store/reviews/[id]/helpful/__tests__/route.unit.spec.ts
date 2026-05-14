/**
 * Unit tests for `POST /store/reviews/:id/helpful`.
 *
 * Plan §1.1 п.20 / §4.3 / §10.4: the endpoint guarantees idempotency
 * (`(review_id, customer_id)` PK on `product_review_helpful` + atomic
 * increment `helpful_count = helpful_count + 1`). We mock
 * [`voteProductReviewHelpful`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1417)
 * and assert the handler returns the result as-is and maps
 * `not_found_or_not_approved` → 404.
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

const mockVoteProductReviewHelpful = jest.fn<any>(async () => ({
  helpful_count: 0,
  already_voted: false,
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
    voteProductReviewHelpful: (...args: any[]) =>
      mockVoteProductReviewHelpful(...args),
    getProductReviewsPgConnection: (...args: any[]) =>
      mockGetProductReviewsPgConnection(...args),
  }
})

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
  customerId?: string | null
}): any {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
  return {
    params: { id: input.reviewId },
    auth_context: {
      actor_id: input.customerId ?? "cus_1",
      actor_type: "customer",
    },
    scope: {
      resolve: jest.fn((key: any) => {
        if (key === ContainerRegistrationKeys.LOGGER) return logger
        return undefined
      }),
    },
  }
}

beforeEach(() => {
  mockVoteProductReviewHelpful.mockReset()
  mockVoteProductReviewHelpful.mockImplementation(async () => ({
    helpful_count: 1,
    already_voted: false,
  }))
  mockGetProductReviewsPgConnection.mockReset()
  mockGetProductReviewsPgConnection.mockImplementation(() => ({
    __pgConnection: true,
  }))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("POST /store/reviews/:id/helpful", () => {
  it("returns 200 with module result on first vote (idempotency contract)", async () => {
    mockVoteProductReviewHelpful.mockImplementation(async () => ({
      helpful_count: 5,
      already_voted: false,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", customerId: "cus_1" })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({ helpful_count: 5, already_voted: false })

    const arg = mockVoteProductReviewHelpful.mock.calls[0][0] as {
      reviewId: string
      customerId: string
    }
    expect(arg.reviewId).toBe("pr_1")
    expect(arg.customerId).toBe("cus_1")
  })

  it("returns 200 with already_voted:true on repeat (count NOT incremented)", async () => {
    mockVoteProductReviewHelpful.mockImplementation(async () => ({
      helpful_count: 5,
      already_voted: true,
    }))

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", customerId: "cus_1" })

    await POST(req, res)

    expect(recorder.status).toBe(200)
    expect(recorder.body).toEqual({ helpful_count: 5, already_voted: true })
  })

  it("not_found_or_not_approved → 404 not_found", async () => {
    mockVoteProductReviewHelpful.mockImplementation(async () => {
      throw new ProductReviewError(
        "not_found_or_not_approved",
        "Review not found or is not approved"
      )
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_404", customerId: "cus_1" })

    await POST(req, res)

    expect(recorder.status).toBe(404)
    expect(recorder.body).toMatchObject({ code: "not_found" })
  })

  it("missing :id → 400 review_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "", customerId: "cus_1" })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "review_id_required" })
    expect(mockVoteProductReviewHelpful).not.toHaveBeenCalled()
  })

  it("missing customer auth → 401 customer_auth_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", customerId: "" })

    await POST(req, res)

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({ code: "customer_auth_required" })
  })

  it("non-typed module error → 500 internal_error", async () => {
    mockVoteProductReviewHelpful.mockImplementation(async () => {
      throw new Error("boom")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", customerId: "cus_1" })

    await POST(req, res)

    expect(recorder.status).toBe(500)
    expect(recorder.body).toMatchObject({ code: "internal_error" })
  })
})
