/**
 * Unit tests for the public-shape whitelisters in
 * [`product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1).
 *
 * Hotfix Phase 3 P0: `toPublicReview` and `toMineReview` are the single
 * choke point that prevents internal ids (`customer_id`, `order_id`) and
 * moderation metadata (`status`, `moderated_by`, `moderated_at`,
 * `rejection_reason`) from leaking through public Store API endpoints.
 *
 * These tests pin the contract so a future column added to
 * `ProductReviewRow` cannot accidentally widen the public surface.
 */

import { describe, expect, it } from "@jest/globals"
import {
  toMineReview,
  toPublicReview,
  type ProductReviewRow,
} from "../product-reviews"

const FORBIDDEN_PUBLIC_KEYS = [
  "customer_id",
  "order_id",
  "status",
  "moderated_by",
  "moderated_at",
  "rejection_reason",
] as const

const ALLOWED_PUBLIC_KEYS = [
  "id",
  "product_id",
  "customer_name",
  "rating",
  "title",
  "text",
  "pros",
  "cons",
  "verified_purchase",
  "helpful_count",
  "images",
  "created_at",
  "updated_at",
] as const

const ALLOWED_MINE_KEYS = [
  ...ALLOWED_PUBLIC_KEYS,
  "status",
  "rejection_reason",
] as const

const FORBIDDEN_MINE_KEYS = [
  "customer_id",
  "order_id",
  "moderated_by",
  "moderated_at",
] as const

function buildRow(overrides: Partial<ProductReviewRow> = {}): ProductReviewRow {
  return {
    id: "pr_1",
    product_id: "prod_1",
    customer_id: "cus_42",
    order_id: "ord_99",
    rating: 5,
    title: "Отличный товар",
    text: "Очень доволен покупкой.",
    pros: "Качество",
    cons: "Цена",
    status: "approved",
    moderated_by: "admin_1",
    moderated_at: "2026-01-01T00:00:00.000Z",
    rejection_reason: null,
    verified_purchase: true,
    helpful_count: 7,
    images: null,
    customer_name: "Иван И.",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  }
}

describe("toPublicReview", () => {
  it("returns only the whitelisted public keys (no extras)", () => {
    const row = buildRow()
    const out = toPublicReview(row)

    const keys = Object.keys(out).sort()
    expect(keys).toEqual([...ALLOWED_PUBLIC_KEYS].sort())
  })

  it("strips customer_id / order_id / moderation metadata", () => {
    const row = buildRow({
      status: "rejected",
      moderated_by: "admin_1",
      moderated_at: "2026-01-01T00:00:00.000Z",
      rejection_reason: "ненормативная лексика",
    })
    const out = toPublicReview(row) as Record<string, unknown>

    for (const forbidden of FORBIDDEN_PUBLIC_KEYS) {
      expect(out).not.toHaveProperty(forbidden)
    }
  })

  it("forwards content fields verbatim", () => {
    const row = buildRow({
      title: "Заголовок",
      text: "Текст",
      pros: "Плюсы",
      cons: "Минусы",
      customer_name: "Анна А.",
      rating: 4,
      helpful_count: 12,
      verified_purchase: true,
    })
    const out = toPublicReview(row)

    expect(out.id).toBe("pr_1")
    expect(out.product_id).toBe("prod_1")
    expect(out.customer_name).toBe("Анна А.")
    expect(out.rating).toBe(4)
    expect(out.title).toBe("Заголовок")
    expect(out.text).toBe("Текст")
    expect(out.pros).toBe("Плюсы")
    expect(out.cons).toBe("Минусы")
    expect(out.verified_purchase).toBe(true)
    expect(out.helpful_count).toBe(12)
    expect(out.created_at).toBe("2026-01-01T00:00:00.000Z")
    expect(out.updated_at).toBe("2026-01-02T00:00:00.000Z")
  })

  it("normalises images: array of strings → kept; non-array → null", () => {
    expect(toPublicReview(buildRow({ images: null })).images).toBeNull()
    expect(toPublicReview(buildRow({ images: undefined as never })).images).toBeNull()
    expect(toPublicReview(buildRow({ images: "not-an-array" as never })).images).toBeNull()
    expect(
      toPublicReview(
        buildRow({ images: ["https://cdn/a.jpg", "https://cdn/b.jpg"] })
      ).images
    ).toEqual(["https://cdn/a.jpg", "https://cdn/b.jpg"])
    // Empty array → null (treated as «no images»).
    expect(toPublicReview(buildRow({ images: [] })).images).toBeNull()
    // Non-string entries are filtered; if nothing remains → null.
    expect(
      toPublicReview(buildRow({ images: [123, false] as never })).images
    ).toBeNull()
  })

  it("preserves nullable content fields", () => {
    const out = toPublicReview(
      buildRow({ title: null, pros: null, cons: null })
    )
    expect(out.title).toBeNull()
    expect(out.pros).toBeNull()
    expect(out.cons).toBeNull()
  })
})

describe("toMineReview", () => {
  it("returns only the whitelisted mine keys (public + status + rejection_reason)", () => {
    const out = toMineReview(buildRow())
    const keys = Object.keys(out).sort()
    expect(keys).toEqual([...ALLOWED_MINE_KEYS].sort())
  })

  it("keeps status + rejection_reason but strips customer_id / order_id / moderated_*", () => {
    const out = toMineReview(
      buildRow({
        status: "rejected",
        rejection_reason: "повтор",
        moderated_by: "admin_1",
        moderated_at: "2026-01-01T00:00:00.000Z",
      })
    ) as Record<string, unknown>

    expect(out).toHaveProperty("status", "rejected")
    expect(out).toHaveProperty("rejection_reason", "повтор")
    for (const forbidden of FORBIDDEN_MINE_KEYS) {
      expect(out).not.toHaveProperty(forbidden)
    }
  })

  it("forwards every status value verbatim", () => {
    expect(toMineReview(buildRow({ status: "pending" })).status).toBe("pending")
    expect(toMineReview(buildRow({ status: "approved" })).status).toBe(
      "approved"
    )
    expect(toMineReview(buildRow({ status: "rejected" })).status).toBe(
      "rejected"
    )
  })
})
