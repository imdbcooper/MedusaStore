import { randomUUID } from "crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Product reviews module — pure SQL access layer over Medusa's pg connection,
 * mirrors the style of [`marketing-layer.ts`](medusa-agency-boilerplate/src/modules/marketing-layer.ts:1):
 * - soft FKs by text-id (no `defineLink`, no MikroORM entities, no Medusa Service
 *   classes);
 * - lazy schema bootstrap via `ensureProductReviewsTables(pgConnection)` that is
 *   called at the top of every public function;
 * - all SQL is parameterized through `pgConnection.raw(sql, bindings)`;
 * - rating summary is rebuilt through a single atomic
 *   `INSERT ... ON CONFLICT DO UPDATE` query — never read-modify-write;
 * - `helpful_count` is updated only by atomic `UPDATE ... SET col = col + 1`.
 *
 * API routes are responsible for rate limiting, Zod validation, HTTP status
 * mapping and `revalidateTag`. This module knows nothing about HTTP.
 */

// ---------------------------------------------------------------------------
// Container / pg connection types
// ---------------------------------------------------------------------------

type RawSqlRowsResult<T> = {
  rows?: T[]
  rowCount?: number
}

type PgTransactionLike = {
  raw: <T = unknown>(
    sql: string,
    bindings?: unknown[]
  ) => Promise<RawSqlRowsResult<T>>
}

type PgConnectionLike = {
  transaction: <T>(
    callback: (trx: PgTransactionLike) => Promise<T>
  ) => Promise<T>
  raw: <T = unknown>(
    sql: string,
    bindings?: unknown[]
  ) => Promise<RawSqlRowsResult<T>>
}

type QueryGraphInput = {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
  pagination?: {
    take: number
    skip: number
  }
}

type QueryGraphResult<T> = {
  data: T[]
  metadata?: {
    count?: number
    take?: number
    skip?: number
  }
}

type QueryGraphLike = {
  graph: <T>(input: QueryGraphInput) => Promise<QueryGraphResult<T>>
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const PRODUCT_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const
export type ProductReviewStatus = (typeof PRODUCT_REVIEW_STATUSES)[number]

export const PRODUCT_REVIEW_LIST_SORTS = [
  "newest",
  "helpful",
  "rating",
] as const
export type ProductReviewListSort = (typeof PRODUCT_REVIEW_LIST_SORTS)[number]

export const ANONYMIZED_CUSTOMER_NAME = "Покупатель"

export type ProductReviewRow = {
  id: string
  product_id: string
  customer_id: string | null
  order_id: string | null
  rating: number
  title: string | null
  text: string
  pros: string | null
  cons: string | null
  status: ProductReviewStatus
  moderated_by: string | null
  moderated_at: string | null
  rejection_reason: string | null
  verified_purchase: boolean
  helpful_count: number
  images: unknown
  customer_name: string
  /**
   * Phase 3 / step 4 — admin reply («Ответ магазина»). Three nullable
   * columns are added to `product_review` via an idempotent
   * `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in
   * {@link ensureProductReviewsTables}. The shape is intentionally
   * column-level (not a separate table) because there is at most one
   * reply per review and we never need history (plan §9 Phase 3 п.3).
   *
   * - `merchant_reply_text` — plain text, 1..1000 chars after trim;
   *   `null` when no reply has been written yet.
   * - `merchant_reply_by`   — admin actor id of the moderator who saved
   *   the reply. Internal-only — NEVER surfaces in the public
   *   `ProductReviewPublic` shape (see {@link toPublicReview}).
   * - `merchant_reply_at`   — ISO timestamp of the last reply
   *   create/update; cleared together with `*_text` / `*_by` on
   *   {@link clearProductReviewMerchantReply}.
   */
  merchant_reply_text: string | null
  merchant_reply_by: string | null
  merchant_reply_at: string | null
  created_at: string
  updated_at: string
}

export type ProductRatingSummaryRow = {
  product_id: string
  average_rating: number | null
  total_reviews: number
  rating_1: number
  rating_2: number
  rating_3: number
  rating_4: number
  rating_5: number
  updated_at: string | null
}

export type ProductReviewListItem = ProductReviewRow

export type ProductReviewListResult = {
  items: ProductReviewListItem[]
  total: number
  page: number
  pageSize: number
}

// ---------------------------------------------------------------------------
// Public-facing whitelisted shapes (hotfix Phase 3 P0).
//
// `ProductReviewRow` is the internal storage row and includes fields that
// must never leak through public Store API responses: `customer_id`,
// `order_id`, moderation metadata (`status`, `moderated_by`, `moderated_at`,
// `rejection_reason`).
//
// - `ProductReviewPublic` / `toPublicReview`  → for endpoints that anybody
//   (incl. unauthenticated bots) can hit:
//     * GET  /store/products/:id/reviews
//     * GET  /store/reviews/top
//     * POST /store/products/:id/reviews   (response.review)
//
// - `ProductReviewMine` / `toMineReview`      → for the customer-only list
//   GET /store/customers/me/reviews. The customer's own `customer_id`
//   is already known on the server (cookie-derived), so we still do NOT
//   echo it back; we only add `status` + `rejection_reason` so the
//   `/account/reviews` page can render «На модерации / Опубликован /
//   Отклонён» (plan §6.5).
//
// Admin routes keep `ProductReviewRow` — the moderation UI legitimately
// needs the full shape.
// ---------------------------------------------------------------------------

export type ProductReviewPublic = {
  id: string
  product_id: string
  customer_name: string
  rating: number
  title: string | null
  text: string
  pros: string | null
  cons: string | null
  verified_purchase: boolean
  helpful_count: number
  /**
   * Reserved for Phase 3 step 5 (image attachments). The backend currently
   * stores `null` because the POST schema rejects `images`; the field is
   * declared on the public shape so future image rollout is non-breaking.
   * Defensive: only `string[]` arrays are forwarded — any other runtime
   * shape collapses to `null`.
   */
  images: string[] | null
  /**
   * Phase 3 / step 4 — admin reply («Ответ магазина»). `null` when the
   * moderator has not posted a reply, or has cleared a previous one. The
   * admin actor id (`merchant_reply_by`) is intentionally OMITTED from
   * the public shape — it is internal moderation metadata, on par with
   * `moderated_by` (plan §9 Phase 3 п.3 «admin id остаётся серверным
   * полем»).
   */
  merchant_reply: { text: string; created_at: string } | null
  created_at: string
  updated_at: string
}

export type ProductReviewMine = ProductReviewPublic & {
  status: ProductReviewStatus
  rejection_reason: string | null
}

function normalizeImagesForPublic(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const strings = value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  )
  return strings.length > 0 ? strings : null
}

/**
 * Whitelist a {@link ProductReviewRow} into the public shape — explicit field
 * copy so adding a new column to `product_review` cannot accidentally widen
 * the public contract. Keep changes here and the storefront `ProductReviewItem`
 * type in lockstep.
 */
export function toPublicReview(row: ProductReviewRow): ProductReviewPublic {
  return {
    id: row.id,
    product_id: row.product_id,
    customer_name: row.customer_name,
    rating: row.rating,
    title: row.title,
    text: row.text,
    pros: row.pros,
    cons: row.cons,
    verified_purchase: row.verified_purchase,
    helpful_count: row.helpful_count,
    images: normalizeImagesForPublic(row.images),
    merchant_reply:
      row.merchant_reply_text && row.merchant_reply_at
        ? {
            text: row.merchant_reply_text,
            created_at: row.merchant_reply_at,
          }
        : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Whitelist a {@link ProductReviewRow} for the customer's own «Мои отзывы»
 * list — the public shape plus `status` and `rejection_reason`. Still no
 * `customer_id` / `order_id` / `moderated_by` / `moderated_at`.
 */
export function toMineReview(row: ProductReviewRow): ProductReviewMine {
  return {
    ...toPublicReview(row),
    status: row.status,
    rejection_reason: row.rejection_reason,
  }
}

export type ProductReviewCreateInput = {
  rating: number
  text: string
  title?: string | null
  pros?: string | null
  cons?: string | null
}

export type ProductReviewAdminFilters = {
  status?: ProductReviewStatus | undefined
  productId?: string | undefined
  dateFrom?: string | undefined
  dateTo?: string | undefined
}

export type CustomerNameSource = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

// ---------------------------------------------------------------------------
// Error contract — typed errors for API routes to map to HTTP statuses
// ---------------------------------------------------------------------------

export const PRODUCT_REVIEW_ERROR_CODES = [
  "customer_not_found",
  "duplicate_review",
  "not_found",
  "not_owner",
  "cannot_delete_published",
  "not_found_or_not_approved",
  "reply_text_required",
  "reply_text_too_long",
] as const

export type ProductReviewErrorCode = (typeof PRODUCT_REVIEW_ERROR_CODES)[number]

/**
 * Typed error thrown by this module. API routes inspect `code` to decide on
 * the HTTP status (404 / 409 / 403 / etc.). Stays a plain `Error` subclass
 * with a `code` field — this matches the lightweight style of
 * [`marketing-layer.ts`](medusa-agency-boilerplate/src/modules/marketing-layer.ts:1)
 * (no MikroORM, no Medusa Service classes, no MedusaError ceremony for
 * domain-level conditions that the route expresses as 4xx).
 */
export class ProductReviewError extends Error {
  readonly code: ProductReviewErrorCode

  constructor(code: ProductReviewErrorCode, message?: string) {
    super(message ?? code)
    this.name = "ProductReviewError"
    this.code = code
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }
  const candidate = error as { code?: unknown }
  return candidate.code === "23505"
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getRawRows<T>(result: RawSqlRowsResult<T>): T[] {
  return Array.isArray(result?.rows) ? result.rows : []
}

function getRawRowCount(result: RawSqlRowsResult<unknown>): number {
  if (typeof result?.rowCount === "number") {
    return result.rowCount
  }
  return Array.isArray(result?.rows) ? result.rows.length : 0
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const collapsed = value.replace(/\s+/g, " ").trim()
  return collapsed.length ? collapsed : null
}

function normalizeIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms) ? null : value.toISOString()
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
  }
  return null
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "t" || normalized === "true" || normalized === "1") {
      return true
    }
    if (normalized === "f" || normalized === "false" || normalized === "0") {
      return false
    }
  }
  if (typeof value === "number") {
    return value !== 0
  }
  return fallback
}

function asInteger(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

function asDecimalOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isProductReviewStatus(value: unknown): value is ProductReviewStatus {
  return (
    typeof value === "string" &&
    (PRODUCT_REVIEW_STATUSES as readonly string[]).includes(value.trim())
  )
}

function normalizeReviewRow(value: Record<string, unknown>): ProductReviewRow {
  const status = isProductReviewStatus(value.status)
    ? (value.status as ProductReviewStatus)
    : "pending"

  const customerName =
    typeof value.customer_name === "string" && value.customer_name.length
      ? value.customer_name
      : ANONYMIZED_CUSTOMER_NAME

  const text = typeof value.text === "string" ? value.text : ""

  return {
    id: typeof value.id === "string" ? value.id : "",
    product_id: typeof value.product_id === "string" ? value.product_id : "",
    customer_id:
      typeof value.customer_id === "string" && value.customer_id.length
        ? value.customer_id
        : null,
    order_id:
      typeof value.order_id === "string" && value.order_id.length
        ? value.order_id
        : null,
    rating: asInteger(value.rating, 0),
    title:
      typeof value.title === "string" && value.title.length
        ? value.title
        : null,
    text,
    pros:
      typeof value.pros === "string" && value.pros.length ? value.pros : null,
    cons:
      typeof value.cons === "string" && value.cons.length ? value.cons : null,
    status,
    moderated_by:
      typeof value.moderated_by === "string" && value.moderated_by.length
        ? value.moderated_by
        : null,
    moderated_at: normalizeIsoDate(value.moderated_at),
    rejection_reason:
      typeof value.rejection_reason === "string" &&
      value.rejection_reason.length
        ? value.rejection_reason
        : null,
    verified_purchase: asBoolean(value.verified_purchase, false),
    helpful_count: asInteger(value.helpful_count, 0),
    images: value.images ?? null,
    customer_name: customerName,
    merchant_reply_text:
      typeof value.merchant_reply_text === "string" &&
      value.merchant_reply_text.length
        ? value.merchant_reply_text
        : null,
    merchant_reply_by:
      typeof value.merchant_reply_by === "string" &&
      value.merchant_reply_by.length
        ? value.merchant_reply_by
        : null,
    merchant_reply_at: normalizeIsoDate(value.merchant_reply_at),
    created_at: normalizeIsoDate(value.created_at) || new Date(0).toISOString(),
    updated_at: normalizeIsoDate(value.updated_at) || new Date(0).toISOString(),
  }
}

function normalizeRatingSummaryRow(
  value: Record<string, unknown>
): ProductRatingSummaryRow {
  return {
    product_id:
      typeof value.product_id === "string" ? value.product_id : "",
    average_rating: asDecimalOrNull(value.average_rating),
    total_reviews: asInteger(value.total_reviews, 0),
    rating_1: asInteger(value.rating_1, 0),
    rating_2: asInteger(value.rating_2, 0),
    rating_3: asInteger(value.rating_3, 0),
    rating_4: asInteger(value.rating_4, 0),
    rating_5: asInteger(value.rating_5, 0),
    updated_at: normalizeIsoDate(value.updated_at),
  }
}

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

export async function ensureProductReviewsTables(pgConnection: PgConnectionLike) {
  await pgConnection.raw(`
    create table if not exists product_review (
      id text primary key,
      product_id text not null,
      customer_id text null,
      order_id text null,
      rating integer not null check (rating between 1 and 5),
      title text null,
      text text not null,
      pros text null,
      cons text null,
      status text not null default 'pending'
        check (status in ('pending','approved','rejected')),
      moderated_by text null,
      moderated_at timestamptz null,
      rejection_reason text null,
      verified_purchase boolean not null default false
        check (verified_purchase = false or order_id is not null),
      helpful_count integer not null default 0,
      images jsonb null,
      customer_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pgConnection.raw(`
    create table if not exists product_review_helpful (
      review_id text not null references product_review(id) on delete cascade,
      customer_id text not null,
      created_at timestamptz not null default now(),
      primary key (review_id, customer_id)
    )
  `)

  await pgConnection.raw(`
    create table if not exists product_rating_summary (
      product_id text primary key,
      average_rating numeric(3,2) null,
      total_reviews integer not null default 0,
      rating_1 integer not null default 0,
      rating_2 integer not null default 0,
      rating_3 integer not null default 0,
      rating_4 integer not null default 0,
      rating_5 integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `)

  await pgConnection.raw(`
    create unique index if not exists product_review_unique_active
      on product_review (product_id, customer_id)
      where customer_id is not null and status <> 'rejected'
  `)
  await pgConnection.raw(`
    create index if not exists product_review_product_status_created
      on product_review (product_id, status, created_at desc)
  `)
  await pgConnection.raw(`
    create index if not exists product_review_product_status_helpful
      on product_review (product_id, status, helpful_count desc)
  `)
  await pgConnection.raw(`
    create index if not exists product_review_status_created
      on product_review (status, created_at desc)
  `)
  await pgConnection.raw(`
    create index if not exists product_review_customer_created
      on product_review (customer_id, created_at desc)
  `)
  await pgConnection.raw(`
    create index if not exists product_review_order
      on product_review (order_id)
  `)

  // -------------------------------------------------------------------------
  // Phase 3 / step 4 — admin reply («Ответ магазина»).
  //
  // Pattern (plan §1.1 п.15 + §3.2): three nullable columns added in place
  // via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` rather than a separate
  // `product_review_reply` table — there is at most one reply per review
  // and history is not required (plan §9 Phase 3 п.3).
  //
  // Idempotent: `ADD COLUMN IF NOT EXISTS` is a no-op on subsequent runs
  // (Postgres ≥ 9.6 — predates Medusa's minimum supported version) so the
  // lazy-ensure pattern keeps working without a one-shot migration step.
  //
  // No new index — the columns are written/read from the single locked
  // row by id during the admin POST/DELETE, so an index would only add
  // write overhead.
  // -------------------------------------------------------------------------
  await pgConnection.raw(`
    alter table product_review
      add column if not exists merchant_reply_text text null,
      add column if not exists merchant_reply_by   text null,
      add column if not exists merchant_reply_at   timestamptz null
  `)
}

// ---------------------------------------------------------------------------
// Container helpers
// ---------------------------------------------------------------------------

export function getProductReviewsPgConnection(container: any) {
  return container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as PgConnectionLike
}

function getQueryFromContainer(container: any) {
  return container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraphLike
}

// ---------------------------------------------------------------------------
// 2.1 Internal utilities (exported because routes/subscribers may need them)
// ---------------------------------------------------------------------------

/**
 * Resolve the displayable customer name snapshot for a review.
 *
 * Priority chain (see plan §3.2):
 *   1. `first_name` + " " + `last_name[0]` + "." (e.g. `Иван И.`),
 *   2. just `first_name` (typical for VK ID where last_name is empty),
 *   3. local-part of `email` before `@`,
 *   4. literal `'Покупатель'`.
 */
export function resolveCustomerNameSnapshot(
  customer: CustomerNameSource | null | undefined
): string {
  if (!customer) {
    return ANONYMIZED_CUSTOMER_NAME
  }

  const firstName =
    typeof customer.first_name === "string"
      ? customer.first_name.trim()
      : ""
  const lastName =
    typeof customer.last_name === "string" ? customer.last_name.trim() : ""
  const email =
    typeof customer.email === "string" ? customer.email.trim() : ""

  if (firstName && lastName) {
    const initial = lastName.charAt(0)
    return initial ? `${firstName} ${initial}.` : firstName
  }

  if (firstName) {
    return firstName
  }

  if (email) {
    const local = email.split("@")[0]?.trim()
    if (local) {
      return local
    }
  }

  return ANONYMIZED_CUSTOMER_NAME
}

/**
 * Trim and collapse internal whitespace. Used for `text/title/pros/cons` —
 * stored as plain text only. Markdown/HTML are not parsed; this normalisation
 * does not strip tags by itself, the storefront escapes the text as plain
 * text on render (see plan §10.2). Empty string → null.
 */
export function normalizeReviewText(value: unknown): string | null {
  return normalizeNullableString(value)
}

/**
 * Generate a UUID-based review id. Matches the prefix style of
 * [`marketing-layer.ts`](medusa-agency-boilerplate/src/modules/marketing-layer.ts:378)
 * (e.g. `mc_<32hex>`) — `pr_` for product review.
 */
export function generateReviewId(): string {
  return `pr_${randomUUID().replace(/-/g, "")}`
}

// ---------------------------------------------------------------------------
// 2.2 Verified purchase resolution via Medusa Query Graph
// ---------------------------------------------------------------------------

type OrderItemForVerification = {
  product_id?: string | null
  variant?: { product_id?: string | null } | null
}

type OrderForVerification = {
  id?: string | null
  items?: OrderItemForVerification[] | null
}

/**
 * Determine whether `customerId` has a completed order containing `productId`.
 * Returns `{ verified: boolean, orderId: string | null }` — the first matching
 * order id wins. Whether `verified=true` is required for review creation is a
 * policy decision of the API route (env `REVIEWS_REQUIRE_PURCHASE`); this
 * helper is purely informational.
 */
export async function verifyCustomerPurchasedProduct({
  container,
  customerId,
  productId,
}: {
  container: any
  customerId: string
  productId: string
}): Promise<{ verified: boolean; orderId: string | null }> {
  if (!customerId || !productId) {
    return { verified: false, orderId: null }
  }

  const query = getQueryFromContainer(container)
  const { data: orders } = await query.graph<OrderForVerification>({
    entity: "order",
    fields: ["id", "items.product_id", "items.variant.product_id"],
    filters: {
      customer_id: customerId,
      status: "completed",
    },
  })

  for (const order of orders || []) {
    const orderId = typeof order?.id === "string" ? order.id : null
    if (!orderId) {
      continue
    }
    const items = Array.isArray(order?.items) ? order.items : []
    for (const item of items) {
      const directProductId =
        typeof item?.product_id === "string" ? item.product_id : null
      const variantProductId =
        item?.variant && typeof item.variant.product_id === "string"
          ? item.variant.product_id
          : null
      if (directProductId === productId || variantProductId === productId) {
        return { verified: true, orderId }
      }
    }
  }

  return { verified: false, orderId: null }
}

// ---------------------------------------------------------------------------
// Customer lookup (for snapshot name + customer_not_found check)
// ---------------------------------------------------------------------------

type CustomerForReviewSnapshot = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

async function fetchCustomerForReview(
  container: any,
  customerId: string
): Promise<CustomerForReviewSnapshot | null> {
  if (!customerId) {
    return null
  }

  const query = getQueryFromContainer(container)
  const { data } = await query.graph<CustomerForReviewSnapshot>({
    entity: "customer",
    fields: ["id", "first_name", "last_name", "email"],
    filters: { id: customerId },
    pagination: { take: 1, skip: 0 },
  })

  return data?.[0] || null
}

// ---------------------------------------------------------------------------
// 2.3 CRUD on reviews
// ---------------------------------------------------------------------------

/**
 * Create a new review. The payload is expected to be already validated by Zod
 * at the route layer (`images` is dropped at the route per Phase 1 §13 and is
 * not present in this type at all).
 *
 * Wraps the verified-purchase lookup, the INSERT, and the optional
 * auto-approve recalc in a single pg transaction so a parallel writer cannot
 * sneak between the INSERT and the recalc.
 */
export async function createProductReview({
  container,
  productId,
  customerId,
  payload,
  autoApprove,
}: {
  container: any
  productId: string
  customerId: string
  payload: ProductReviewCreateInput
  autoApprove: boolean
}): Promise<ProductReviewRow> {
  const pgConnection = getProductReviewsPgConnection(container)
  await ensureProductReviewsTables(pgConnection)

  const trimmedProductId = productId?.trim()
  const trimmedCustomerId = customerId?.trim()
  if (!trimmedProductId) {
    throw new ProductReviewError(
      "not_found",
      "product_id is required to create a review"
    )
  }
  if (!trimmedCustomerId) {
    throw new ProductReviewError(
      "customer_not_found",
      "customer_id is required to create a review"
    )
  }

  const customer = await fetchCustomerForReview(container, trimmedCustomerId)
  if (!customer) {
    throw new ProductReviewError(
      "customer_not_found",
      `Customer with id '${trimmedCustomerId}' was not found`
    )
  }

  const customerName = resolveCustomerNameSnapshot(customer)
  const text = normalizeReviewText(payload.text)
  if (!text) {
    // Defensive — Zod already validates min length at the route, but keep
    // the module honest if it is ever called directly.
    throw new ProductReviewError(
      "not_found",
      "text is required to create a review"
    )
  }
  const title = normalizeReviewText(payload.title ?? null)
  const pros = normalizeReviewText(payload.pros ?? null)
  const cons = normalizeReviewText(payload.cons ?? null)

  const status: ProductReviewStatus = autoApprove ? "approved" : "pending"
  const id = generateReviewId()

  const { verified, orderId } = await verifyCustomerPurchasedProduct({
    container,
    customerId: trimmedCustomerId,
    productId: trimmedProductId,
  })

  return await pgConnection.transaction(async (trx) => {
    let insertedRow: ProductReviewRow

    try {
      const insertResult = await trx.raw<Record<string, unknown>>(
        `
          insert into product_review (
            id,
            product_id,
            customer_id,
            order_id,
            rating,
            title,
            text,
            pros,
            cons,
            status,
            verified_purchase,
            helpful_count,
            customer_name
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
          returning *
        `,
        [
          id,
          trimmedProductId,
          trimmedCustomerId,
          orderId,
          payload.rating,
          title,
          text,
          pros,
          cons,
          status,
          verified,
          customerName,
        ]
      )

      const rows = getRawRows<Record<string, unknown>>(insertResult)
      if (!rows.length) {
        throw new ProductReviewError(
          "not_found",
          "Failed to insert product_review row"
        )
      }
      insertedRow = normalizeReviewRow(rows[0])
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProductReviewError(
          "duplicate_review",
          "A review for this product by this customer already exists"
        )
      }
      throw error
    }

    if (status === "approved") {
      await recalcProductRatingSummaryWithExecutor(trx, trimmedProductId)
    }

    return insertedRow
  })
}

/**
 * Atomic rating summary rebuild — the only path that mutates
 * `product_rating_summary`. Single SQL statement, no read-modify-write.
 *
 * `average_rating` is `NULL` when there are zero approved reviews; the UI
 * renders an explicit empty-state on `NULL` (plan §3.2 / §6.2).
 *
 * Two flavours:
 * - `recalcProductRatingSummary({pgConnection, productId})` — public entry
 *   point for callers that already hold a connection (e.g. subscribers).
 * - When inside a transaction, callers reuse the trx executor via the
 *   internal `recalcProductRatingSummaryWithExecutor`.
 */
export async function recalcProductRatingSummary({
  pgConnection,
  productId,
}: {
  pgConnection: PgConnectionLike
  productId: string
}): Promise<void> {
  await ensureProductReviewsTables(pgConnection)
  await recalcProductRatingSummaryWithExecutor(pgConnection, productId)
}

async function recalcProductRatingSummaryWithExecutor(
  executor: PgTransactionLike | PgConnectionLike,
  productId: string
): Promise<void> {
  await executor.raw(
    `
      insert into product_rating_summary (
        product_id,
        average_rating,
        total_reviews,
        rating_1,
        rating_2,
        rating_3,
        rating_4,
        rating_5,
        updated_at
      )
      select
        ?::text,
        case when count(*) = 0 then null else round(avg(rating)::numeric, 2) end,
        count(*),
        count(*) filter (where rating = 1),
        count(*) filter (where rating = 2),
        count(*) filter (where rating = 3),
        count(*) filter (where rating = 4),
        count(*) filter (where rating = 5),
        now()
      from product_review
      where product_id = ? and status = 'approved'
      on conflict (product_id) do update set
        average_rating = excluded.average_rating,
        total_reviews  = excluded.total_reviews,
        rating_1 = excluded.rating_1,
        rating_2 = excluded.rating_2,
        rating_3 = excluded.rating_3,
        rating_4 = excluded.rating_4,
        rating_5 = excluded.rating_5,
        updated_at = now()
    `,
    [productId, productId]
  )
}

export type ProductReviewModerationResult = {
  review: ProductReviewRow
  productId: string
  /**
   * True when the row's status actually transitioned (e.g.
   * `pending → approved`, `approved → rejected`, `pending → rejected`).
   * False on the idempotent paths where the row was already in the
   * target status and no UPDATE was issued.
   *
   * Phase 2 / step 6: admin routes use this flag to send a transactional
   * moderation email exactly once per real transition (plan §1.1 п.9 +
   * §9 Phase 2). `recalculated` cannot be reused for that decision: a
   * `pending → rejected` transition is a real status change but does
   * NOT touch the rating summary, so `recalculated` is `false`.
   */
  statusChanged: boolean
  recalculated: boolean
}

export async function approveProductReview({
  container,
  reviewId,
  moderatedBy,
}: {
  container: any
  reviewId: string
  moderatedBy: string | null
}): Promise<ProductReviewModerationResult> {
  const pgConnection = getProductReviewsPgConnection(container)
  await ensureProductReviewsTables(pgConnection)

  return await pgConnection.transaction(async (trx) => {
    const lockResult = await trx.raw<Record<string, unknown>>(
      `
        select *
        from product_review
        where id = ?
        for update
      `,
      [reviewId]
    )

    const lockedRows = getRawRows<Record<string, unknown>>(lockResult)
    if (!lockedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' was not found`
      )
    }

    const lockedRow = normalizeReviewRow(lockedRows[0])
    const productId = lockedRow.product_id

    if (lockedRow.status === "approved") {
      // Idempotent: the lock is still released on commit, no recalc needed.
      return {
        review: lockedRow,
        productId,
        statusChanged: false,
        recalculated: false,
      }
    }

    const updateResult = await trx.raw<Record<string, unknown>>(
      `
        update product_review
        set status = 'approved',
            moderated_by = ?,
            moderated_at = now(),
            updated_at = now()
        where id = ?
        returning *
      `,
      [moderatedBy || null, reviewId]
    )

    const updatedRows = getRawRows<Record<string, unknown>>(updateResult)
    if (!updatedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' disappeared during update`
      )
    }
    const updatedReview = normalizeReviewRow(updatedRows[0])

    await recalcProductRatingSummaryWithExecutor(trx, productId)

    return {
      review: updatedReview,
      productId,
      statusChanged: true,
      recalculated: true,
    }
  })
}

export async function rejectProductReview({
  container,
  reviewId,
  moderatedBy,
  reason,
}: {
  container: any
  reviewId: string
  moderatedBy: string | null
  reason: string | null
}): Promise<ProductReviewModerationResult> {
  const pgConnection = getProductReviewsPgConnection(container)
  await ensureProductReviewsTables(pgConnection)

  const normalizedReason = normalizeReviewText(reason)

  return await pgConnection.transaction(async (trx) => {
    const lockResult = await trx.raw<Record<string, unknown>>(
      `
        select *
        from product_review
        where id = ?
        for update
      `,
      [reviewId]
    )

    const lockedRows = getRawRows<Record<string, unknown>>(lockResult)
    if (!lockedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' was not found`
      )
    }

    const lockedRow = normalizeReviewRow(lockedRows[0])
    const productId = lockedRow.product_id
    const prevStatus = lockedRow.status

    if (prevStatus === "rejected") {
      return {
        review: lockedRow,
        productId,
        statusChanged: false,
        recalculated: false,
      }
    }

    const updateResult = await trx.raw<Record<string, unknown>>(
      `
        update product_review
        set status = 'rejected',
            rejection_reason = ?,
            moderated_by = ?,
            moderated_at = now(),
            updated_at = now()
        where id = ?
        returning *
      `,
      [normalizedReason, moderatedBy || null, reviewId]
    )

    const updatedRows = getRawRows<Record<string, unknown>>(updateResult)
    if (!updatedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' disappeared during update`
      )
    }
    const updatedReview = normalizeReviewRow(updatedRows[0])

    let recalculated = false
    if (prevStatus === "approved") {
      await recalcProductRatingSummaryWithExecutor(trx, productId)
      recalculated = true
    }

    return {
      review: updatedReview,
      productId,
      statusChanged: true,
      recalculated,
    }
  })
}

export type ProductReviewAdminDeleteResult = {
  productId: string
  /**
   * `customer_id` of the deleted row, mirroring the same field on
   * [`ProductReviewRow`](medusa-agency-boilerplate/src/modules/product-reviews.ts:89).
   * `null` for anonymized reviews. Phase 2 / step 6: the admin DELETE
   * route uses this to invalidate the per-customer storefront tag
   * `customer-reviews-${customer_id}` (plan §6.6).
   */
  customerId: string | null
  recalculated: boolean
}

export async function deleteProductReviewAsAdmin({
  container,
  reviewId,
}: {
  container: any
  reviewId: string
}): Promise<ProductReviewAdminDeleteResult> {
  const pgConnection = getProductReviewsPgConnection(container)
  await ensureProductReviewsTables(pgConnection)

  return await pgConnection.transaction(async (trx) => {
    const lockResult = await trx.raw<Record<string, unknown>>(
      `
        select *
        from product_review
        where id = ?
        for update
      `,
      [reviewId]
    )

    const lockedRows = getRawRows<Record<string, unknown>>(lockResult)
    if (!lockedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' was not found`
      )
    }

    const lockedRow = normalizeReviewRow(lockedRows[0])
    const productId = lockedRow.product_id
    const customerId = lockedRow.customer_id
    const prevStatus = lockedRow.status

    await trx.raw(
      `
        delete from product_review
        where id = ?
      `,
      [reviewId]
    )

    let recalculated = false
    if (prevStatus === "approved") {
      await recalcProductRatingSummaryWithExecutor(trx, productId)
      recalculated = true
    }

    return {
      productId,
      customerId,
      recalculated,
    }
  })
}

export type ProductReviewCustomerDeleteResult = {
  productId: string
}

export async function deleteOwnPendingProductReview({
  container,
  reviewId,
  customerId,
}: {
  container: any
  reviewId: string
  customerId: string
}): Promise<ProductReviewCustomerDeleteResult> {
  const pgConnection = getProductReviewsPgConnection(container)
  await ensureProductReviewsTables(pgConnection)

  return await pgConnection.transaction(async (trx) => {
    const lockResult = await trx.raw<Record<string, unknown>>(
      `
        select *
        from product_review
        where id = ?
        for update
      `,
      [reviewId]
    )

    const lockedRows = getRawRows<Record<string, unknown>>(lockResult)
    if (!lockedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' was not found`
      )
    }

    const lockedRow = normalizeReviewRow(lockedRows[0])

    if (lockedRow.customer_id !== customerId) {
      throw new ProductReviewError(
        "not_owner",
        "This review does not belong to the requesting customer"
      )
    }

    if (lockedRow.status === "approved") {
      throw new ProductReviewError(
        "cannot_delete_published",
        "Опубликованный отзыв удалить нельзя"
      )
    }

    await trx.raw(
      `
        delete from product_review
        where id = ?
      `,
      [reviewId]
    )

    // No recalc needed: only pending or rejected reviews can reach this path,
    // and neither contributes to product_rating_summary aggregates.
    return {
      productId: lockedRow.product_id,
    }
  })
}

// ---------------------------------------------------------------------------
// 2.3.1 Admin merchant reply («Ответ магазина»)
//
// Plan §9 Phase 3 п.3: моёодератор может оставить один краткий ответ под
// отзывом покупателя. Реализовано через nullable-колонки на самом ряде
// (см. {@link ensureProductReviewsTables}); отдельная таблица
// `product_review_reply` сознательно НЕ создаётся — нужна максимум одна
// запись на отзыв и историю не ведём.
//
// Reply разрешён для отзыва в любом статусе (pending / approved / rejected).
// `recalculated` всегда `false` — текст ответа не влияет на рейтинг товара,
// и `statusChanged` всегда `false` — статус самого отзыва не меняется.
// ---------------------------------------------------------------------------

/** Hard cap on the merchant reply text length (chars after trim). Enforced
 *  by the Zod schema at the route layer and re-checked here as defence in
 *  depth so the module is honest when called directly. */
export const PRODUCT_REVIEW_MERCHANT_REPLY_MAX = 1000

export interface SetProductReviewMerchantReplyArgs {
  container: any
  reviewId: string
  /** 1..1000 chars after `normalizeReviewText` (trim + collapse whitespace). */
  text: string
  /**
   * Admin actor id of the moderator (`auth_context.actor_id` upstream).
   * Stored in `merchant_reply_by` for audit purposes — never echoed to the
   * public `ProductReviewPublic` shape.
   */
  authorId: string | null
}

export interface ClearProductReviewMerchantReplyArgs {
  container: any
  reviewId: string
}

/**
 * Result of {@link setProductReviewMerchantReply} /
 * {@link clearProductReviewMerchantReply}. The shape mirrors
 * {@link ProductReviewModerationResult} so the admin route can reuse the
 * same revalidation helper, but `recalculated` and `statusChanged` are
 * always literally `false` — admin reply touches neither the rating
 * aggregate nor the moderation status.
 */
export type SetMerchantReplyResult = {
  review: ProductReviewRow
  productId: string
  recalculated: false
  statusChanged: false
}

/**
 * Persist or update the moderator's reply on the given review.
 *
 * Wrapped in a single pg transaction with `SELECT … FOR UPDATE` so the
 * UPDATE cannot race with concurrent admin moderation actions on the same
 * row. `text` is trimmed/whitespace-collapsed via `normalizeReviewText`
 * before length checks — the route's Zod schema already enforces the
 * 1..1000 bound, but the module re-validates so it is safe to call from
 * subscribers/scripts directly.
 */
export async function setProductReviewMerchantReply({
  container,
  reviewId,
  text,
  authorId,
}: SetProductReviewMerchantReplyArgs): Promise<SetMerchantReplyResult> {
  const pgConnection = getProductReviewsPgConnection(container)
  await ensureProductReviewsTables(pgConnection)

  const normalizedText = normalizeReviewText(text)
  if (!normalizedText) {
    throw new ProductReviewError(
      "reply_text_required",
      "merchant reply text is required"
    )
  }
  if (normalizedText.length > PRODUCT_REVIEW_MERCHANT_REPLY_MAX) {
    throw new ProductReviewError(
      "reply_text_too_long",
      `merchant reply text must be at most ${PRODUCT_REVIEW_MERCHANT_REPLY_MAX} chars`
    )
  }

  const trimmedAuthor =
    typeof authorId === "string" && authorId.trim() ? authorId.trim() : null

  return await pgConnection.transaction(async (trx) => {
    const lockResult = await trx.raw<Record<string, unknown>>(
      `
        select *
        from product_review
        where id = ?
        for update
      `,
      [reviewId]
    )

    const lockedRows = getRawRows<Record<string, unknown>>(lockResult)
    if (!lockedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' was not found`
      )
    }

    const updateResult = await trx.raw<Record<string, unknown>>(
      `
        update product_review
        set merchant_reply_text = ?,
            merchant_reply_by = ?,
            merchant_reply_at = now(),
            updated_at = now()
        where id = ?
        returning *
      `,
      [normalizedText, trimmedAuthor, reviewId]
    )

    const updatedRows = getRawRows<Record<string, unknown>>(updateResult)
    if (!updatedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' disappeared during update`
      )
    }
    const updatedReview = normalizeReviewRow(updatedRows[0])

    return {
      review: updatedReview,
      productId: updatedReview.product_id,
      recalculated: false,
      statusChanged: false,
    }
  })
}

/**
 * Clear an existing merchant reply (sets all three columns back to NULL).
 * Idempotent on the SQL layer — the `update` runs unconditionally, so a
 * call against an already-empty row is a no-op write that bumps
 * `updated_at`. We accept that to keep the path symmetric with `set`.
 */
export async function clearProductReviewMerchantReply({
  container,
  reviewId,
}: ClearProductReviewMerchantReplyArgs): Promise<SetMerchantReplyResult> {
  const pgConnection = getProductReviewsPgConnection(container)
  await ensureProductReviewsTables(pgConnection)

  return await pgConnection.transaction(async (trx) => {
    const lockResult = await trx.raw<Record<string, unknown>>(
      `
        select *
        from product_review
        where id = ?
        for update
      `,
      [reviewId]
    )

    const lockedRows = getRawRows<Record<string, unknown>>(lockResult)
    if (!lockedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' was not found`
      )
    }

    const updateResult = await trx.raw<Record<string, unknown>>(
      `
        update product_review
        set merchant_reply_text = null,
            merchant_reply_by = null,
            merchant_reply_at = null,
            updated_at = now()
        where id = ?
        returning *
      `,
      [reviewId]
    )

    const updatedRows = getRawRows<Record<string, unknown>>(updateResult)
    if (!updatedRows.length) {
      throw new ProductReviewError(
        "not_found",
        `Review with id '${reviewId}' disappeared during update`
      )
    }
    const updatedReview = normalizeReviewRow(updatedRows[0])

    return {
      review: updatedReview,
      productId: updatedReview.product_id,
      recalculated: false,
      statusChanged: false,
    }
  })
}

// ---------------------------------------------------------------------------
// 2.4 Reads
// ---------------------------------------------------------------------------

function clampPagination(page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1
  const safePageSize =
    Number.isFinite(pageSize) && pageSize >= 1
      ? Math.min(Math.trunc(pageSize), 100)
      : 10
  return { page: safePage, pageSize: safePageSize }
}

async function countReviews(
  pgConnection: PgConnectionLike,
  whereSql: string,
  bindings: unknown[]
): Promise<number> {
  const result = await pgConnection.raw<{ count?: string | number }>(
    `select count(*)::int as count from product_review ${whereSql}`,
    bindings
  )
  const rows = getRawRows<{ count?: string | number }>(result)
  const value = rows[0]?.count
  return typeof value === "number" ? value : asInteger(value, 0)
}

/**
 * Normalise an optional integer rating bound (1..5). `null` / `undefined` /
 * out-of-range values collapse to `null` so the parameterized SQL evaluates
 * `($N::int IS NULL OR rating <= $N)` as a no-op and skips the predicate.
 *
 * Defensive — Zod at the route already enforces 1..5 — but the module is
 * exported and may be called from subscribers/scripts.
 */
function normalizeRatingBound(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }
  const truncated = Math.trunc(value)
  if (truncated < 1 || truncated > 5) {
    return null
  }
  return truncated
}

/**
 * Normalise the optional `verifiedOnly` flag. `undefined` / `null` collapse
 * to `null` — that disables the predicate. Anything truthy/falsy yields a
 * concrete boolean. Mirrors `asBoolean` but keeps a tri-state instead of
 * defaulting to `false`.
 */
function normalizeOptionalBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") {
      return true
    }
    if (normalized === "false" || normalized === "0") {
      return false
    }
  }
  return null
}

export interface ListApprovedProductReviewsArgs {
  pgConnection: PgConnectionLike
  productId: string
  page: number
  pageSize: number
  sort: ProductReviewListSort
  /** Optional inclusive lower bound on `rating` (1..5). */
  minRating?: number | null
  /** Optional inclusive upper bound on `rating` (1..5). */
  maxRating?: number | null
  /** When `true`, only `verified_purchase = true` rows are returned. */
  verifiedOnly?: boolean | null
}

/**
 * List approved product reviews for the public storefront (plan §4.3).
 *
 * Phase 3 / step 2: optional filters `minRating` / `maxRating` /
 * `verifiedOnly` are applied through a single dynamic WHERE clause built
 * with positional placeholders. Unset filters become `NULL` so the SQL plan
 * is stable and the query optimiser can short-circuit each predicate.
 *
 * Filtering applies to BOTH the items query AND the count query so `total`
 * matches the visible page count.
 */
export async function listApprovedProductReviews({
  pgConnection,
  productId,
  page,
  pageSize,
  sort,
  minRating,
  maxRating,
  verifiedOnly,
}: ListApprovedProductReviewsArgs): Promise<ProductReviewListResult> {
  await ensureProductReviewsTables(pgConnection)

  const { page: safePage, pageSize: safePageSize } = clampPagination(
    page,
    pageSize
  )
  const offset = (safePage - 1) * safePageSize

  let orderByClause: string
  switch (sort) {
    case "helpful":
      orderByClause = "order by helpful_count desc, created_at desc, id desc"
      break
    case "rating":
      orderByClause = "order by rating desc, created_at desc, id desc"
      break
    case "newest":
    default:
      orderByClause = "order by created_at desc, id desc"
      break
  }

  // Resolve the optional filters into stable positional values. Each filter
  // is a single placeholder; the SQL gates it with `($N::type IS NULL OR …)`
  // so passing NULL disables the predicate without changing the plan.
  const minRatingParam = normalizeRatingBound(minRating)
  const maxRatingParam = normalizeRatingBound(maxRating)
  const verifiedOnlyParam = normalizeOptionalBoolean(verifiedOnly)

  const filterWhereClause = `
    where product_id = ?
      and status = 'approved'
      and (?::int is null or rating >= ?::int)
      and (?::int is null or rating <= ?::int)
      and (?::boolean is null or verified_purchase = ?::boolean)
  `
  const filterBindings = [
    productId,
    minRatingParam,
    minRatingParam,
    maxRatingParam,
    maxRatingParam,
    verifiedOnlyParam,
    verifiedOnlyParam,
  ]

  const itemsResult = await pgConnection.raw<Record<string, unknown>>(
    `
      select *
      from product_review
      ${filterWhereClause}
      ${orderByClause}
      limit ?
      offset ?
    `,
    [...filterBindings, safePageSize, offset]
  )
  const rows = getRawRows<Record<string, unknown>>(itemsResult)
  const items = rows.map((row) => normalizeReviewRow(row))

  const total = await countReviews(
    pgConnection,
    filterWhereClause,
    filterBindings
  )

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
  }
}

// ---------------------------------------------------------------------------
// Phase 3 / step 3 — top approved reviews across the whole catalog (homepage
// «Лучшие отзывы» widget). Aggregation is over all products; no `product_id`
// filter. The query is intentionally simple: full scan + sort under the tiny
// approved-review volume of staging/early-prod (plan §9 Phase 3 п.5,
// «никаких новых индексов на этом шаге»).
// ---------------------------------------------------------------------------

export interface ListTopApprovedProductReviewsArgs {
  pgConnection: PgConnectionLike
  /** 1..50, default 10. Out-of-range values are clamped, not rejected. */
  limit?: number
  /** 1..5, default 4 — only ★4 and above qualify as «top». */
  minRating?: number
  /**
   * Window in days to look back from `now()`. Default 90.
   * `0` / `undefined` / negative → no date filter (i.e. lifetime top).
   */
  daysWindow?: number
}

/**
 * List the top approved product reviews across the whole catalog. Used by the
 * storefront homepage «Что говорят покупатели» widget (plan §9 Phase 3 п.5).
 *
 * Sorting is `helpful_count DESC, rating DESC, created_at DESC` — social
 * proof first (most-helpful wins), then rating, then recency as a stable
 * tie-breaker. The contract intentionally mirrors the per-product `helpful`
 * sort but adds `rating DESC` as a secondary key so a 5-star review with the
 * same `helpful_count` outranks a 4-star one.
 *
 * Filtering uses the same `($N::int IS NULL OR ...)` guard pattern as
 * [`listApprovedProductReviews`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1232)
 * so the SQL plan stays stable when filters are off.
 */
export async function listTopApprovedProductReviewsAcrossCatalog({
  pgConnection,
  limit,
  minRating,
  daysWindow,
}: ListTopApprovedProductReviewsArgs): Promise<ProductReviewRow[]> {
  await ensureProductReviewsTables(pgConnection)

  const safeLimit = Math.min(
    50,
    Math.max(1, asInteger(limit ?? 10, 10) || 10)
  )

  const minRatingParam = normalizeRatingBound(minRating ?? 4) ?? 4
  const daysWindowRaw = asInteger(daysWindow ?? 90, 90)
  // 0 (or any non-positive) disables the date filter — passed as NULL.
  const daysWindowParam = daysWindowRaw > 0 ? daysWindowRaw : null

  const result = await pgConnection.raw<Record<string, unknown>>(
    `
      select id, product_id, customer_id, customer_name, rating, title, text,
             pros, cons, status, moderated_by, moderated_at, rejection_reason,
             verified_purchase, helpful_count, images, order_id,
             merchant_reply_text, merchant_reply_by, merchant_reply_at,
             created_at, updated_at
      from product_review
      where status = 'approved'
        and (?::int is null or rating >= ?::int)
        and (
          ?::int is null
          or created_at >= now() - (?::int || ' days')::interval
        )
      order by helpful_count desc, rating desc, created_at desc, id desc
      limit ?
    `,
    [
      minRatingParam,
      minRatingParam,
      daysWindowParam,
      daysWindowParam,
      safeLimit,
    ]
  )
  const rows = getRawRows<Record<string, unknown>>(result)
  return rows.map((row) => normalizeReviewRow(row))
}

export async function getProductRatingSummary({
  pgConnection,
  productId,
}: {
  pgConnection: PgConnectionLike
  productId: string
}): Promise<ProductRatingSummaryRow> {
  await ensureProductReviewsTables(pgConnection)

  const result = await pgConnection.raw<Record<string, unknown>>(
    `
      select *
      from product_rating_summary
      where product_id = ?
      limit 1
    `,
    [productId]
  )
  const rows = getRawRows<Record<string, unknown>>(result)
  if (rows[0]) {
    return normalizeRatingSummaryRow(rows[0])
  }

  // No row in the cache yet — return a deterministic empty default. Do NOT
  // INSERT here; the only writer is recalcProductRatingSummary().
  return {
    product_id: productId,
    average_rating: null,
    total_reviews: 0,
    rating_1: 0,
    rating_2: 0,
    rating_3: 0,
    rating_4: 0,
    rating_5: 0,
    updated_at: null,
  }
}

export async function listProductReviewsForCustomer({
  pgConnection,
  customerId,
  page,
  pageSize,
}: {
  pgConnection: PgConnectionLike
  customerId: string
  page: number
  pageSize: number
}): Promise<ProductReviewListResult> {
  await ensureProductReviewsTables(pgConnection)

  const { page: safePage, pageSize: safePageSize } = clampPagination(
    page,
    pageSize
  )
  const offset = (safePage - 1) * safePageSize

  const itemsResult = await pgConnection.raw<Record<string, unknown>>(
    `
      select *
      from product_review
      where customer_id = ?
      order by created_at desc, id desc
      limit ?
      offset ?
    `,
    [customerId, safePageSize, offset]
  )
  const rows = getRawRows<Record<string, unknown>>(itemsResult)
  const items = rows.map((row) => normalizeReviewRow(row))

  const total = await countReviews(
    pgConnection,
    "where customer_id = ?",
    [customerId]
  )

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
  }
}

/**
 * Count reviews authored by `customerId` in the last 24 hours.
 *
 * Used by the Store API route to enforce the bizness-level cap «10 reviews
 * per day per customer» (see plan §10.1). Kept as a module function so the
 * SQL is not duplicated in the route layer.
 */
export async function countCustomerReviewsInLastDay({
  pgConnection,
  customerId,
}: {
  pgConnection: PgConnectionLike
  customerId: string
}): Promise<number> {
  await ensureProductReviewsTables(pgConnection)

  if (!customerId?.trim()) {
    return 0
  }

  const result = await pgConnection.raw<{ count?: string | number }>(
    `
      select count(*)::int as count
      from product_review
      where customer_id = ?
        and created_at > now() - interval '24 hours'
    `,
    [customerId]
  )
  const rows = getRawRows<{ count?: string | number }>(result)
  const value = rows[0]?.count
  return typeof value === "number" ? value : asInteger(value, 0)
}

export async function listProductReviewsForAdmin({
  pgConnection,
  filters,
  page,
  pageSize,
}: {
  pgConnection: PgConnectionLike
  filters: ProductReviewAdminFilters
  page: number
  pageSize: number
}): Promise<ProductReviewListResult> {
  await ensureProductReviewsTables(pgConnection)

  const { page: safePage, pageSize: safePageSize } = clampPagination(
    page,
    pageSize
  )
  const offset = (safePage - 1) * safePageSize

  const conditions: string[] = []
  const bindings: unknown[] = []

  if (filters.status && isProductReviewStatus(filters.status)) {
    conditions.push("status = ?")
    bindings.push(filters.status)
  }
  if (filters.productId) {
    conditions.push("product_id = ?")
    bindings.push(filters.productId)
  }
  if (filters.dateFrom) {
    conditions.push("created_at >= ?::timestamptz")
    bindings.push(filters.dateFrom)
  }
  if (filters.dateTo) {
    conditions.push("created_at <= ?::timestamptz")
    bindings.push(filters.dateTo)
  }

  const whereSql = conditions.length
    ? `where ${conditions.join(" and ")}`
    : ""

  const listBindings = [...bindings, safePageSize, offset]
  const itemsResult = await pgConnection.raw<Record<string, unknown>>(
    `
      select *
      from product_review
      ${whereSql}
      order by created_at desc, id desc
      limit ?
      offset ?
    `,
    listBindings
  )
  const rows = getRawRows<Record<string, unknown>>(itemsResult)
  const items = rows.map((row) => normalizeReviewRow(row))

  const total = await countReviews(pgConnection, whereSql, bindings)

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
  }
}

export async function getProductReviewById({
  pgConnection,
  reviewId,
}: {
  pgConnection: PgConnectionLike
  reviewId: string
}): Promise<ProductReviewRow | null> {
  await ensureProductReviewsTables(pgConnection)

  const result = await pgConnection.raw<Record<string, unknown>>(
    `
      select *
      from product_review
      where id = ?
      limit 1
    `,
    [reviewId]
  )
  const rows = getRawRows<Record<string, unknown>>(result)
  return rows[0] ? normalizeReviewRow(rows[0]) : null
}

// ---------------------------------------------------------------------------
// 2.5 Helpful vote
// ---------------------------------------------------------------------------

export type ProductReviewHelpfulResult = {
  helpful_count: number
  already_voted: boolean
}

export async function voteProductReviewHelpful({
  pgConnection,
  reviewId,
  customerId,
}: {
  pgConnection: PgConnectionLike
  reviewId: string
  customerId: string
}): Promise<ProductReviewHelpfulResult> {
  await ensureProductReviewsTables(pgConnection)

  return await pgConnection.transaction(async (trx) => {
    const reviewResult = await trx.raw<Record<string, unknown>>(
      `
        select id, status, helpful_count
        from product_review
        where id = ?
      `,
      [reviewId]
    )
    const reviewRows = getRawRows<Record<string, unknown>>(reviewResult)
    if (!reviewRows.length || reviewRows[0]?.status !== "approved") {
      throw new ProductReviewError(
        "not_found_or_not_approved",
        "Review not found or is not approved"
      )
    }

    const insertResult = await trx.raw<Record<string, unknown>>(
      `
        insert into product_review_helpful (review_id, customer_id)
        values (?, ?)
        on conflict (review_id, customer_id) do nothing
      `,
      [reviewId, customerId]
    )
    const inserted = getRawRowCount(insertResult) === 1

    if (inserted) {
      const updateResult = await trx.raw<{ helpful_count?: number | string }>(
        `
          update product_review
          set helpful_count = helpful_count + 1,
              updated_at = now()
          where id = ?
          returning helpful_count
        `,
        [reviewId]
      )
      const updatedRows = getRawRows<{ helpful_count?: number | string }>(
        updateResult
      )
      const helpfulCount = asInteger(updatedRows[0]?.helpful_count, 0)
      return {
        helpful_count: helpfulCount,
        already_voted: false,
      }
    }

    const helpfulCount = asInteger(reviewRows[0]?.helpful_count, 0)
    return {
      helpful_count: helpfulCount,
      already_voted: true,
    }
  })
}

// ---------------------------------------------------------------------------
// 2.6 GDPR / cascade helpers
// ---------------------------------------------------------------------------

export type AnonymizeCustomerResult = {
  reviewsAnonymized: number
  helpfulVotesDeleted: number
}

export async function anonymizeCustomerInProductReviews({
  pgConnection,
  customerId,
}: {
  pgConnection: PgConnectionLike
  customerId: string
}): Promise<AnonymizeCustomerResult> {
  await ensureProductReviewsTables(pgConnection)

  const reviewsResult = await pgConnection.raw(
    `
      update product_review
      set customer_id = null,
          customer_name = ?,
          updated_at = now()
      where customer_id = ?
    `,
    [ANONYMIZED_CUSTOMER_NAME, customerId]
  )
  const reviewsAnonymized = getRawRowCount(reviewsResult)

  const helpfulResult = await pgConnection.raw(
    `
      delete from product_review_helpful
      where customer_id = ?
    `,
    [customerId]
  )
  const helpfulVotesDeleted = getRawRowCount(helpfulResult)

  // Intentionally no recalcProductRatingSummary call — anonymisation does not
  // change rating/status, so approved aggregates stay identical.
  return {
    reviewsAnonymized,
    helpfulVotesDeleted,
  }
}

export type DeleteAllProductReviewsForProductResult = {
  reviewsDeleted: number
}

export async function deleteAllProductReviewsForProduct({
  pgConnection,
  productId,
}: {
  pgConnection: PgConnectionLike
  productId: string
}): Promise<DeleteAllProductReviewsForProductResult> {
  await ensureProductReviewsTables(pgConnection)

  const reviewsResult = await pgConnection.raw(
    `
      delete from product_review
      where product_id = ?
    `,
    [productId]
  )
  const reviewsDeleted = getRawRowCount(reviewsResult)

  await pgConnection.raw(
    `
      delete from product_rating_summary
      where product_id = ?
    `,
    [productId]
  )

  return {
    reviewsDeleted,
  }
}
