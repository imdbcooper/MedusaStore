import { HttpTypes } from "@medusajs/types"

import type {
  ProductReviewItem,
  ProductReviewSummary,
} from "@lib/data/product-reviews"

/**
 * Phase 3 / step 1 — pure builder for the Schema.org `Product` JSON-LD object
 * rendered on the product page (plan §9 Phase 3 item 4).
 *
 * The function is intentionally side-effect-free and does NOT use any Next.js
 * APIs — it operates on plain data so it can be unit-tested without mocking
 * `next/cache`, `cookies()` or `sdk.client.fetch`. Tests can pass arbitrary
 * `summary` / `reviews` shapes and assert the resulting JSON-LD shape.
 *
 * Schema reference: [Product](https://schema.org/Product),
 * [AggregateRating](https://schema.org/AggregateRating),
 * [Review](https://schema.org/Review).
 *
 * Empty-state contract (plan §6.2 + Google rich-snippet rules):
 *   - `aggregateRating` is omitted entirely when there are zero approved
 *     reviews OR when `summary.average_rating === null`. Google penalises
 *     empty `AggregateRating` blocks (`reviewCount: 0`).
 *   - `review[]` is omitted when there are zero approved reviews. We do NOT
 *     emit an empty array.
 *   - Every other field is best-effort: missing description/image/handle is
 *     simply skipped.
 *
 * Plain-text-only contract (plan §10.2): every string copied into the JSON-LD
 * comes from columns that the backend stores as plain text (`text`, `title`,
 * `customer_name`). HTML or markdown is forbidden upstream. The downstream
 * {@link safeJsonStringify} additionally escapes `<`, `>`, `&` and the U+2028
 * / U+2029 separators so the resulting string is safe to inline inside
 * `<script type="application/ld+json">`.
 */

export type ProductJsonLdAggregateRating = {
  "@type": "AggregateRating"
  ratingValue: string
  bestRating: "5"
  worstRating: "1"
  reviewCount: number
}

export type ProductJsonLdReview = {
  "@type": "Review"
  author: { "@type": "Person"; name: string }
  datePublished: string
  reviewBody: string
  name?: string
  reviewRating: {
    "@type": "Rating"
    ratingValue: string
    bestRating: "5"
    worstRating: "1"
  }
}

export type ProductJsonLd = {
  "@context": "https://schema.org"
  "@type": "Product"
  name: string
  description?: string
  image?: string[]
  sku?: string
  url?: string
  aggregateRating?: ProductJsonLdAggregateRating
  review?: ProductJsonLdReview[]
}

export type BuildProductJsonLdInput = {
  product: HttpTypes.StoreProduct
  summary: ProductReviewSummary | null
  reviews: ProductReviewItem[]
  /**
   * Absolute origin (e.g. `https://example.com`) used to build the canonical
   * `url` field. Pass an empty string to omit the field — the schema is still
   * valid without it.
   */
  siteUrl: string
  countryCode: string
  /**
   * How many approved reviews to inline. Defaults to 10 — enough to satisfy
   * Google's «sample» policy without bloating the HTML payload. The caller
   * should still cap upstream via `pageSize`, this is a safety net.
   */
  maxReviews?: number
}

const DEFAULT_MAX_REVIEWS = 10

const trimOrUndefined = (value: string | null | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const collectImages = (
  product: HttpTypes.StoreProduct
): string[] | undefined => {
  const fromGallery = (product.images ?? [])
    .map((image) => trimOrUndefined(image?.url))
    .filter((url): url is string => Boolean(url))

  if (fromGallery.length > 0) {
    return fromGallery
  }

  const thumbnail = trimOrUndefined(product.thumbnail)
  return thumbnail ? [thumbnail] : undefined
}

/**
 * Picks the most appropriate SKU-like identifier:
 *   1. `product.metadata.sku` (admins sometimes set it explicitly).
 *   2. The first variant's `sku` (Medusa convention).
 *   3. `product.handle` (always present for indexed products — keeps the
 *      field non-empty for crawlers).
 */
const pickSku = (product: HttpTypes.StoreProduct): string | undefined => {
  const metadataSku = trimOrUndefined(
    typeof product.metadata?.sku === "string" ? product.metadata.sku : undefined
  )
  if (metadataSku) {
    return metadataSku
  }

  const variantSku = trimOrUndefined(
    product.variants?.find((variant) => trimOrUndefined(variant?.sku))?.sku ??
      undefined
  )
  if (variantSku) {
    return variantSku
  }

  return trimOrUndefined(product.handle)
}

const buildCanonicalUrl = (
  siteUrl: string,
  countryCode: string,
  handle: string | null | undefined
): string | undefined => {
  const trimmedHandle = trimOrUndefined(handle)
  const trimmedCountry = trimOrUndefined(countryCode)
  if (!trimmedHandle || !trimmedCountry) {
    return undefined
  }
  const origin = trimOrUndefined(siteUrl)?.replace(/\/+$/, "")
  if (!origin) {
    return undefined
  }
  return `${origin}/${trimmedCountry}/products/${trimmedHandle}`
}

const buildAggregateRating = (
  summary: ProductReviewSummary | null
): ProductJsonLdAggregateRating | undefined => {
  if (!summary) {
    return undefined
  }
  if (summary.total_reviews <= 0) {
    return undefined
  }
  if (
    summary.average_rating === null ||
    typeof summary.average_rating !== "number" ||
    Number.isNaN(summary.average_rating)
  ) {
    return undefined
  }

  return {
    "@type": "AggregateRating",
    ratingValue: summary.average_rating.toFixed(1),
    bestRating: "5",
    worstRating: "1",
    reviewCount: summary.total_reviews,
  }
}

const buildReviewEntry = (
  review: ProductReviewItem
): ProductJsonLdReview | null => {
  const author = trimOrUndefined(review.customer_name)
  const reviewBody = trimOrUndefined(review.text)
  const datePublished = trimOrUndefined(review.created_at)?.split("T")[0]
  const ratingNumber = Number(review.rating)

  if (!author || !reviewBody || !datePublished) {
    return null
  }
  if (
    !Number.isFinite(ratingNumber) ||
    ratingNumber < 1 ||
    ratingNumber > 5
  ) {
    return null
  }

  const title = trimOrUndefined(review.title)

  return {
    "@type": "Review",
    author: { "@type": "Person", name: author },
    datePublished,
    reviewBody,
    ...(title ? { name: title } : {}),
    reviewRating: {
      "@type": "Rating",
      ratingValue: String(ratingNumber),
      bestRating: "5",
      worstRating: "1",
    },
  }
}

const buildReviews = (
  reviews: ProductReviewItem[],
  maxReviews: number
): ProductJsonLdReview[] | undefined => {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return undefined
  }
  const cap = Number.isFinite(maxReviews) && maxReviews > 0 ? maxReviews : DEFAULT_MAX_REVIEWS
  const entries: ProductJsonLdReview[] = []
  for (const review of reviews) {
    if (entries.length >= cap) {
      break
    }
    const entry = buildReviewEntry(review)
    if (entry) {
      entries.push(entry)
    }
  }
  return entries.length > 0 ? entries : undefined
}

/**
 * Build the JSON-LD object for the product page. Returns `null` only when the
 * product is so malformed that even the `name` field is missing — the caller
 * should then skip rendering the `<script>` tag entirely. Every other input
 * shape (no reviews, no images, no description) yields a valid Schema.org
 * `Product` object.
 */
export function buildProductJsonLd(
  input: BuildProductJsonLdInput
): ProductJsonLd | null {
  const name = trimOrUndefined(input.product?.title)
  if (!name) {
    return null
  }

  const description =
    trimOrUndefined(input.product.description) ??
    trimOrUndefined(input.product.subtitle)

  const image = collectImages(input.product)
  const sku = pickSku(input.product)
  const url = buildCanonicalUrl(
    input.siteUrl,
    input.countryCode,
    input.product.handle
  )
  const aggregateRating = buildAggregateRating(input.summary)
  const review = buildReviews(input.reviews, input.maxReviews ?? DEFAULT_MAX_REVIEWS)

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(sku ? { sku } : {}),
    ...(url ? { url } : {}),
    ...(aggregateRating ? { aggregateRating } : {}),
    ...(review ? { review } : {}),
  }
}

/**
 * Serialise a JSON-LD value for inclusion inside `<script type="application/ld+json">`.
 *
 * `JSON.stringify` already escapes the JSON-meaningful characters, but the
 * resulting string still contains `<`, `>`, `&` and the U+2028 / U+2029 line
 * separators — all of which can break out of the `<script>` element or
 * confuse the HTML parser. We escape them as `\u00xx`, which keeps the JSON
 * lexically identical (`JSON.parse` round-trips it) but makes it safe to
 * inline. This is the standard pattern used by the React, Next.js and Remix
 * docs for inline-script payloads.
 */
export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
