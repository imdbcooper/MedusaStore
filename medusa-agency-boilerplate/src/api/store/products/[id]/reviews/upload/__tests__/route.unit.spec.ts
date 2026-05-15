/**
 * Unit tests for the customer-facing review image upload endpoint
 * (`POST /store/products/:id/reviews/upload`).
 *
 * Mirrors the conventions of the create-route spec
 * ([`route.unit.spec.ts`](medusa-agency-boilerplate/src/api/store/products/[id]/reviews/__tests__/route.unit.spec.ts:1)):
 *  - relative `jest.mock` specifier matching the route's importer;
 *  - deferred `require("../route")` inside `beforeAll`;
 *  - tiny inline req/res builders.
 *
 * Coverage:
 *   - strict Zod schema (mime / extension / base64 alphabet / max byte cap);
 *   - 413 path when payload decodes above 5 MiB;
 *   - 401 path when the customer is not authenticated;
 *   - happy path: upload helper called, 201 echoes `{id,url}`;
 *   - 500 path when the file module throws.
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

const mockUpload = jest.fn<any>(async () => ({
  id: "file_123",
  url: "https://cdn.example/file_123.jpg",
}))

jest.mock("../../../../../../../modules/product-reviews", () => {
  const actual = jest.requireActual(
    "../../../../../../../modules/product-reviews"
  ) as typeof import("../../../../../../../modules/product-reviews")
  return {
    __esModule: true,
    ...actual,
    uploadProductReviewImage: (...args: any[]) => mockUpload(...args),
  }
})

let POST: typeof import("../route")["POST"]
let StoreUploadProductReviewImageSchema: typeof import("../route")["StoreUploadProductReviewImageSchema"]

beforeAll(() => {
  const mod = require("../route") as typeof import("../route")
  POST = mod.POST
  StoreUploadProductReviewImageSchema = mod.StoreUploadProductReviewImageSchema
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

function buildLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
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
}): any {
  return {
    params: { id: input.productId },
    validatedBody: input.validatedBody,
    auth_context: {
      actor_id: input.customerId === undefined ? "cus_1" : input.customerId,
      actor_type: "customer",
    },
    scope: buildScope(),
  }
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZitbpsAAAAASUVORK5CYII="

beforeEach(() => {
  mockUpload.mockReset()
  mockUpload.mockImplementation(async () => ({
    id: "file_123",
    url: "https://cdn.example/file_123.jpg",
  }))
})

describe("StoreUploadProductReviewImageSchema (strict)", () => {
  it("accepts a valid base64 image payload", () => {
    const parse = StoreUploadProductReviewImageSchema.safeParse({
      filename: "photo.jpg",
      mime_type: "image/jpeg",
      content_base64: TINY_PNG_BASE64,
    })
    expect(parse.success).toBe(true)
  })

  it("rejects unknown keys (.strict)", () => {
    const parse = StoreUploadProductReviewImageSchema.safeParse({
      filename: "photo.jpg",
      mime_type: "image/jpeg",
      content_base64: TINY_PNG_BASE64,
      extra: 1,
    })
    expect(parse.success).toBe(false)
  })

  it("rejects disallowed mime types", () => {
    const parse = StoreUploadProductReviewImageSchema.safeParse({
      filename: "doc.pdf",
      mime_type: "application/pdf",
      content_base64: TINY_PNG_BASE64,
    })
    expect(parse.success).toBe(false)
  })

  it("rejects disallowed extensions", () => {
    const parse = StoreUploadProductReviewImageSchema.safeParse({
      filename: "doc.exe",
      mime_type: "image/jpeg",
      content_base64: TINY_PNG_BASE64,
    })
    expect(parse.success).toBe(false)
  })

  it("rejects path separators in filename", () => {
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        filename: "../etc/passwd.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        filename: "a\\b.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
  })

  it("rejects non-base64 content", () => {
    const parse = StoreUploadProductReviewImageSchema.safeParse({
      filename: "photo.jpg",
      mime_type: "image/jpeg",
      content_base64: "not base64!!!",
    })
    expect(parse.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Phase 3 / step 5 hotfix (P1.1) — filename sanitization
  // -------------------------------------------------------------------------

  it("rejects filenames containing NUL byte (\\x00)", () => {
    const parse = StoreUploadProductReviewImageSchema.safeParse({
      filename: "ok\x00evil.jpg",
      mime_type: "image/jpeg",
      content_base64: TINY_PNG_BASE64,
    })
    expect(parse.success).toBe(false)
  })

  it("rejects filenames with control characters (e.g. CR/LF)", () => {
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        filename: "ok\nevil.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        filename: "ok\revil.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        filename: "ok\tevil.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
  })

  it("rejects unicode hijack characters (RTL override / zero-width)", () => {
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        // U+202E RIGHT-TO-LEFT OVERRIDE — classic filename hijack.
        filename: "photo\u202Egpj.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        // U+200B ZERO WIDTH SPACE.
        filename: "photo\u200B.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
  })

  it("rejects very long filenames (>200 chars)", () => {
    const longName = "a".repeat(250) + ".jpg"
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        filename: longName,
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(false)
  })

  it("accepts safe ASCII filenames with dot/dash/underscore/space", () => {
    expect(
      StoreUploadProductReviewImageSchema.safeParse({
        filename: "my_photo-01 v2.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      }).success
    ).toBe(true)
  })
})

describe("POST /store/products/:id/reviews/upload", () => {
  it("happy path: returns 201 with {id,url} and calls upload helper", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: {
        filename: "photo.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(201)
    expect(recorder.body).toEqual({
      id: "file_123",
      url: "https://cdn.example/file_123.jpg",
    })
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0][0]).toMatchObject({
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      contentBase64: TINY_PNG_BASE64,
    })
  })

  it("401 when customer is not authenticated", async () => {
    const { res, recorder } = buildResponse()
    const req: any = {
      params: { id: "prod_1" },
      validatedBody: {
        filename: "photo.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      },
      auth_context: { actor_id: undefined, actor_type: "customer" },
      scope: buildScope(),
    }

    await POST(req, res)

    expect(recorder.status).toBe(401)
    expect(recorder.body).toMatchObject({ code: "customer_auth_required" })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("400 when product id is missing", async () => {
    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "",
      customerId: "cus_1",
      validatedBody: {
        filename: "photo.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "product_id_required" })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("413 when decoded content exceeds the 5 MiB cap", async () => {
    // Build a base64 string that decodes to ~6 MiB worth of bytes. We
    // do NOT actually allocate the whole buffer — schema and handler
    // operate on length only.
    const oneMiBBase64 = "A".repeat(Math.ceil((1024 * 1024 * 4) / 3))
    const sixMiBBase64 = oneMiBBase64.repeat(6)

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: {
        filename: "huge.jpg",
        mime_type: "image/jpeg",
        content_base64: sixMiBBase64,
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(413)
    expect(recorder.body).toMatchObject({ code: "payload_too_large" })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it("500 when the file module throws", async () => {
    mockUpload.mockImplementation(async () => {
      throw new Error("S3 unreachable")
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: {
        filename: "photo.jpg",
        mime_type: "image/jpeg",
        content_base64: TINY_PNG_BASE64,
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(500)
    expect(recorder.body).toMatchObject({ code: "internal_error" })
  })

  // -------------------------------------------------------------------------
  // Phase 3 / step 5 hotfix (P0.1) — magic-bytes mismatch path
  // -------------------------------------------------------------------------

  it("400 image_mime_mismatch when uploadProductReviewImage throws ProductReviewError('image_mime_mismatch')", async () => {
    const { ProductReviewError } = jest.requireActual(
      "../../../../../../../modules/product-reviews"
    ) as typeof import("../../../../../../../modules/product-reviews")

    mockUpload.mockImplementation(async () => {
      throw new ProductReviewError(
        "image_mime_mismatch",
        "Image content does not match the declared mime_type"
      )
    })

    const { res, recorder } = buildResponse()
    const req = buildReq({
      productId: "prod_1",
      customerId: "cus_1",
      validatedBody: {
        filename: "exploit.jpg",
        mime_type: "image/jpeg",
        // Note: schema does not validate magic bytes — that's a module
        // concern (the route delegates the actual decode/sniff to the
        // module which is mocked here). We just want to confirm the
        // error mapping is correct.
        content_base64: TINY_PNG_BASE64,
      },
    })

    await POST(req, res)

    expect(recorder.status).toBe(400)
    expect(recorder.body).toMatchObject({ code: "image_mime_mismatch" })
  })
})
