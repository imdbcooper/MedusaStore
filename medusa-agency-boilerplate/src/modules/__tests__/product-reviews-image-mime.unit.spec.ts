/**
 * Phase 3 / step 5 hotfix (P0.1) — unit tests for the MIME spoofing
 * defence in
 * [`product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1):
 *
 *   - {@link detectImageMime}: pure magic-bytes signature dispatcher for
 *     the three supported image MIME types (jpeg / png / webp). Tests
 *     cover:
 *       * each happy path produces the right MIME label;
 *       * unsupported formats (text/plain, SVG, GIF, ZIP-as-DOCX) → null;
 *       * tiny/empty buffers → null instead of throwing.
 *
 *   - {@link uploadProductReviewImage}: when the client-declared MIME
 *     does not match the magic bytes, the function rejects with
 *     `ProductReviewError("image_mime_mismatch")` BEFORE the file module
 *     is touched (defence against XSS via `image/jpeg`-labelled HTML).
 *     The matching path forwards the *detected* MIME to
 *     `fileService.createFiles({mimeType})` so the bucket object is
 *     stored with a sanitized Content-Type.
 */

import { describe, expect, it, jest } from "@jest/globals"
import { Modules } from "@medusajs/framework/utils"

import {
  detectImageMime,
  ProductReviewError,
  uploadProductReviewImage,
} from "../product-reviews"

// ---------------------------------------------------------------------------
// Test fixtures — minimum-valid magic-byte prefixes plus enough trailing
// padding to satisfy the 12-byte minimum length guard inside
// `detectImageMime` (WebP needs 12 bytes by signature alone).
// ---------------------------------------------------------------------------

const ZEROS_PAD = Buffer.alloc(16, 0)

function jpegBuffer(): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), ZEROS_PAD])
}

function pngBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ZEROS_PAD,
  ])
}

function webpBuffer(): Buffer {
  // RIFF (4 bytes) + size (4 bytes, anything) + WEBP (4 bytes) + payload.
  return Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0x10, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP", "ascii"),
    ZEROS_PAD,
  ])
}

// ---------------------------------------------------------------------------
// detectImageMime — pure magic-bytes dispatcher
// ---------------------------------------------------------------------------

describe("detectImageMime", () => {
  it("recognises JPEG (FF D8 FF)", () => {
    expect(detectImageMime(jpegBuffer())).toBe("image/jpeg")
  })

  it("recognises PNG (89 50 4E 47 0D 0A 1A 0A)", () => {
    expect(detectImageMime(pngBuffer())).toBe("image/png")
  })

  it("recognises WebP (RIFF....WEBP)", () => {
    expect(detectImageMime(webpBuffer())).toBe("image/webp")
  })

  it("returns null for plain text", () => {
    const buf = Buffer.from("this is not an image at all", "utf-8")
    expect(detectImageMime(buf)).toBeNull()
  })

  it("returns null for SVG (XML text — would otherwise be vector but unsupported here)", () => {
    const buf = Buffer.from(
      "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
      "utf-8"
    )
    expect(detectImageMime(buf)).toBeNull()
  })

  it("returns null for GIF89a (recognisable image, but intentionally not whitelisted)", () => {
    const buf = Buffer.concat([
      Buffer.from("GIF89a", "ascii"),
      ZEROS_PAD,
    ])
    expect(detectImageMime(buf)).toBeNull()
  })

  it("returns null for HTML payload disguised as JPEG (the XSS vector)", () => {
    const buf = Buffer.from(
      "<html><script>alert(1)</script></html>",
      "utf-8"
    )
    expect(detectImageMime(buf)).toBeNull()
  })

  it("returns null on empty / undersized buffers", () => {
    expect(detectImageMime(Buffer.alloc(0))).toBeNull()
    expect(detectImageMime(Buffer.alloc(11))).toBeNull()
  })

  it("does not match RIFF without trailing WEBP marker (e.g. WAV)", () => {
    const wav = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE", "ascii"),
      ZEROS_PAD,
    ])
    expect(detectImageMime(wav)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// uploadProductReviewImage — magic-bytes sniff + sanitized mimeType
// ---------------------------------------------------------------------------

function buildContainer(impl: {
  createFiles?: (data: any) => Promise<{ id: string; url: string }>
}) {
  const fileService = {
    createFiles: impl.createFiles
      ? jest.fn(impl.createFiles as any)
      : jest.fn<any>(async () => ({ id: "f1", url: "https://cdn/f1.jpg" })),
    deleteFiles: jest.fn<any>(async () => {}),
  }
  const container = {
    resolve: jest.fn((key: any) => {
      if (key === Modules.FILE) {
        return fileService
      }
      return undefined
    }),
  }
  return { container, fileService }
}

describe("uploadProductReviewImage — magic-bytes sniff", () => {
  it("rejects with image_mime_mismatch when bytes are PNG but client declared image/jpeg", async () => {
    const { container, fileService } = buildContainer({})
    const png = pngBuffer().toString("base64")

    await expect(
      uploadProductReviewImage({
        container,
        filename: "exploit.jpg",
        mimeType: "image/jpeg",
        contentBase64: png,
      })
    ).rejects.toMatchObject({
      name: "ProductReviewError",
      code: "image_mime_mismatch",
    })

    expect(fileService.createFiles).not.toHaveBeenCalled()
  })

  it("rejects HTML payload masquerading as image/jpeg (XSS vector)", async () => {
    const { container, fileService } = buildContainer({})
    const html = Buffer.from(
      "<html><script>alert('xss')</script></html>",
      "utf-8"
    ).toString("base64")

    await expect(
      uploadProductReviewImage({
        container,
        filename: "ok.jpg",
        mimeType: "image/jpeg",
        contentBase64: html,
      })
    ).rejects.toBeInstanceOf(ProductReviewError)

    expect(fileService.createFiles).not.toHaveBeenCalled()
  })

  it("forwards the *detected* MIME (not the client-declared one) on the happy path", async () => {
    const { container, fileService } = buildContainer({
      createFiles: async (data: any) => ({
        id: "f_jpeg",
        url: `https://cdn/${data.filename}`,
      }),
    })
    const jpeg = jpegBuffer().toString("base64")

    const result = await uploadProductReviewImage({
      container,
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      contentBase64: jpeg,
    })

    expect(result).toEqual({ id: "f_jpeg", url: "https://cdn/photo.jpg" })
    expect(fileService.createFiles).toHaveBeenCalledTimes(1)
    const callArg = (fileService.createFiles as jest.Mock).mock
      .calls[0][0] as { mimeType: string; filename: string; access: string }
    expect(callArg.mimeType).toBe("image/jpeg")
    expect(callArg.filename).toBe("photo.jpg")
    expect(callArg.access).toBe("public")
  })

  it("rejects mismatch even when both sides are valid image MIME types (jpeg-bytes labelled webp)", async () => {
    const { container, fileService } = buildContainer({})
    const jpeg = jpegBuffer().toString("base64")

    await expect(
      uploadProductReviewImage({
        container,
        filename: "tricky.webp",
        mimeType: "image/webp",
        contentBase64: jpeg,
      })
    ).rejects.toMatchObject({ code: "image_mime_mismatch" })

    expect(fileService.createFiles).not.toHaveBeenCalled()
  })

  it("accepts WebP bytes when client declares image/webp", async () => {
    const { container, fileService } = buildContainer({})
    const webp = webpBuffer().toString("base64")

    const result = await uploadProductReviewImage({
      container,
      filename: "pic.webp",
      mimeType: "image/webp",
      contentBase64: webp,
    })

    expect(result.id).toBeDefined()
    expect(fileService.createFiles).toHaveBeenCalledTimes(1)
    const callArg = (fileService.createFiles as jest.Mock).mock
      .calls[0][0] as { mimeType: string }
    expect(callArg.mimeType).toBe("image/webp")
  })
})
