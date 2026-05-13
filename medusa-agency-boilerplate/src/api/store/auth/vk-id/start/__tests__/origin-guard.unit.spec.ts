/**
 * Unit tests for the VK ID start-endpoint Origin/Referer allowlist guard.
 *
 * Covers:
 *   - Exact Origin match against VK_ID_STOREFRONT_RETURN_ORIGINS
 *   - Referer fallback when Origin is missing
 *   - Reject requests with no Origin and no Referer
 *   - Reject requests whose Origin/Referer does not belong to the allowlist
 *   - Reject when no allowlist is configured at all (fail-closed)
 *   - STORE_CORS fallback mirrors `getAllowedStorefrontOrigins` semantics
 *   - NODE_ENV=development local-storefront fallback
 */

import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  enforceVkIdStartOriginAllowlist,
  evaluateVkIdRequestOrigin,
  getVkIdAllowedRequestOrigins,
} from "../origin-guard"

type StatusJson = { status: number; body: unknown }

function buildRes() {
  const captured: Partial<StatusJson> = {}
  const res: any = {
    status: jest.fn(function (this: any, code: number) {
      captured.status = code
      return this
    }),
    json: jest.fn(function (this: any, body: unknown) {
      captured.body = body
      return this
    }),
  }
  return { res, captured }
}

function buildReq(headers: Record<string, string | undefined>) {
  return {
    headers: Object.fromEntries(
      Object.entries(headers).filter(([, v]) => v !== undefined)
    ),
  } as any
}

describe("evaluateVkIdRequestOrigin (pure helper)", () => {
  it("allows Origin header when it belongs to the allowlist", () => {
    const result = evaluateVkIdRequestOrigin({
      originHeader: "https://studio.slavx.ru",
      refererHeader: null,
      allowlist: ["https://studio.slavx.ru"],
    })
    expect(result.status).toBe("allowed")
    if (result.status === "allowed") {
      expect(result.source).toBe("origin")
      expect(result.origin).toBe("https://studio.slavx.ru")
    }
  })

  it("falls back to Referer when Origin is missing", () => {
    const result = evaluateVkIdRequestOrigin({
      originHeader: null,
      refererHeader: "https://studio.slavx.ru/ru/account?x=1",
      allowlist: ["https://studio.slavx.ru"],
    })
    expect(result.status).toBe("allowed")
    if (result.status === "allowed") {
      expect(result.source).toBe("referer")
    }
  })

  it("rejects when Origin points to an attacker site", () => {
    const result = evaluateVkIdRequestOrigin({
      originHeader: "https://attacker.example.com",
      refererHeader: "https://studio.slavx.ru/ru/account",
      allowlist: ["https://studio.slavx.ru"],
    })
    // Origin takes precedence even if Referer would be allowed.
    expect(result.status).toBe("unknown_origin")
  })

  it("rejects when both headers are missing", () => {
    const result = evaluateVkIdRequestOrigin({
      originHeader: null,
      refererHeader: null,
      allowlist: ["https://studio.slavx.ru"],
    })
    expect(result.status).toBe("missing_origin")
  })

  it("fails closed when the allowlist is empty", () => {
    const result = evaluateVkIdRequestOrigin({
      originHeader: "https://studio.slavx.ru",
      refererHeader: null,
      allowlist: [],
    })
    expect(result.status).toBe("no_allowlist")
  })
})

describe("getVkIdAllowedRequestOrigins env resolution", () => {
  const ORIGINAL_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("uses VK_ID_STOREFRONT_RETURN_ORIGINS when present", () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS =
      "https://studio.slavx.ru,https://preview.slavx.ru"
    expect(getVkIdAllowedRequestOrigins()).toEqual([
      "https://studio.slavx.ru",
      "https://preview.slavx.ru",
    ])
  })

  it("falls back to the first STORE_CORS entry when RETURN_ORIGINS is unset", () => {
    delete process.env.VK_ID_STOREFRONT_RETURN_ORIGINS
    process.env.STORE_CORS = "https://studio.slavx.ru,https://staging.slavx.ru"
    expect(getVkIdAllowedRequestOrigins()).toEqual([
      "https://studio.slavx.ru",
    ])
  })

  it("falls back to localhost:8000 only in dev/test NODE_ENV", () => {
    delete process.env.VK_ID_STOREFRONT_RETURN_ORIGINS
    delete process.env.STORE_CORS
    process.env.NODE_ENV = "development"
    expect(getVkIdAllowedRequestOrigins()).toEqual(["http://localhost:8000"])
  })

  it("returns empty list (fail-closed) when production has no explicit origins", () => {
    delete process.env.VK_ID_STOREFRONT_RETURN_ORIGINS
    delete process.env.STORE_CORS
    process.env.NODE_ENV = "production"
    expect(getVkIdAllowedRequestOrigins()).toEqual([])
  })
})

describe("enforceVkIdStartOriginAllowlist middleware", () => {
  const ORIGINAL_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("calls next() for allowed Origin", async () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS = "https://studio.slavx.ru"
    const { res, captured } = buildRes()
    const next = jest.fn()

    await enforceVkIdStartOriginAllowlist(
      buildReq({ origin: "https://studio.slavx.ru" }),
      res,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(captured.status).toBeUndefined()
  })

  it("returns 403 vk_id_origin_not_allowed for unknown Origin", async () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS = "https://studio.slavx.ru"
    const { res, captured } = buildRes()
    const next = jest.fn()

    await enforceVkIdStartOriginAllowlist(
      buildReq({ origin: "https://attacker.example.com" }),
      res,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(captured.status).toBe(403)
    expect(captured.body).toEqual({
      ok: false,
      code: "vk_id_origin_not_allowed",
    })
  })

  it("returns 403 vk_id_origin_not_allowed when Origin and Referer are both missing", async () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS = "https://studio.slavx.ru"
    const { res, captured } = buildRes()
    const next = jest.fn()

    await enforceVkIdStartOriginAllowlist(buildReq({}), res, next)

    expect(next).not.toHaveBeenCalled()
    expect(captured.status).toBe(403)
  })

  it("returns 403 vk_id_return_origin_unconfigured when no allowlist is available", async () => {
    delete process.env.VK_ID_STOREFRONT_RETURN_ORIGINS
    delete process.env.STORE_CORS
    process.env.NODE_ENV = "production"
    const { res, captured } = buildRes()
    const next = jest.fn()

    await enforceVkIdStartOriginAllowlist(
      buildReq({ origin: "https://studio.slavx.ru" }),
      res,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(captured.status).toBe(403)
    expect(captured.body).toEqual({
      ok: false,
      code: "vk_id_return_origin_unconfigured",
    })
  })

  it("accepts Referer when Origin header is absent", async () => {
    process.env.VK_ID_STOREFRONT_RETURN_ORIGINS = "https://studio.slavx.ru"
    const { res, captured } = buildRes()
    const next = jest.fn()

    await enforceVkIdStartOriginAllowlist(
      buildReq({ referer: "https://studio.slavx.ru/ru/account" }),
      res,
      next
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(captured.status).toBeUndefined()
  })
})
