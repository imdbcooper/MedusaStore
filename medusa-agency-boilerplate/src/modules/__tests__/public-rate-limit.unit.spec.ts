/**
 * Phase 5.4 unit tests for the shared `publicRateLimit` middleware.
 *
 * Contract covered:
 * - first N requests pass;
 * - request N+1 is rejected with HTTP 429, `code=rate_limited`, and a
 *   `Retry-After` header;
 * - independent `bucketKey` values stay independent;
 * - IPv4 and IPv6-mapped IPv4 collapse to the same bucket;
 * - window rollover admits the caller again once the clock passes `resetAt`.
 */

import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  __resetPublicRateLimitStoreForTests,
  evaluatePublicRateLimit,
  extractClientIp,
  publicRateLimit,
} from "../public-rate-limit"

function buildReq(overrides?: Partial<MedusaRequest>): MedusaRequest {
  return {
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...(overrides as object),
  } as MedusaRequest
}

function buildRes() {
  const status = jest.fn().mockReturnThis() as jest.Mock
  const json = jest.fn().mockReturnThis() as jest.Mock
  const setHeader = jest.fn().mockReturnThis() as jest.Mock
  const res = {
    status,
    json,
    setHeader,
  } as unknown as MedusaResponse
  return { res, status, json, setHeader }
}

describe("extractClientIp", () => {
  it("prefers the first entry of X-Forwarded-For", () => {
    const req = buildReq({
      headers: {
        "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2",
      },
    })
    expect(extractClientIp(req)).toBe("203.0.113.9")
  })

  it("falls back to X-Real-IP when X-Forwarded-For is missing", () => {
    const req = buildReq({
      headers: {
        "x-real-ip": "198.51.100.12",
      },
    })
    expect(extractClientIp(req)).toBe("198.51.100.12")
  })

  it("falls back to socket.remoteAddress when no forwarded headers exist", () => {
    const req = buildReq({
      headers: {},
      socket: { remoteAddress: "192.0.2.77" },
    } as Partial<MedusaRequest>)
    expect(extractClientIp(req)).toBe("192.0.2.77")
  })

  it("returns a stable fallback bucket when everything is missing", () => {
    const req = {
      headers: {},
    } as MedusaRequest
    expect(extractClientIp(req)).toBe("unknown")
  })
})

describe("evaluatePublicRateLimit", () => {
  it("allows the first N requests and limits the (N+1)th", () => {
    const store = new Map()
    const base = {
      bucketKey: "b",
      clientIp: "1.2.3.4",
      limit: 3,
      windowMs: 60_000,
      store,
    }

    expect(
      evaluatePublicRateLimit({ ...base, now: 1000 }).status
    ).toBe("allowed")
    expect(
      evaluatePublicRateLimit({ ...base, now: 1100 }).status
    ).toBe("allowed")
    expect(
      evaluatePublicRateLimit({ ...base, now: 1200 }).status
    ).toBe("allowed")

    const fourth = evaluatePublicRateLimit({ ...base, now: 1300 })
    expect(fourth.status).toBe("limited")
    if (fourth.status === "limited") {
      expect(fourth.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    }
  })

  it("resets once the window elapses", () => {
    const store = new Map()
    const base = {
      bucketKey: "b",
      clientIp: "1.2.3.4",
      limit: 1,
      windowMs: 60_000,
      store,
    }

    expect(
      evaluatePublicRateLimit({ ...base, now: 1000 }).status
    ).toBe("allowed")
    expect(
      evaluatePublicRateLimit({ ...base, now: 2000 }).status
    ).toBe("limited")
    expect(
      evaluatePublicRateLimit({ ...base, now: 70_000 }).status
    ).toBe("allowed")
  })

  it("keeps bucketKey values independent", () => {
    const store = new Map()
    const shared = { clientIp: "1.2.3.4", limit: 1, windowMs: 60_000, store }

    expect(
      evaluatePublicRateLimit({ ...shared, bucketKey: "a", now: 1 }).status
    ).toBe("allowed")
    expect(
      evaluatePublicRateLimit({ ...shared, bucketKey: "b", now: 2 }).status
    ).toBe("allowed")
    expect(
      evaluatePublicRateLimit({ ...shared, bucketKey: "a", now: 3 }).status
    ).toBe("limited")
  })

  it("keeps IPv4 and IPv6-mapped IPv4 in the same bucket", () => {
    const store = new Map()
    const base = {
      bucketKey: "b",
      limit: 1,
      windowMs: 60_000,
      store,
    }

    const plain = evaluatePublicRateLimit({
      ...base,
      clientIp: "203.0.113.9",
      now: 1,
    })
    const mapped = evaluatePublicRateLimit({
      ...base,
      clientIp: "::ffff:203.0.113.9",
      now: 2,
    })

    expect(plain.status).toBe("allowed")
    expect(mapped.status).toBe("limited")
  })

  it("treats different IPs as independent buckets", () => {
    const store = new Map()
    const base = {
      bucketKey: "b",
      limit: 1,
      windowMs: 60_000,
      store,
    }

    expect(
      evaluatePublicRateLimit({
        ...base,
        clientIp: "1.1.1.1",
        now: 1,
      }).status
    ).toBe("allowed")

    expect(
      evaluatePublicRateLimit({
        ...base,
        clientIp: "2.2.2.2",
        now: 2,
      }).status
    ).toBe("allowed")
  })
})

describe("publicRateLimit middleware", () => {
  beforeEach(() => {
    __resetPublicRateLimitStoreForTests()
  })

  it("calls next for allowed requests and 429s once limit exceeds", () => {
    const middleware = publicRateLimit({
      bucketKey: "vk-id-start-test-1",
      limit: 2,
      windowMs: 60_000,
    })

    const req = buildReq({
      headers: { "x-forwarded-for": "203.0.113.42" },
    })

    const next = jest.fn() as unknown as MedusaNextFunction

    const { res: res1 } = buildRes()
    middleware(req, res1, next)

    const { res: res2 } = buildRes()
    middleware(req, res2, next)

    const { res: res3, status, json, setHeader } = buildRes()
    middleware(req, res3, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(status).toHaveBeenCalledWith(429)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "rate_limited",
      })
    )
    expect(setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String))
  })

  it("keeps distinct client IPs independent", () => {
    const middleware = publicRateLimit({
      bucketKey: "vk-id-start-test-2",
      limit: 1,
      windowMs: 60_000,
    })

    const next = jest.fn() as unknown as MedusaNextFunction

    const reqA = buildReq({
      headers: { "x-forwarded-for": "203.0.113.1" },
    })
    const reqB = buildReq({
      headers: { "x-forwarded-for": "203.0.113.2" },
    })

    const { res: resA } = buildRes()
    const { res: resB } = buildRes()

    middleware(reqA, resA, next)
    middleware(reqB, resB, next)

    // Both first requests from two IPs should go through.
    expect(next).toHaveBeenCalledTimes(2)
  })

  it("rejects invalid options at factory time", () => {
    expect(() =>
      publicRateLimit({
        bucketKey: "",
        limit: 1,
        windowMs: 60_000,
      })
    ).toThrow(/bucketKey/)

    expect(() =>
      publicRateLimit({
        bucketKey: "x",
        limit: 0,
        windowMs: 60_000,
      })
    ).toThrow(/limit/)

    expect(() =>
      publicRateLimit({
        bucketKey: "x",
        limit: 1,
        windowMs: 100,
      })
    ).toThrow(/windowMs/)
  })
})
