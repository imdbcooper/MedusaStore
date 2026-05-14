/**
 * Unit tests for pure utilities in
 * [`product-reviews.ts`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1):
 *   - [`resolveCustomerNameSnapshot`](medusa-agency-boilerplate/src/modules/product-reviews.ts:460)
 *     fallback chain (plan §3.2): `first_name + initial(last_name)` →
 *     `first_name` → email-local → `'Покупатель'`.
 *   - [`normalizeReviewText`](medusa-agency-boilerplate/src/modules/product-reviews.ts:501)
 *     trim + whitespace collapse, empty → `null`.
 *
 * No container, no Postgres — these are pure-function tests, kept inside
 * `src/modules/__tests__/` per the existing project convention.
 */

import { describe, expect, it } from "@jest/globals"
import {
  ANONYMIZED_CUSTOMER_NAME,
  normalizeReviewText,
  resolveCustomerNameSnapshot,
} from "../product-reviews"

describe("resolveCustomerNameSnapshot", () => {
  it("'Иван' + 'Иванов' → 'Иван И.'", () => {
    expect(
      resolveCustomerNameSnapshot({
        first_name: "Иван",
        last_name: "Иванов",
        email: "any@example.com",
      })
    ).toBe("Иван И.")
  })

  it("first_name only (last_name empty) → first_name", () => {
    expect(
      resolveCustomerNameSnapshot({
        first_name: "Иван",
        last_name: "",
        email: "ivan@example.com",
      })
    ).toBe("Иван")
  })

  it("no first_name but email present → email local-part", () => {
    expect(
      resolveCustomerNameSnapshot({
        first_name: "",
        last_name: "",
        email: "foo@bar.com",
      })
    ).toBe("foo")
  })

  it("everything empty → 'Покупатель'", () => {
    expect(
      resolveCustomerNameSnapshot({
        first_name: "",
        last_name: "",
        email: "",
      })
    ).toBe(ANONYMIZED_CUSTOMER_NAME)
  })

  it("null / undefined → 'Покупатель'", () => {
    expect(resolveCustomerNameSnapshot(null)).toBe(ANONYMIZED_CUSTOMER_NAME)
    expect(resolveCustomerNameSnapshot(undefined)).toBe(
      ANONYMIZED_CUSTOMER_NAME
    )
  })

  it("trims first/last name before deciding the branch", () => {
    expect(
      resolveCustomerNameSnapshot({
        first_name: "  Иван  ",
        last_name: "  Иванов  ",
      })
    ).toBe("Иван И.")
  })
})

describe("normalizeReviewText", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeReviewText("  hello  ")).toBe("hello")
  })

  it("collapses internal whitespace runs", () => {
    expect(normalizeReviewText("hello\t\nworld   here")).toBe(
      "hello world here"
    )
  })

  it("empty / whitespace-only → null", () => {
    expect(normalizeReviewText("")).toBeNull()
    expect(normalizeReviewText("   ")).toBeNull()
    expect(normalizeReviewText("\n\t  \n")).toBeNull()
  })

  it("non-string input → null", () => {
    expect(normalizeReviewText(null)).toBeNull()
    expect(normalizeReviewText(undefined)).toBeNull()
    expect(normalizeReviewText(123)).toBeNull()
    expect(normalizeReviewText({})).toBeNull()
  })
})
