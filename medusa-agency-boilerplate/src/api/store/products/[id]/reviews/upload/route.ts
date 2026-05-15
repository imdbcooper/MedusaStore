import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { uploadProductReviewImage } from "../../../../../../modules/product-reviews"

/**
 * Phase 3 / step 5 — `POST /store/products/:id/reviews/upload`.
 *
 * Single-image upload endpoint for the customer review form. The
 * customer accumulates the returned `{id, url}` pairs on the client and
 * passes them as `images` when finally submitting the review through
 * `POST /store/products/:id/reviews` (which itself stores them in
 * `product_review.images`).
 *
 * Wire format (JSON, not multipart):
 *   POST /store/products/:id/reviews/upload
 *   {
 *     "filename":      "photo.jpg",
 *     "mime_type":     "image/jpeg",
 *     "content_base64": "<base64-encoded bytes>"
 *   }
 *
 * Response:
 *   201 { "id": "<file-id>", "url": "https://cdn/.../photo.jpg" }
 *
 * Why JSON+base64 instead of multipart? The Medusa file module's
 * `createFiles({content})` already accepts a base64 string — adding a
 * multer parser to a single-image endpoint is more moving parts for
 * almost no payload-size win. base64 inflates by ~33%, but the upper
 * bound is `MAX_BYTES`, so even worst-case the request is small. The
 * approach mirrors how Medusa's own admin file routes are wired
 * internally (the module DTO is the same `CreateFileDTO`).
 *
 * Auth: customer-only via the matcher in
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1).
 *
 * Rate limit: per-IP cap is enforced by the same `publicRateLimit`
 * middleware that protects review creation (the matcher reuses the
 * `product-reviews-create-*` buckets so that a bot cannot trivially
 * sidestep create limits by spamming the upload endpoint).
 *
 * Constraints (mirrored on the storefront for UX):
 *   - max bytes: 5 MiB (`MAX_BYTES`);
 *   - allowed mime types: jpeg / png / webp;
 *   - filename: 1..255 chars after trim, no path separators (defense
 *     in depth — the file module rejects them too).
 */

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
])
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i

export const StoreUploadProductReviewImageSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((value) => !value.includes("/") && !value.includes("\\"), {
        message: "filename must not contain path separators",
      })
      .refine((value) => ALLOWED_EXTENSIONS.test(value), {
        message: "filename extension is not allowed",
      }),
    mime_type: z
      .string()
      .trim()
      .min(1)
      .refine((value) => ALLOWED_MIME_TYPES.has(value), {
        message: "mime_type is not allowed",
      }),
    /**
     * Strict-mode JSON; we receive base64 directly from the client.
     * Backend rejects anything other than `^[A-Za-z0-9+/=]+$` to make
     * sure only standard base64 alphabet is used.
     */
    content_base64: z
      .string()
      .min(4)
      .max(Math.ceil((MAX_BYTES * 4) / 3) + 16)
      .regex(/^[A-Za-z0-9+/=\r\n]+$/, "must be base64-encoded"),
  })
  .strict()

export type StoreUploadProductReviewImageBody = z.infer<
  typeof StoreUploadProductReviewImageSchema
>

function decodedBase64Length(input: string): number {
  // Strip whitespace then compute decoded length without allocating a
  // Buffer for the entire payload.
  const stripped = input.replace(/[\r\n]+/g, "")
  let length = (stripped.length / 4) * 3
  if (stripped.endsWith("==")) {
    length -= 2
  } else if (stripped.endsWith("=")) {
    length -= 1
  }
  return Math.floor(length)
}

export async function POST(
  req: AuthenticatedMedusaRequest<StoreUploadProductReviewImageBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const productId =
    typeof (req.params as Record<string, unknown> | undefined)?.id === "string"
      ? ((req.params as Record<string, string>).id || "").trim()
      : ""
  if (!productId) {
    res.status(400).json({
      code: "product_id_required",
      message: "product id is required",
    })
    return
  }

  const customerId = req.auth_context?.actor_id?.trim()
  if (!customerId) {
    res.status(401).json({
      code: "customer_auth_required",
      message: "Authentication required",
    })
    return
  }

  const body = (req.validatedBody || {}) as StoreUploadProductReviewImageBody

  // Reject oversize payloads without ever decoding them. The Zod
  // schema's max-length already caps the base64 string, but doing the
  // exact byte calculation gives us a precise 413 instead of a generic
  // 400 from Zod (better UX in the form).
  const decodedSize = decodedBase64Length(body.content_base64)
  if (decodedSize > MAX_BYTES) {
    res.status(413).json({
      code: "payload_too_large",
      message: `Image exceeds ${MAX_BYTES} bytes`,
    })
    return
  }

  try {
    const uploaded = await uploadProductReviewImage({
      container: req.scope,
      filename: body.filename,
      mimeType: body.mime_type,
      contentBase64: body.content_base64,
    })

    res.status(201).json({
      id: uploaded.id,
      url: uploaded.url,
    })
    return
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_upload_error"
    logger.error(
      `[product-reviews] upload failed customer_id=${customerId} product_id=${productId} error=${message}`
    )
    res.status(500).json({
      code: "internal_error",
      message: "Failed to upload review image",
    })
  }
}
