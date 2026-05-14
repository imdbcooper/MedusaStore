/**
 * Unit tests for `DELETE /store/customers/me/reviews/:id`.
 *
 * Plan §4.3 / §6.5: customer can delete only `pending` / `rejected` rows;
 * deleting an `approved` review returns 409. Module returns typed errors
 * (`not_found` / `not_owner` / `cannot_delete_published`).
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

const mockDeleteOwnPendingProductReview = jest.fn<any>(async () => ({}))

jest.mock("../../../../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../../../../modules/product-reviews"
  ) as typeof import("../../../../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    deleteOwnPendingProductReview: (...args: any[]) =>
      mockDeleteOwnPendingProductReview(...args),
  }
})

const { ProductReviewError } = jest.requireActual(
  "../../../../../../../modules/product-reviews"
) as typeof import("../../../../../../../modules/product-reviews")

let DELETE: typeof import("../route")["DELETE"]

beforeAll(() => {
  DELETE = (require("../route") as typeof import("../route")).DELETE
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

function buildReq(input: {
  reviewId?: string
  customerId?: string | null
}): any {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return {
    params: { id: input.reviewId },
    auth_context: {
      actor_id: input.customerId ?? "cus_1",
      actor_type: "customer",
    },
    scope: {
      resolve: jest.fn((key: any) =>
        key === ContainerRegistrationKeys.LOGGER ? logger : undefined
      ),
    },
  }
}

beforeEach(() => {
  mockDeleteOwnPendingProductReview.mockReset()
  mockDeleteOwnPendingProductReview.mockImplementation(async () => ({}))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("DELETE /store/customers/me/reviews/:id", () => {
  it("success → 204 No Content", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", customerId: "cus_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(204)
    expect(recorder.ended).toBe(true)
    expect(recorder.body).toBeUndefined()

    const arg = mockDeleteOwnPendingProductReview.mock.calls[0][0] as {
      reviewId: string
      customerId: string
    }
    expect(arg.reviewId).toBe("pr_1")
    expect(arg.customerId).toBe("cus_1")
  })

  it("not_found → 404 not_found", async () => {
    mockDeleteOwnPendingProductReview.mockImplementation(async () => {
      throw new ProductReviewError("not_found")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_404", customerId: "cus_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(404)
    expect(recorder.body).toMatchObject({ code: "not_found" })
  })

  it("not_owner → 404 not_found (does NOT leak existence)", async () => {
    mockDeleteOwnPendingProductReview.mockImplementation(async () => {
      throw new ProductReviewError("not_owner")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_other", customerId: "cus_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(404)
    expect(recorder.body).toMatchObject({ code: "not_found" })
  })

  it("cannot_delete_published → 409", async () => {
    mockDeleteOwnPendingProductReview.mockImplementation(async () => {
      throw new ProductReviewError("cannot_delete_published")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_pub", customerId: "cus_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(409)
    expect(recorder.body).toMatchObject({ code: "cannot_delete_published" })
  })

  it("missing :id → 400 review_id_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "", customerId: "cus_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "review_id_required" })
    expect(mockDeleteOwnPendingProductReview).not.toHaveBeenCalled()
  })

  it("missing customer auth → 401 customer_auth_required", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", customerId: "" })

    await DELETE(req, res)

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({ code: "customer_auth_required" })
  })

  it("non-typed error → 500 internal_error", async () => {
    mockDeleteOwnPendingProductReview.mockImplementation(async () => {
      throw new Error("boom")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({ reviewId: "pr_1", customerId: "cus_1" })

    await DELETE(req, res)

    expect(recorder.status).toBe(500)
    expect(recorder.body).toMatchObject({ code: "internal_error" })
  })
})
