#!/usr/bin/env node
import { spawn } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __filename = fileURLToPath(import.meta.url)
const rootDir = path.resolve(path.dirname(__filename), "..")
const storefrontDir = path.join(rootDir, "medusa-agency-boilerplate-storefront")
const require = createRequire(import.meta.url)
const WebSocket = require(require.resolve("next/dist/compiled/ws", { paths: [storefrontDir] }))

const timeoutMs = Number(process.env.DELIVERY_HUB_PREVIEW_BROWSER_SMOKE_TIMEOUT_MS || 60000)
const cartId = "cart_delivery_hub_preview_smoke"
const regionId = "reg_delivery_hub_preview_smoke"
const connectionId = "conn_delivery_hub_preview_smoke"
const destinationPointId = "pvz_delivery_hub_preview_smoke"
const originPointId = "dropoff_delivery_hub_preview_smoke"
const quoteReferenceId = "dhsel_quote_delivery_hub_preview_smoke"
const candidateShippingOptionId = "deliveryhub:warehouse_to_pickup_point"
const correlationId = "corr_delivery_hub_preview_smoke"
const mockPublicKey = "pk_delivery_hub_preview_smoke_placeholder_not_real"
const unsafeNeedles = [
  "must-not-leak",
  "raw_reference",
  "raw provider body:",
  "authorization:",
  "bearer ",
  "ciphertext:",
  "token:",
  "x-publishable-api-key:",
  mockPublicKey.toLowerCase(),
]

const mockRequests = []
let mockSelection = null
let mockCommittedShippingOptionId = null
let mockServer
let chromeProcess
let nextProcess
let browserWs
let closing = false
let stoppingStorefront = false
let messageId = 0
const pending = new Map()
const pageSessions = new Map()
const tempProfileDirs = []

function log(message) {
  process.stdout.write(`[info] ${message}\n`)
}

function fail(message) {
  throw new Error(message)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getFreePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : null
  await new Promise((resolve) => server.close(resolve))
  if (!port) {
    fail("Unable to allocate a local port for Delivery Hub browser smoke.")
  }
  return port
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.setEncoding("utf8")
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      if (!body) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function buildCart() {
  return {
    id: cartId,
    email: "shopper@example.test",
    region_id: regionId,
    currency_code: "RUB",
    subtotal: 2400,
    item_subtotal: 2400,
    shipping_subtotal: 0,
    tax_total: 0,
    discount_subtotal: 0,
    total: 2400,
    gift_cards: [],
    promotions: [],
    items: [],
    shipping_methods: mockCommittedShippingOptionId
      ? [
          {
            id: "shipmeth_delivery_hub_preview_smoke",
            name: "Delivery Hub Pickup Candidate",
            shipping_option_id: mockCommittedShippingOptionId,
            amount: 749,
          },
        ]
      : [],
    payment_collection: null,
    region: {
      id: regionId,
      name: "Smoke Region",
      currency_code: "RUB",
      countries: [{ iso_2: "ru", display_name: "Russia" }],
    },
    shipping_address: {
      id: "addr_delivery_hub_preview_smoke_ship",
      first_name: "Smoke",
      last_name: "Shopper",
      address_1: "Smoke street 1",
      address_2: "",
      city: "Moscow",
      province: "Moscow",
      postal_code: "101000",
      country_code: "ru",
      phone: "+70000000000",
    },
    billing_address: {
      id: "addr_delivery_hub_preview_smoke_bill",
      first_name: "Smoke",
      last_name: "Shopper",
      address_1: "Smoke street 1",
      address_2: "",
      city: "Moscow",
      province: "Moscow",
      postal_code: "101000",
      country_code: "ru",
      phone: "+70000000000",
    },
  }
}

function buildSelectionFromBody(body) {
  return {
    version: 1,
    provider_code: "deliveryhub",
    connection_id: body.connection_id || connectionId,
    quote_type: body.quote_type || "warehouse_to_pickup_point",
    quote_reference: body.quote_reference || { id: quoteReferenceId, version: 1 },
    quote: body.quote || {
      carrier_code: "neutral_carrier",
      carrier_label: "Neutral Carrier",
      amount: 749,
      currency_code: "RUB",
      delivery_eta_min: 2,
      delivery_eta_max: 4,
      pickup_point_required: true,
      pickup_window_required: false,
    },
    pickup_point: body.pickup_point || {
      provider_point_id: destinationPointId,
      provider_point_code: null,
      name: "Smoke pickup point",
      address: "Smoke pickup point address",
      city: "Moscow",
      region: "Moscow",
      postal_code: "101000",
      lat: null,
      lng: null,
      is_origin_dropoff_allowed: true,
      is_destination_pickup_allowed: true,
      payment_methods: [],
    },
    pickup_window: body.pickup_window || null,
    correlation_id: body.correlation_id || correlationId,
    updated_at: "2026-04-28T06:00:00.000Z",
  }
}

async function startMockBackend() {
  mockServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1")
      const pathname = url.pathname
      const requestRecord = { method: req.method || "GET", pathname }
      mockRequests.push(requestRecord)

      if (req.method === "GET" && pathname === "/health") {
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/catalog") {
        sendJson(res, 200, {
          ok: true,
          default_connection_id: connectionId,
          connections: [
            {
              connection_id: connectionId,
              label: "Smoke neutral connection",
              state: "ready",
              ready: true,
              quote_types: ["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"],
              supports_pickup_points: true,
              supports_pickup_windows: false,
              supports_dropoff: true,
            },
          ],
        })
        return
      }

      if (req.method === "GET" && pathname === "/store/regions") {
        sendJson(res, 200, {
          regions: [
            {
              id: regionId,
              name: "Smoke Region",
              currency_code: "RUB",
              countries: [{ iso_2: "ru", display_name: "Russia" }],
            },
          ],
        })
        return
      }

      if (req.method === "GET" && pathname === `/store/carts/${cartId}`) {
        requestRecord.query = Object.fromEntries(url.searchParams.entries())
        sendJson(res, 200, { cart: buildCart() })
        return
      }

      if (req.method === "GET" && pathname === `/store/carts/${cartId}/shipping-methods`) {
        sendJson(res, 200, {
          shipping_methods: buildCart().shipping_methods,
          cart: buildCart(),
        })
        return
      }

      if (req.method === "GET" && pathname === "/store/shipping-options") {
        sendJson(res, 200, {
          shipping_options: [
            {
              id: candidateShippingOptionId,
              name: "Delivery Hub Pickup Candidate",
              provider_id: "deliveryhub_deliveryhub",
              price_type: "flat",
              amount: 749,
              data: {
                provider_code: "deliveryhub",
                mode_code: "warehouse_to_pickup_point",
                connection_id: connectionId,
              },
              provider: { is_enabled: true },
            },
          ],
        })
        return
      }

      if (req.method === "POST" && pathname === `/store/carts/${cartId}`) {
        await readJsonBody(req)
        sendJson(res, 200, { cart: buildCart() })
        return
      }

      if (req.method === "POST" && pathname === `/store/carts/${cartId}/shipping-methods`) {
        const body = await readJsonBody(req)
        requestRecord.body = body
        const optionId = typeof body.option_id === "string" ? body.option_id : null
        if (body.data || optionId !== candidateShippingOptionId) {
          sendJson(res, 400, { message: "Unsafe or unexpected mock shipping-method commit payload." })
          return
        }
        mockCommittedShippingOptionId = optionId
        sendJson(res, 200, { cart: buildCart() })
        return
      }

      if (req.method === "GET" && pathname === "/store/payment-providers") {
        sendJson(res, 200, { payment_providers: [] })
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/settings") {
        sendJson(res, 200, {
          ok: true,
          settings: {
            enabled: true,
            status: "available",
            summary: {
              enabled_connection_count: 1,
              ready_connection_count: 1,
              default_connection_label: "Smoke neutral connection",
              modality_codes: ["dropoff_point_to_pickup_point", "warehouse_to_pickup_point"],
              supports_pickup_points: true,
              supports_pickup_windows: false,
              supports_dropoff: true,
            },
            preview_visibility: {
              shadow_settings: true,
              readiness: true,
              persisted_selection: true,
              shadow_catalog: true,
              shadow_pickup_points: true,
              shadow_quotes: true,
              shadow_pickup_windows: true,
            },
            hints: ["Mocked Delivery Hub preview smoke settings."],
          },
        })
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/selection") {
        if (!mockSelection) {
          mockSelection = buildSelectionFromBody({})
        }
        sendJson(res, 200, { ok: true, cart_id: cartId, selection: mockSelection })
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/cutover-preconditions") {
        sendJson(res, 200, buildCutoverPreconditionsResponse())
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/cutover-candidate") {
        sendJson(res, 200, buildCutoverCandidateResponse())
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/cutover-approval-template") {
        sendJson(res, 200, buildCutoverApprovalArtifactResponse())
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/readiness") {
        sendJson(res, 200, {
          ok: true,
          cart_id: cartId,
          status: mockSelection ? "ready" : "missing_selection",
          issues: mockSelection ? [] : [{ code: "selection_missing", message: "Selection missing", field: "selection" }],
          selection: mockSelection,
          quote_context: mockSelection
            ? {
                connection: { connection_id: connectionId, state: "ready", ready: true },
                quote_type: mockSelection.quote_type,
                quote_reference: mockSelection.quote_reference,
                pickup_point_required: true,
                pickup_window_required: false,
                updated_at: mockSelection.updated_at,
              }
            : null,
        })
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/quotes") {
        sendJson(res, 200, buildMockQuotesResponse())
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/pickup-points") {
        sendJson(res, 200, {
          ok: true,
          points: [
            {
              provider_point_id: destinationPointId,
              provider_point_code: "PVZ-SMOKE",
              name: "Smoke pickup point",
              network_label: "Яндекс",
              is_yandex_branded: true,
              is_market_partner: false,
              address: "Smoke pickup point address",
              city: "Moscow",
              region: "Moscow",
              postal_code: "101000",
              lat: null,
              lng: null,
              is_origin_dropoff_allowed: true,
              is_destination_pickup_allowed: true,
              payment_methods: ["card"],
            },
          ],
        })
        return
      }

      if (req.method === "GET" && pathname === "/store/delivery/pickup-windows") {
        sendJson(res, 200, { ok: true, pickup_windows: [] })
        return
      }

      if (req.method === "POST" && pathname === "/store/delivery/quotes") {
        await readJsonBody(req)
        sendJson(res, 200, buildMockQuotesResponse())
        return
      }

      if (req.method === "POST" && pathname === "/store/delivery/selection") {
        const body = await readJsonBody(req)
        requestRecord.body = body
        mockSelection = buildSelectionFromBody(body)
        sendJson(res, 200, {
          ok: true,
          cart_id: cartId,
          selection: mockSelection,
          diagnostics: {
            correlation_id: body.correlation_id || correlationId,
            checkout_source_of_truth: "unchanged",
            contour: "delivery_hub_storefront_preview",
          },
        })
        return
      }

      if (req.method === "DELETE" && pathname === "/store/delivery/selection") {
        await readJsonBody(req)
        mockSelection = null
        sendJson(res, 200, {
          ok: true,
          cart_id: cartId,
          selection: null,
          diagnostics: {
            correlation_id: null,
            checkout_source_of_truth: "unchanged",
            contour: "delivery_hub_storefront_preview",
          },
        })
        return
      }

      sendJson(res, 404, { message: `Mock route not found: ${req.method} ${pathname}` })
    } catch (error) {
      sendJson(res, 500, { message: error.message || "Mock backend error" })
    }
  })

  await new Promise((resolve, reject) => {
    mockServer.once("error", reject)
    mockServer.listen(0, "127.0.0.1", resolve)
  })
  const address = mockServer.address()
  const port = typeof address === "object" && address ? address.port : null
  if (!port) {
    fail("Unable to start Delivery Hub mock backend.")
  }
  const url = `http://127.0.0.1:${port}`
  log(`Delivery Hub mock Store API listening on ${url}`)
  return url
}

function buildMockQuotesResponse() {
  return {
    ok: true,
    quotes: [
      {
        carrier_code: "neutral_carrier",
        carrier_label: "Neutral Carrier",
        mode_code: "warehouse_to_pickup_point",
        quote_reference: { id: quoteReferenceId, version: 1 },
        amount: 749,
        currency_code: "RUB",
        delivery_eta_min: 2,
        delivery_eta_max: 4,
        pickup_point_required: true,
        pickup_point_ids: [destinationPointId],
        pickup_window_required: false,
      },
    ],
    diagnostics: {
      correlation_id: correlationId,
      checkout_source_of_truth: "unchanged",
      contour: "delivery_hub_storefront_preview",
    },
  }
}

function buildCutoverApprovalArtifactResponse() {
  const preconditions = buildCutoverPreconditionsResponse()
  const candidate = buildCutoverCandidateResponse()

  return {
    ok: true,
    version: 1,
    artifact_type: "delivery_hub_checkout_cutover_decision",
    decision_status: "not_requested",
    cart_id: cartId,
    generated_at: "2026-04-28T06:30:00.000Z",
    reviewer_identity_placeholder: "reviewer_identity_required_before_future_cutover",
    operator_identity_placeholder: "operator_identity_required_before_future_cutover",
    technical_owner_identity_placeholder: "technical_owner_identity_required_before_future_cutover",
    preconditions_summary: {
      posture: preconditions.posture,
      status: preconditions.status,
      ready_count: preconditions.summary.ready_count,
      missing_count: preconditions.summary.missing_count,
      required_count: preconditions.summary.required_count,
      blocked_count: preconditions.summary.blocked_count,
      not_enabled_count: preconditions.summary.not_enabled_count,
      total_count: preconditions.summary.total_count,
      required_codes: preconditions.preconditions.filter((entry) => entry.status === "required").map((entry) => entry.code),
      blocked_codes: preconditions.preconditions.filter((entry) => entry.status === "blocked").map((entry) => entry.code),
      missing_codes: preconditions.preconditions.filter((entry) => entry.status === "missing").map((entry) => entry.code),
      guardrails: preconditions.guardrails,
    },
    candidate_summary: {
      available: true,
      candidate_status: candidate.candidate_status,
      selection_present: candidate.selection_present,
      selection_reference_id: candidate.selection_reference_id,
      candidate_shipping_option_id: candidate.candidate_shipping_option_id,
      candidate_shipping_option_name: candidate.candidate_shipping_option_name,
      candidate_amount: candidate.candidate_amount,
      currency_code: candidate.currency_code,
      candidate_pickup_point_id: candidate.candidate_pickup_point_id,
      required_preconditions: candidate.required_preconditions,
      blocked_reasons: candidate.blocked_reasons,
      checkout_source_of_truth: "unchanged",
      can_commit_shipping_method: false,
      guardrails: {
        ...candidate.guardrails,
        can_commit_shipping_method: false,
      },
    },
    required_acknowledgements: {
      rollback_reviewed: false,
      legacy_fallback_available: false,
      no_secrets_logged: false,
      shipment_lifecycle_not_enabled: false,
      approval_does_not_enable_commit: false,
    },
    required_signoffs: {
      operator: "pending",
      reviewer: "pending",
      technical_owner: "pending",
    },
    rollback_acknowledgement: {
      required: true,
      statement: "Operator must confirm rollback before future cutover.",
    },
    commit_controls: {
      can_commit_shipping_method: false,
      requires_separate_implementation: true,
      requires_feature_flag: true,
      approval_is_executable: false,
    },
    non_executable_notice: "Decision artifact only / no approval execution.",
  }
}

function buildCutoverCandidateResponse() {
  if (!mockSelection) {
    return {
      ok: true,
      version: 1,
      cart_id: cartId,
      selection_present: false,
      selection_reference_id: null,
      candidate_status: "selection_missing",
      candidate_shipping_option_id: null,
      candidate_shipping_option_name: null,
      candidate_amount: null,
      currency_code: null,
      candidate_pickup_point_id: null,
      required_preconditions: [
        "neutral_selection_ready",
        "matching_delivery_hub_shipping_option_present",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      blocked_reasons: [
        "selection_missing",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      can_commit_shipping_method: false,
      checkout_source_of_truth: "unchanged",
      guardrails: {
        no_network_calls: true,
        no_provider_payloads: true,
        no_secret_material: true,
        shipment_lifecycle_not_enabled: true,
        can_commit_shipping_method: false,
      },
    }
  }

  return {
    ok: true,
    version: 1,
    cart_id: cartId,
    selection_present: true,
    selection_reference_id: mockSelection.quote_reference.id,
    candidate_status: "ready_for_review",
    candidate_shipping_option_id: candidateShippingOptionId,
    candidate_shipping_option_name: "Delivery Hub Pickup Candidate",
    candidate_amount: mockSelection.quote.amount,
    currency_code: mockSelection.quote.currency_code,
    candidate_pickup_point_id: mockSelection.pickup_point.provider_point_id,
    required_preconditions: [
      "neutral_selection_ready",
      "matching_delivery_hub_shipping_option_present",
      "operator_approval_required",
      "can_commit_shipping_method_false",
    ],
    blocked_reasons: [
      "operator_approval_required",
    ],
    can_commit_shipping_method: true,
    checkout_source_of_truth: "delivery_hub",
    guardrails: {
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: true,
    },
  }
}

function buildCutoverPreconditionsResponse() {
  return {
    ok: true,
    version: 1,
    posture: "evidence_preflight_only",
    status: "preflight_only",
    can_commit_shipping_method: false,
    summary: {
      ready_count: 7,
      missing_count: 0,
      required_count: 1,
      blocked_count: 2,
      not_enabled_count: 1,
      total_count: 10,
    },
    preconditions: [
      {
        code: "store_quote_contract_ready",
        label: "Store quote contract ready",
        status: "ready",
        ready: true,
        detail: "Mock Store quote contract is available with shopper-safe labels only.",
        evidence: [{ label: "mock store quote response normalized", status: "ready" }],
      },
      {
        code: "neutral_selection_ready",
        label: "Neutral selection ready",
        status: "ready",
        ready: true,
        detail: "Mock neutral selection save/read path is available without checkout commit.",
        evidence: [{ label: "mock selection route normalized", status: "ready" }],
      },
      {
        code: "advanced_diagnostics_ready",
        label: "Advanced diagnostics ready",
        status: "ready",
        ready: true,
        detail: "Collapsed dev diagnostics expose sanitized readiness verifier status without becoming the shopper product flow.",
        evidence: [{ label: "delivery-hub-advanced-preconditions-status", status: "ready" }],
      },
      {
        code: "browser_mock_smoke_ready",
        label: "Browser mock smoke ready",
        status: "ready",
        ready: true,
        detail: "Browser smoke uses local mock Store API responses only.",
        evidence: [{ label: "delivery-hub-preview-browser-smoke.mjs", status: "ready" }],
      },
      {
        code: "rollback_plan_ready",
        label: "Rollback/no-fallback plan ready",
        status: "ready",
        ready: true,
        detail: "Rollback remains flag-off and fail-closed without requiring a legacy delivery fallback.",
        evidence: [{ label: "no-fallback browser smoke documents rollback", status: "ready" }],
      },
      {
        code: "admin_yandex_quote_baseline_recorded",
        label: "Admin/Yandex quote baseline recorded",
        status: "ready",
        ready: true,
        detail: "Existing live baseline is represented here by safe evidence labels only.",
        evidence: [{ label: "warehouse and dropoff quote baselines recorded", status: "ready" }],
      },
      {
        code: "fulfillment_bridge_preview_ready",
        label: "Fulfillment bridge preview ready",
        status: "ready",
        ready: true,
        detail: "Bridge preview remains diagnostic-only and mutation-free.",
        evidence: [{ label: "diagnostic fulfillment bridge preview", status: "ready" }],
      },
      {
        code: "operator_approval_required",
        label: "Operator approval required",
        status: "required",
        ready: false,
        detail: "A separate operator-approved tranche is still required before checkout cutover.",
        evidence: [{ label: "manual approval gate", status: "required" }],
      },
      {
        code: "shipment_lifecycle_not_enabled",
        label: "Shipment lifecycle not enabled",
        status: "blocked",
        ready: false,
        detail: "Shipment create/cancel/status/retry is not enabled by this verifier.",
        evidence: [{ label: "shipment lifecycle disabled", status: "blocked" }],
      },
      {
        code: "can_commit_shipping_method",
        label: "Shipping-method commit remains blocked",
        status: "blocked",
        ready: false,
        detail: "can_commit_shipping_method=false until separate approved cutover implementation.",
        evidence: [{ label: "runtime invariant", status: "blocked" }],
      },
    ],
    guardrails: {
      checkout_source_of_truth: "unchanged",
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    },
  }
}

async function resolveChromeBinary() {
  if (process.env.BROWSER_SMOKE_BROWSER_BIN) {
    return process.env.BROWSER_SMOKE_BROWSER_BIN
  }

  for (const candidate of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"]) {
    const result = await new Promise((resolve) => {
      const child = spawn("bash", ["-lc", `command -v ${candidate}`], { stdio: ["ignore", "pipe", "ignore"] })
      let output = ""
      child.stdout.on("data", (chunk) => {
        output += String(chunk)
      })
      child.on("close", (code) => resolve(code === 0 ? output.trim() : ""))
    })

    if (result) {
      return result
    }
  }

  fail("Delivery Hub browser smoke requires Chrome/Chromium or BROWSER_SMOKE_BROWSER_BIN.")
}

async function waitForHttpOk(url, label) {
  const deadline = Date.now() + timeoutMs
  let lastError = null

  while (Date.now() < deadline) {
    try {
      const ok = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume()
          resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500)
        })
        req.on("error", reject)
        req.setTimeout(5000, () => req.destroy(new Error("timeout")))
      })
      if (ok) {
        return
      }
    } catch (error) {
      lastError = error
    }
    await delay(500)
  }

  fail(`${label} did not become reachable: ${lastError?.message || url}`)
}

async function startStorefront({ enabled, cutoverEnabled = false, mockBackendUrl }) {
  const port = await getFreePort()
  const url = `http://127.0.0.1:${port}`
  const env = {
    ...process.env,
    NODE_ENV: "development",
    NEXT_PUBLIC_STOREFRONT_PRESET: "atelier",
    STOREFRONT_PORT: String(port),
    MEDUSA_BACKEND_URL: mockBackendUrl,
    MEDUSA_BACKEND_PORT: new URL(mockBackendUrl).port,
    NEXT_PUBLIC_BASE_URL: url,
    NEXT_PUBLIC_DEFAULT_REGION: "ru",
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: mockPublicKey,
    NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED: enabled ? "true" : "false",
    NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED: cutoverEnabled ? "true" : "false",
    NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED: "true",
    NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_CONNECTION_ID: connectionId,
    NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_DESTINATION_POINT_ID: destinationPointId,
    NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_ORIGIN_POINT_ID: originPointId,
    NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID: "warehouse_delivery_hub_preview_smoke",
    NEXT_PUBLIC_STRIPE_KEY: "",
    NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY: "",
    NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID: "",
    NEXT_PUBLIC_YOOKASSA_ENABLED: "false",
    NEXT_PUBLIC_VK_ID_ENABLED: "false",
    PAYLOAD_ENABLED: "false",
  }

  nextProcess = spawn("npm", ["run", "dev"], {
    cwd: storefrontDir,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  })

  let logTail = ""
  const collect = (chunk) => {
    logTail = `${logTail}${String(chunk)}`.slice(-8000)
  }
  nextProcess.stdout.on("data", collect)
  nextProcess.stderr.on("data", collect)
  nextProcess.once("exit", (code) => {
    if (!closing && !stoppingStorefront) {
      process.stderr.write(logTail)
      process.stderr.write(`[error] Storefront dev server exited early with code ${code ?? "unknown"}.\n`)
      process.exit(1)
    }
  })

  const label = `${enabled ? "enabled" : "disabled"}, cutover ${cutoverEnabled ? "true" : "false"}`
  await waitForHttpOk(`${url}/ru/checkout?step=delivery`, `Storefront Delivery Hub smoke server (${label})`)
  log(`Storefront Delivery Hub smoke server ready (${label}) on ${url}`)
  return {
    url,
    stop: async () => {
      stoppingStorefront = true
      await stopProcess(nextProcess)
      stoppingStorefront = false
    },
  }
}

async function stopProcess(child) {
  if (!child || child.killed || child.exitCode !== null || child.signalCode !== null) {
    return
  }

  await new Promise((resolve) => {
    const finish = () => resolve()
    child.once("exit", finish)

    try {
      if (child.pid) {
        process.kill(-child.pid, "SIGTERM")
      } else {
        child.kill("SIGTERM")
      }
    } catch {
      child.kill("SIGTERM")
    }

    setTimeout(() => {
      try {
        if (child.pid) {
          process.kill(-child.pid, "SIGKILL")
        } else if (!child.killed) {
          child.kill("SIGKILL")
        }
      } catch {}
      finish()
    }, 2000).unref()
  })
}

async function createBrowser(chromeBinary) {
  const debuggingPort = await getFreePort()
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-hub-smoke-"))
  tempProfileDirs.push(profileDir)
  chromeProcess = spawn(chromeBinary, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] })

  chromeProcess.once("exit", (code) => {
    if (!closing) {
      process.stderr.write(`[error] Chrome exited before smoke finished with code ${code ?? "unknown"}.\n`)
      process.exit(1)
    }
  })

  const versionUrl = `http://127.0.0.1:${debuggingPort}/json/version`
  const deadline = Date.now() + timeoutMs
  let webSocketDebuggerUrl = null
  while (Date.now() < deadline && !webSocketDebuggerUrl) {
    try {
      webSocketDebuggerUrl = await new Promise((resolve, reject) => {
        http.get(versionUrl, (res) => {
          let body = ""
          res.setEncoding("utf8")
          res.on("data", (chunk) => { body += chunk })
          res.on("end", () => resolve(JSON.parse(body).webSocketDebuggerUrl))
        }).on("error", reject)
      })
    } catch {}
    if (!webSocketDebuggerUrl) {
      await delay(200)
    }
  }

  if (!webSocketDebuggerUrl) {
    fail("Timed out waiting for Chrome DevTools endpoint.")
  }

  browserWs = new WebSocket(webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    browserWs.once("open", resolve)
    browserWs.once("error", reject)
  })

  browserWs.on("message", (data) => {
    const message = JSON.parse(String(data))
    if (typeof message.id === "number") {
      const handler = pending.get(message.id)
      if (!handler) return
      pending.delete(message.id)
      if (message.error) {
        handler.reject(new Error(message.error.message || "Chrome DevTools Protocol error"))
      } else {
        handler.resolve(message.result)
      }
      return
    }
    if (message.method === "Target.attachedToTarget") {
      pageSessions.set(message.params.targetInfo.targetId, message.params.sessionId)
    }
  })

  await send({ method: "Target.setAutoAttach", params: { autoAttach: true, waitForDebuggerOnStart: false, flatten: true } })
}

function send(message, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++messageId
    pending.set(id, { resolve, reject })
    browserWs.send(JSON.stringify(sessionId ? { id, sessionId, ...message } : { id, ...message }))
  })
}

async function newPageSession(baseUrl) {
  const target = await send({ method: "Target.createTarget", params: { url: "about:blank" } })
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const sessionId = pageSessions.get(target.targetId)
    if (sessionId) {
      await send({ method: "Page.enable" }, sessionId)
      await send({ method: "Runtime.enable" }, sessionId)
      await send({ method: "Network.enable" }, sessionId)
      await send({ method: "Network.setCacheDisabled", params: { cacheDisabled: true } }, sessionId)
      await send({
        method: "Network.setCookie",
        params: { name: "_medusa_cart_id", value: cartId, url: baseUrl, path: "/" },
      }, sessionId)
      await send({
        method: "Network.setCookie",
        params: { name: "_medusa_cache_id", value: "delivery-hub-smoke", url: baseUrl, path: "/" },
      }, sessionId)
      return sessionId
    }
    await delay(50)
  }
  fail("Timed out waiting for Chrome page session.")
}

async function navigate(sessionId, url) {
  await send({ method: "Page.navigate", params: { url } }, sessionId)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = await evaluate(sessionId, "document.readyState")
    if (state === "complete") return
    await delay(100)
  }
  fail(`Timed out waiting for page load: ${url}`)
}

async function evaluate(sessionId, expression) {
  const result = await send({
    method: "Runtime.evaluate",
    params: { expression, returnByValue: true, awaitPromise: true },
  }, sessionId)
  if (result.exceptionDetails) {
    fail(result.exceptionDetails.text || result.exceptionDetails.exception?.description || "Browser evaluation failed.")
  }
  return result.result?.value
}

async function waitFor(sessionId, expression, description, { onTimeout } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    let result = false
    try {
      result = await evaluate(sessionId, expression)
    } catch (error) {
      fail(`${error.message} while waiting for ${description}. Expression: ${expression.slice(0, 500)}`)
    }
    if (result) return result
    await delay(250)
  }
  if (onTimeout) {
    const timeoutDetails = await onTimeout()
    fail(`Timed out waiting for ${description}. ${timeoutDetails}`)
  }
  fail(`Timed out waiting for ${description}.`)
}

async function waitForMockDeliverySelectionSave(label) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const selectionSaves = mockRequests.filter((entry) =>
      entry.method === "POST" && entry.pathname === "/store/delivery/selection"
    )
    if (selectionSaves.length > 0) {
      return
    }
    await delay(250)
  }
  fail(`${label} did not POST the mocked Delivery Hub selection save route.`)
}

async function waitForMockCommitRequest(label, expectedOptionId) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      assertDeliveryHubCommitRequest(label, expectedOptionId)
      return
    } catch (error) {
      const commits = mockRequests.filter((entry) =>
        entry.method === "POST" && entry.pathname === `/store/carts/${cartId}/shipping-methods`
      )
      if (commits.length > 1) {
        throw error
      }
    }
    await delay(250)
  }
  assertDeliveryHubCommitRequest(label, expectedOptionId)
}

async function runDisabledCheck(baseUrl, label = "disabled feature-flag check") {
  resetMockRequestLog()
  const sessionId = await newPageSession(baseUrl)
  await navigate(sessionId, `${baseUrl}/ru/checkout?step=delivery`)
  await waitFor(sessionId, "Boolean(document.querySelector('[data-testid=\"delivery-options-container\"]'))", "checkout delivery options")
  const disabledState = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    const optionText = document.querySelector('[data-testid="delivery-options-container"]')?.innerText || ''
    const absentTestIds = [
      'delivery-hub-dev-diagnostics',
      'delivery-hub-advanced-diagnostics-block',
      'delivery-hub-advanced-readiness-status',
      'delivery-hub-advanced-preconditions-status',
      'delivery-hub-advanced-candidate-status',
      'delivery-hub-advanced-approval-record',
    ].filter((testId) => !document.querySelector('[data-testid="' + testId + '"]'))
    const hiddenCutoverTestIds = [
      'delivery-hub-advanced-readiness-status',
      'delivery-hub-advanced-preconditions-status',
      'delivery-hub-advanced-candidate-status',
      'delivery-hub-advanced-approval-record',
    ].filter((testId) => Boolean(document.querySelector('[data-testid="' + testId + '"]')))
    return {
      text,
      absentTestIds,
      hiddenCutoverTestIds,
      deliveryHubShippingVisible: optionText.includes('Delivery Hub Pickup Candidate'),
      legacyFallbackVisible: optionText.includes('Legacy/Medusa fallback shipping'),
      deliveryHubPreviewTextVisible: text.includes('Delivery Hub Preview/Shadow UI') || text.includes('checkout source-of-truth'),
      cutoverArtifactTextVisible: text.includes('delivery_hub_checkout_cutover_decision') || text.includes('Decision artifact only / no approval execution'),
      commitStatusTextVisible: Boolean(document.querySelector('[data-testid="delivery-hub-checkout-commit-guard"]')) || Boolean(document.querySelector('[data-testid="delivery-hub-advanced-candidate-status"]')),
      commitNeedleDebug: Boolean(document.querySelector('[data-testid="delivery-hub-checkout-commit-guard"]')) ? 'commit guard element' : Boolean(document.querySelector('[data-testid="delivery-hub-advanced-candidate-status"]')) ? 'candidate status element' : 'unknown',
    }
  })()`)
  const expectedAbsentCount = 6
  if (disabledState.absentTestIds.length !== expectedAbsentCount) {
    fail("Delivery Hub diagnostics blocks are visible while NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=false.")
  }
  if (!disabledState.deliveryHubShippingVisible) {
    fail("Delivery Hub checkout option was not visible in disabled no-fallback smoke.")
  }
  if (disabledState.legacyFallbackVisible) {
    fail("Legacy fallback shipping text was visible in disabled no-fallback smoke.")
  }
  if (disabledState.deliveryHubPreviewTextVisible || disabledState.cutoverArtifactTextVisible || disabledState.hiddenCutoverTestIds.length > 0) {
    fail(`Delivery Hub preview/cutover source-of-truth text was visible in disabled no-fallback contour: preview=${disabledState.deliveryHubPreviewTextVisible} artifact=${disabledState.cutoverArtifactTextVisible} cutover=${disabledState.hiddenCutoverTestIds.join(',')}`)
  }
  assertNoUnsafeNeedles(disabledState.text, label)
  assertNoShipmentLifecycleActions(disabledState.text, label)
  assertNoDeliveryHubCommitRequests(label)
  log(`${label} passed: Delivery Hub blocks are hidden, commit is not attempted, and no legacy fallback contour is visible.`)
}

async function runEnabledFlow(baseUrl, { expectedCutoverEnabled = false, label = "enabled browser smoke" } = {}) {
  resetMockRequestLog()
  const sessionId = await newPageSession(baseUrl)
  await navigate(sessionId, `${baseUrl}/ru/checkout?step=delivery`)
  await waitFor(sessionId, "Boolean(document.querySelector('[data-testid=\"delivery-hub-customer-delivery-card\"]'))", "Delivery Hub customer delivery card")
  await waitFor(sessionId, "Boolean(document.querySelector('[data-testid=\"delivery-hub-pickup-point-selector\"]'))", "Delivery Hub pickup point selector")
  await waitFor(sessionId, "Boolean(document.querySelector('[data-testid=\"delivery-hub-pickup-point-option\"]'))", "mocked pickup point option")

  const initial = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    const optionText = document.querySelector('[data-testid="delivery-options-container"]')?.innerText || ''
    return {
      text,
      customerCard: document.querySelector('[data-testid="delivery-hub-customer-delivery-card"]')?.textContent || '',
      selector: document.querySelector('[data-testid="delivery-hub-pickup-point-selector"]')?.textContent || '',
      deliveryHubShippingVisible: optionText.includes('Delivery Hub Pickup Candidate'),
      legacyFallbackVisible: optionText.includes('Legacy/Medusa fallback shipping'),
      legacyPreviewTextVisible: text.includes('Delivery Hub Preview/Shadow UI') || text.includes('checkout source-of-truth') || text.toLowerCase().includes('cutover') || text.toLowerCase().includes('legacy fallback'),
      diagnosticsPresent: Boolean(document.querySelector('[data-testid="delivery-hub-dev-diagnostics"]')),
      diagnosticsOpen: Boolean(document.querySelector('[data-testid="delivery-hub-dev-diagnostics"]')?.open),
    }
  })()`)

  if (!initial.deliveryHubShippingVisible) fail("Delivery Hub checkout option is missing in browser smoke.")
  if (initial.legacyFallbackVisible) fail("Legacy fallback checkout contour is visible in browser smoke.")
  if (initial.legacyPreviewTextVisible) fail("Legacy preview/cutover wording is visible in the active shopper delivery flow.")
  if (!initial.customerCard.includes("RUB") && !initial.customerCard.includes("₽")) fail("Mocked customer quote price/currency was not visible.")
  if (!initial.customerCard.includes("Smoke pickup point")) fail("Mocked pickup point was not visible in buyer delivery card.")
  if (!initial.diagnosticsPresent) fail("Dev diagnostics container is missing behind the enabled diagnostics flag.")
  if (initial.diagnosticsOpen) fail("Dev diagnostics should be collapsed by default and not be part of the shopper product flow.")
  assertNoUnsafeNeedles(initial.text, "initial enabled Delivery Hub page")

  await evaluate(sessionId, `(() => {
    const button = document.querySelector('[data-testid="delivery-hub-customer-save-selection-button"]')
    if (!button) throw new Error('Delivery Hub customer save selection button is missing')
    if (button.disabled) throw new Error('Delivery Hub customer save selection button is disabled')
    button.click()
    return true
  })()`)

  await waitForMockDeliverySelectionSave(label)
  await waitFor(
    sessionId,
    expectedCutoverEnabled
      ? "document.querySelector('[data-testid=\"delivery-hub-customer-save-message\"]')?.textContent.includes('Способ доставки сохранён') || document.querySelector('[data-testid=\"delivery-hub-customer-selection-status\"]')?.textContent.includes('Доставка сохранена')"
      : "document.querySelector('[data-testid=\"delivery-hub-customer-save-message\"]')?.textContent.includes('Нужно обновить доставку') || document.querySelector('[data-testid=\"delivery-hub-customer-selection-status\"]')?.textContent.includes('Доставка сохранена')",
    expectedCutoverEnabled ? "mocked customer selection saved and shipping method committed" : "mocked customer selection saved without shipping-method commit",
    {
      onTimeout: async () => {
        const debugState = await evaluate(sessionId, `(() => ({
          card: document.querySelector('[data-testid="delivery-hub-customer-delivery-card"]')?.textContent || '',
          buttonExists: Boolean(document.querySelector('[data-testid="delivery-hub-customer-save-selection-button"]')),
          buttonDisabled: Boolean(document.querySelector('[data-testid="delivery-hub-customer-save-selection-button"]')?.disabled),
          saveMessage: document.querySelector('[data-testid="delivery-hub-customer-save-message"]')?.textContent || '',
          selectionStatus: document.querySelector('[data-testid="delivery-hub-customer-selection-status"]')?.textContent || '',
        }))()`)
        return `Debug state: ${JSON.stringify(debugState)}`
      },
    }
  )

  const afterSave = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    const optionText = document.querySelector('[data-testid="delivery-options-container"]')?.textContent || ''
    return {
      text,
      customerCard: document.querySelector('[data-testid="delivery-hub-customer-delivery-card"]')?.textContent || '',
      saveMessage: document.querySelector('[data-testid="delivery-hub-customer-save-message"]')?.textContent || '',
      selectionStatus: document.querySelector('[data-testid="delivery-hub-customer-selection-status"]')?.textContent || '',
      deliveryHubShippingVisible: optionText.includes('Delivery Hub Pickup Candidate'),
      legacyFallbackVisible: optionText.includes('Legacy/Medusa fallback shipping'),
      diagnosticsPresent: Boolean(document.querySelector('[data-testid="delivery-hub-dev-diagnostics"]')),
      diagnosticsOpen: Boolean(document.querySelector('[data-testid="delivery-hub-dev-diagnostics"]')?.open),
    }
  })()`)

  if (!afterSave.deliveryHubShippingVisible) fail("Delivery Hub checkout option disappeared after save.")
  if (afterSave.legacyFallbackVisible) fail("Legacy fallback checkout contour appeared after save.")
  if (afterSave.text.includes('Delivery Hub Preview/Shadow UI') || afterSave.text.includes('checkout source-of-truth') || afterSave.text.toLowerCase().includes('cutover') || afterSave.text.toLowerCase().includes('legacy fallback')) fail("Legacy preview/cutover wording appeared in the active shopper flow after save.")
  if (!afterSave.diagnosticsPresent || afterSave.diagnosticsOpen) fail("Dev diagnostics should stay present but collapsed after product-flow save.")
  assertNoUnsafeNeedles(afterSave.text, "after mocked selection save")

  if (expectedCutoverEnabled) {
    await waitForMockCommitRequest(label, candidateShippingOptionId)
    await navigate(sessionId, `${baseUrl}/ru/checkout?step=delivery&dh_smoke_refresh=${Date.now()}`)
    await waitFor(
      sessionId,
      `(() => {
        const status = document.querySelector('[data-testid="delivery-hub-customer-selection-status"]')?.textContent || ''
        const summary = document.querySelector('[data-testid="delivery-summary"]')?.textContent || document.body.innerText
        return status.includes('Доставка сохранена') || summary.includes('Delivery Hub Pickup Candidate')
      })()`,
      "Delivery Hub shipping option persisted after browser save/refresh"
    )
  } else {
    assertNoDeliveryHubCommitRequests(label)
  }

  await requestMockClearSelection()
  await delay(1000)

  const afterClear = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    const optionText = document.querySelector('[data-testid="delivery-options-container"]')?.textContent || ''
    return {
      text,
      deliveryHubShippingVisible: optionText.includes('Delivery Hub Pickup Candidate'),
      legacyFallbackVisible: optionText.includes('Legacy/Medusa fallback shipping'),
    }
  })()`)

  if (!afterClear.deliveryHubShippingVisible) fail("Delivery Hub checkout option disappeared after clear.")
  if (afterClear.legacyFallbackVisible) fail("Legacy fallback checkout contour appeared after clear.")
  assertNoUnsafeNeedles(afterClear.text, "after mocked selection clear")

  if (expectedCutoverEnabled) {
    assertDeliveryHubCommitRequest(label, candidateShippingOptionId)
  } else {
    assertNoDeliveryHubCommitRequests(label)
  }
  const requestedDeliveryHubRoutes = new Set(mockRequests
    .filter((entry) => entry.pathname.startsWith("/store/delivery/"))
    .map((entry) => `${entry.method} ${entry.pathname}`))
  for (const expectedRoute of [
    "GET /store/delivery/settings",
    "GET /store/delivery/selection",
    "POST /store/delivery/quotes",
    "POST /store/delivery/selection",
    "DELETE /store/delivery/selection",
  ]) {
    if (!requestedDeliveryHubRoutes.has(expectedRoute)) {
      fail(`${label} did not exercise expected mocked Delivery Hub product route: ${expectedRoute}`)
    }
  }

  log(`${label} passed: product quote/PVZ/save flow used mocked Store API responses and did not depend on shopper-visible diagnostics.`)
}

async function runRollbackDrillSequence(mockBackendUrl) {
  log("Starting rollback/no-fallback drill: flags off baseline -> diagnostics on/handoff off -> diagnostics on/handoff true -> flags off rollback.")

  mockSelection = buildSelectionFromBody({})
  let storefront = await startStorefront({ enabled: false, mockBackendUrl })
  await runDisabledCheck(storefront.url, "rollback drill all flags off baseline")
  await storefront.stop()
  nextProcess = null

  mockSelection = null
  storefront = await startStorefront({ enabled: true, cutoverEnabled: false, mockBackendUrl })
  await runEnabledFlow(storefront.url, { expectedCutoverEnabled: false, label: "rollback drill diagnostics enabled handoff false" })
  await storefront.stop()
  nextProcess = null

  mockSelection = null
  storefront = await startStorefront({ enabled: true, cutoverEnabled: true, mockBackendUrl })
  await runEnabledFlow(storefront.url, { expectedCutoverEnabled: true, label: "rollback drill diagnostics enabled handoff true pre-rollback" })
  await storefront.stop()
  nextProcess = null

  mockSelection = buildSelectionFromBody({})
  storefront = await startStorefront({ enabled: false, cutoverEnabled: false, mockBackendUrl })
  await runDisabledCheck(storefront.url, "rollback drill simulated flags-off rollback after cutover-true rehearsal")
  await storefront.stop()
  nextProcess = null

  log("Delivery Hub rollback/no-fallback drill passed: flag-off runs hide/disable Delivery Hub diagnostics, flag-on commits only the mapped mock Medusa shipping option, rollback flag-off returns to no commit requests, and no legacy fallback contour is required.")
}

async function runCutoverSmokeSequence(mockBackendUrl) {
  log("Starting checkout handoff flag-on smoke: diagnostics enabled with explicit checkout handoff flag true, local mock Store API only.")

  mockSelection = null
  const storefront = await startStorefront({ enabled: true, cutoverEnabled: true, mockBackendUrl })
  await runEnabledFlow(storefront.url, { expectedCutoverEnabled: true, label: "cutover flag-on browser smoke" })
  await storefront.stop()
  nextProcess = null

  log("Delivery Hub checkout handoff flag-on browser smoke passed: explicit flag-on contour committed only the mapped mock Medusa shipping option and used no live backend/provider network.")
}

function assertNoUnsafeNeedles(text, label) {
  const lowered = String(text || "").toLowerCase()
  const leaked = unsafeNeedles.find((needle) => lowered.includes(needle.toLowerCase()))
  if (leaked) {
    fail(`Unsafe provider/auth material was visible in ${label}: ${leaked}`)
  }
}

async function requestMockClearSelection() {
  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: mockServer.address().port,
      path: "/store/delivery/selection",
      method: "DELETE",
      headers: { "content-type": "application/json" },
    }, (res) => {
      res.resume()
      res.on("end", () => resolve())
    })
    req.on("error", reject)
    req.end("{}")
  })
}

function resetMockRequestLog() {
  mockRequests.length = 0
}

function assertNoDeliveryHubCommitRequests(label) {
  const forbidden = mockRequests.filter((entry) => {
    if (entry.method !== "POST") return false
    if (entry.pathname === `/store/carts/${cartId}/shipping-methods`) return true
    if (entry.pathname === `/store/carts/${cartId}/shipping-method`) return true
    if (entry.pathname.includes("shipping-method")) return true
    return false
  })
  if (forbidden.length > 0) {
    fail(`${label} unexpectedly attempted a Medusa shipping-method commit: ${forbidden.map((entry) => `${entry.method} ${entry.pathname}`).join(", ")}`)
  }
}

function assertDeliveryHubCommitRequest(label, expectedOptionId) {
  const commits = mockRequests.filter((entry) =>
    entry.method === "POST" && entry.pathname === `/store/carts/${cartId}/shipping-methods`
  )
  if (commits.length !== 1) {
    fail(`${label} expected exactly one mocked Medusa shipping-method commit, saw ${commits.length}.`)
  }

  const [commit] = commits
  const body = commit.body && typeof commit.body === "object" ? commit.body : {}
  const keys = Object.keys(body).sort()
  if (keys.length !== 1 || keys[0] !== "option_id") {
    fail(`${label} sent unsafe Medusa commit payload keys: ${keys.join(", ") || "none"}.`)
  }
  if (body.option_id !== expectedOptionId) {
    fail(`${label} sent option_id ${body.option_id || "none"}, expected ${expectedOptionId}.`)
  }
  if (!/^deliveryhub:[a-z0-9_]+$/.test(body.option_id)) {
    fail(`${label} sent an option_id outside the expected Delivery Hub Medusa option-id shape.`)
  }

  const serializedBody = JSON.stringify(body).toLowerCase()
  for (const forbiddenNeedle of [
    "provider",
    "secret",
    "token",
    "authorization",
    "ciphertext",
    "raw",
    "quote_reference",
    "quote_key",
    "offer",
    "yandex",
    "connection_id",
    "pickup_window",
    "correlation_id",
    "metadata",
    "data",
  ]) {
    if (serializedBody.includes(forbiddenNeedle)) {
      fail(`${label} leaked unsafe provider/selection material in Medusa commit payload: ${forbiddenNeedle}`)
    }
  }
  if (mockCommittedShippingOptionId !== expectedOptionId) {
    fail(`${label} committed ${mockCommittedShippingOptionId || "none"}, expected ${expectedOptionId}.`)
  }
}

function assertNoShipmentLifecycleActions(text, label) {
  const lowered = String(text || "").toLowerCase()
  const lifecycleNeedles = [
    "create shipment",
    "cancel shipment",
    "refresh status",
    "retry shipment",
    "retry execution",
    "shipment create",
    "shipment cancel",
    "shipment status",
    "shipment retry",
    "/shipments/",
  ]
  const leaked = lifecycleNeedles.find((needle) => lowered.includes(needle))
  if (leaked) {
    fail(`Shipment lifecycle string/action was visible in ${label}: ${leaked}`)
  }
}

async function cleanup() {
  closing = true
  for (const [, handler] of pending) {
    handler.reject(new Error("cleanup"))
  }
  pending.clear()
  try { browserWs?.close() } catch {}
  await stopProcess(chromeProcess)
  await stopProcess(nextProcess)
  if (mockServer) {
    await new Promise((resolve) => mockServer.close(resolve))
  }
  for (const dir of tempProfileDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function isRollbackDrillMode() {
  return process.argv.includes("--rollback-drill") || process.env.DELIVERY_HUB_ROLLBACK_DRILL === "true"
}

function isCutoverSmokeMode() {
  return process.argv.includes("--cutover-smoke") || process.env.DELIVERY_HUB_CUTOVER_SMOKE === "true"
}

async function main() {
  process.on("SIGINT", () => cleanup().finally(() => process.exit(130)))
  process.on("SIGTERM", () => cleanup().finally(() => process.exit(143)))

  const chromeBinary = await resolveChromeBinary()
  const mockBackendUrl = await startMockBackend()
  await createBrowser(chromeBinary)

  if (isRollbackDrillMode()) {
    await runRollbackDrillSequence(mockBackendUrl)
    return
  }

  if (isCutoverSmokeMode()) {
    await runCutoverSmokeSequence(mockBackendUrl)
    return
  }

  let storefront = await startStorefront({ enabled: false, mockBackendUrl })
  await runDisabledCheck(storefront.url)
  await storefront.stop()
  nextProcess = null

  mockSelection = null
  storefront = await startStorefront({ enabled: true, mockBackendUrl })
  await runEnabledFlow(storefront.url, { expectedCutoverEnabled: false })
  await storefront.stop()
  nextProcess = null

  mockSelection = null
  storefront = await startStorefront({ enabled: true, cutoverEnabled: true, mockBackendUrl })
  await runEnabledFlow(storefront.url, { expectedCutoverEnabled: true })

  log("Delivery Hub browser smoke passed without live Yandex/backend: flag-off made no commit request, flag-on committed only the mapped mock Medusa shipping option, and product-flow checks did not depend on diagnostics DOM.")
}

main()
  .catch((error) => {
    process.stderr.write(`[error] Delivery Hub browser smoke failed: ${error.message}\n`)
    process.exitCode = 1
  })
  .finally(cleanup)
