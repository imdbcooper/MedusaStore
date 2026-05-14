/// <reference types="node" />

import assert from "node:assert/strict"
// @ts-ignore -- runtime uses Node 24 test runner via --experimental-strip-types
import test from "node:test"

import {
  ALLOWED_VK_PROXY_PARAMS,
  buildVkProxyBackendUrl,
  buildVkProxyErrorRedirectUrl,
  decideVkProxyOutcome,
} from "./vk-id-callback-proxy.ts"

test("buildVkProxyBackendUrl forwards only whitelisted params", () => {
  const incoming = new URLSearchParams({
    state: "abc",
    code: "vk_code",
    device_id: "dev1",
    // Disallowed pollutant from a misbehaving redirector — must be dropped.
    extra: "should-be-stripped",
  })

  const url = new URL(
    buildVkProxyBackendUrl({
      backendUrl: "https://studio.slavx.ru",
      incoming,
    })
  )

  assert.equal(url.host, "studio.slavx.ru")
  assert.equal(url.pathname, "/store/vk-id/callback")
  assert.equal(url.searchParams.get("state"), "abc")
  assert.equal(url.searchParams.get("code"), "vk_code")
  assert.equal(url.searchParams.get("device_id"), "dev1")
  assert.equal(url.searchParams.get("extra"), null)
})

test("buildVkProxyBackendUrl forwards VK error params for the cancel branch", () => {
  const incoming = new URLSearchParams({
    state: "abc",
    error: "access_denied",
    error_description: "User cancelled",
  })

  const url = new URL(
    buildVkProxyBackendUrl({
      backendUrl: "https://studio.slavx.ru/",
      incoming,
    })
  )

  assert.equal(url.searchParams.get("error"), "access_denied")
  assert.equal(url.searchParams.get("error_description"), "User cancelled")
  assert.equal(url.searchParams.get("code"), null)
})

test("buildVkProxyBackendUrl tolerates trailing slashes in the backend URL", () => {
  const url = new URL(
    buildVkProxyBackendUrl({
      backendUrl: "http://medusa-backend:9000///",
      incoming: new URLSearchParams({ state: "x", code: "y" }),
    })
  )

  assert.equal(url.origin, "http://medusa-backend:9000")
  assert.equal(url.pathname, "/store/vk-id/callback")
})

test("buildVkProxyBackendUrl drops empty-string params", () => {
  const incoming = new URLSearchParams()
  incoming.set("state", "abc")
  // VK occasionally appends `?error=&error_description=` on cancellation
  // edge cases. Empty values must not pollute the upstream URL.
  incoming.set("code", "")
  incoming.set("error", "")

  const url = new URL(
    buildVkProxyBackendUrl({
      backendUrl: "https://studio.slavx.ru",
      incoming,
    })
  )

  assert.equal(url.searchParams.get("state"), "abc")
  assert.equal(url.searchParams.get("code"), null)
  assert.equal(url.searchParams.get("error"), null)
})

test("buildVkProxyErrorRedirectUrl points at /ru/account with vk_login_error", () => {
  const result = new URL(
    buildVkProxyErrorRedirectUrl({
      storefrontBaseUrl: "https://studio.slavx.ru/",
      reason: "vk_id_callback_failed",
    })
  )

  assert.equal(result.host, "studio.slavx.ru")
  assert.equal(result.pathname, "/ru/account")
  assert.equal(result.searchParams.get("vk_login_error"), "vk_id_callback_failed")
})

test("decideVkProxyOutcome accepts 302 with Location", () => {
  const outcome = decideVkProxyOutcome({
    status: 302,
    location: "https://studio.slavx.ru/ru/account?vk_id_result=linked",
  })

  assert.deepEqual(outcome, {
    kind: "redirect",
    location: "https://studio.slavx.ru/ru/account?vk_id_result=linked",
    status: 302,
  })
})

test("decideVkProxyOutcome accepts 303 with Location", () => {
  const outcome = decideVkProxyOutcome({
    status: 303,
    location: "https://studio.slavx.ru/ru/account",
  })

  assert.equal(outcome.kind, "redirect")
  if (outcome.kind === "redirect") {
    assert.equal(outcome.status, 303)
  }
})

test("decideVkProxyOutcome rejects non-redirect statuses", () => {
  assert.deepEqual(
    decideVkProxyOutcome({ status: 200, location: "ignored" }),
    { kind: "unexpected" }
  )
  assert.deepEqual(
    decideVkProxyOutcome({ status: 500, location: null }),
    { kind: "unexpected" }
  )
})

test("decideVkProxyOutcome rejects redirect status without Location", () => {
  assert.deepEqual(
    decideVkProxyOutcome({ status: 302, location: null }),
    { kind: "unexpected" }
  )
  assert.deepEqual(
    decideVkProxyOutcome({ status: 302, location: "" }),
    { kind: "unexpected" }
  )
})

test("ALLOWED_VK_PROXY_PARAMS is the contract used everywhere", () => {
  // Guard against accidental contract drift: the route handler imports the
  // same constant, and any change here is a real breaking change.
  assert.deepEqual(
    [...ALLOWED_VK_PROXY_PARAMS].sort(),
    ["code", "device_id", "error", "error_description", "state"]
  )
})
