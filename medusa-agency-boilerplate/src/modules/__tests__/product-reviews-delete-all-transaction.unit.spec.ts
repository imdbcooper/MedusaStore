/**
 * Phase 3 / step 5 hotfix (P1.3) — unit tests for the transaction wrap
 * inside
 * [`deleteAllProductReviewsForProduct`](medusa-agency-boilerplate/src/modules/product-reviews.ts:1).
 *
 * The function previously ran SELECT images / DELETE product_review /
 * DELETE product_rating_summary as three independent statements on the
 * top-level connection. After the fix all three statements are issued
 * inside `pgConnection.transaction(async (trx) => {...})` — same style
 * as `deleteProductReviewAsAdmin`. The S3 cleanup is intentionally
 * performed AFTER the transaction commits.
 *
 * These tests use a hand-written fake `PgConnectionLike` that records
 * which statements ran on the trx vs. the top-level connection. They do
 * NOT touch real Postgres — same convention as
 * [`product-reviews-images-cleanup.unit.spec.ts`](medusa-agency-boilerplate/src/modules/__tests__/product-reviews-images-cleanup.unit.spec.ts:1).
 */

import { describe, expect, it, jest } from "@jest/globals"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { deleteAllProductReviewsForProduct } from "../product-reviews"

type RecordedStatement = {
  sql: string
  bindings?: unknown[]
  executor: "trx" | "connection"
}

function buildFakePgConnection(opts: {
  imagesRows?: Array<{ images: unknown }>
  reviewsDeletedCount?: number
}) {
  const recorded: RecordedStatement[] = []
  let trxRan = false
  let trxCommitted = false

  const trx = {
    raw: jest.fn(async (sql: string, bindings?: unknown[]) => {
      recorded.push({ sql, bindings, executor: "trx" })
      const lower = sql.toLowerCase()
      if (lower.includes("select images")) {
        return { rows: opts.imagesRows ?? [] }
      }
      if (
        lower.includes("delete from product_review") &&
        !lower.includes("rating_summary")
      ) {
        return { rowCount: opts.reviewsDeletedCount ?? 0, rows: [] }
      }
      if (lower.includes("delete from product_rating_summary")) {
        return { rowCount: 1, rows: [] }
      }
      if (lower.includes("create table") || lower.includes("create index")) {
        return { rowCount: 0, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    }),
  }

  const connection = {
    transaction: jest.fn(async (cb: any) => {
      trxRan = true
      const out = await cb(trx)
      trxCommitted = true
      return out
    }),
    raw: jest.fn(async (sql: string, bindings?: unknown[]) => {
      recorded.push({ sql, bindings, executor: "connection" })
      // Schema bootstrap (`ensureProductReviewsTables`) and any other
      // top-level call. We respond with an empty rowset.
      return { rowCount: 0, rows: [] }
    }),
  }

  return {
    connection,
    trx,
    recorded,
    trxRan: () => trxRan,
    trxCommitted: () => trxCommitted,
  }
}

function buildContainer(impl?: {
  deleteFiles?: (ids: string[]) => Promise<void>
}) {
  const fileService = {
    createFiles: jest.fn<any>(async () => ({ id: "x", url: "x" })),
    deleteFiles: impl?.deleteFiles
      ? jest.fn(impl.deleteFiles as any)
      : jest.fn<any>(async () => {}),
  }
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
  const container = {
    resolve: jest.fn((key: any) => {
      if (key === Modules.FILE) {
        return fileService
      }
      if (key === ContainerRegistrationKeys.LOGGER) {
        return logger
      }
      return undefined
    }),
  }
  return { container, fileService, logger }
}

describe("deleteAllProductReviewsForProduct — transaction wrap (P1.3)", () => {
  it("issues SELECT images / DELETE product_review / DELETE product_rating_summary inside pgConnection.transaction", async () => {
    const { connection, recorded, trxRan, trxCommitted } = buildFakePgConnection({
      imagesRows: [
        { images: [{ id: "id_a", url: "https://cdn/a.jpg" }] },
      ],
      reviewsDeletedCount: 1,
    })
    const { container } = buildContainer()

    const result = await deleteAllProductReviewsForProduct({
      pgConnection: connection as any,
      productId: "prod_1",
      container,
    })

    expect(connection.transaction).toHaveBeenCalledTimes(1)
    expect(trxRan()).toBe(true)
    expect(trxCommitted()).toBe(true)

    // All three core statements must have been issued through `trx`,
    // not the top-level connection.
    const trxStatements = recorded
      .filter((r) => r.executor === "trx")
      .map((r) => r.sql.toLowerCase())

    expect(trxStatements.some((s) => s.includes("select images"))).toBe(true)
    expect(
      trxStatements.some(
        (s) =>
          s.includes("delete from product_review") &&
          !s.includes("rating_summary")
      )
    ).toBe(true)
    expect(
      trxStatements.some((s) =>
        s.includes("delete from product_rating_summary")
      )
    ).toBe(true)

    // None of those three statements should leak onto the top-level
    // connection. (Schema bootstrap is allowed to run there.)
    const connectionStatements = recorded
      .filter((r) => r.executor === "connection")
      .map((r) => r.sql.toLowerCase())
    expect(
      connectionStatements.some(
        (s) =>
          s.includes("delete from product_review") &&
          !s.includes("rating_summary")
      )
    ).toBe(false)
    expect(
      connectionStatements.some((s) =>
        s.includes("delete from product_rating_summary")
      )
    ).toBe(false)

    expect(result.reviewsDeleted).toBe(1)
    // Image cleanup ran best-effort AFTER tx commit.
    expect(result.imagesCleanup).toEqual({
      ok: true,
      attempted: 1,
      deleted: 1,
    })
  })

  it("does not collect images when no container is supplied (cascade still runs in tx)", async () => {
    const { connection, recorded } = buildFakePgConnection({
      reviewsDeletedCount: 2,
    })

    const result = await deleteAllProductReviewsForProduct({
      pgConnection: connection as any,
      productId: "prod_2",
    })

    expect(connection.transaction).toHaveBeenCalledTimes(1)
    expect(result.reviewsDeleted).toBe(2)
    expect(result.imagesCleanup).toBeNull()

    const trxStatements = recorded
      .filter((r) => r.executor === "trx")
      .map((r) => r.sql.toLowerCase())
    // SELECT images is skipped without a container.
    expect(trxStatements.some((s) => s.includes("select images"))).toBe(false)
    // But the two DELETEs still execute inside trx.
    expect(
      trxStatements.some(
        (s) =>
          s.includes("delete from product_review") &&
          !s.includes("rating_summary")
      )
    ).toBe(true)
    expect(
      trxStatements.some((s) =>
        s.includes("delete from product_rating_summary")
      )
    ).toBe(true)
  })

  it("S3 cleanup runs strictly AFTER the DB transaction has committed", async () => {
    let deleteFilesCalledAt: number | null = null
    let trxFinishedAt: number | null = null

    const recorded: string[] = []
    const trx = {
      raw: jest.fn(async (sql: string) => {
        recorded.push(`trx:${sql.toLowerCase().split("\n")[1]?.trim() ?? ""}`)
        if (sql.toLowerCase().includes("select images")) {
          return {
            rows: [{ images: [{ id: "id_a", url: "https://cdn/a.jpg" }] }],
          }
        }
        return { rowCount: 1, rows: [] }
      }),
    }
    const connection = {
      transaction: jest.fn(async (cb: any) => {
        const out = await cb(trx)
        trxFinishedAt = Date.now()
        // Tiny delay to make ordering observable.
        await new Promise((r) => setTimeout(r, 1))
        return out
      }),
      raw: jest.fn(async () => ({ rowCount: 0, rows: [] })),
    }

    const fileService = {
      createFiles: jest.fn<any>(async () => ({ id: "x", url: "x" })),
      deleteFiles: jest.fn<any>(async () => {
        deleteFilesCalledAt = Date.now()
      }),
    }
    const container = {
      resolve: jest.fn((key: any) => {
        if (key === Modules.FILE) return fileService
        return undefined
      }),
    }

    await deleteAllProductReviewsForProduct({
      pgConnection: connection as any,
      productId: "prod_x",
      container,
    })

    expect(trxFinishedAt).not.toBeNull()
    expect(deleteFilesCalledAt).not.toBeNull()
    expect(deleteFilesCalledAt!).toBeGreaterThanOrEqual(trxFinishedAt!)
  })
})
