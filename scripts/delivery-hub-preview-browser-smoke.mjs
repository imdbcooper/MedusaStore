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
const candidateShippingOptionId = "deliveryhub:dropoff_point_to_pickup_point"
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
    fail("Unable to allocate a local port for Delivery Hub preview browser smoke.")
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
    shipping_methods: [],
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
      address_1: "Preview street 1",
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
      address_1: "Preview street 1",
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
    connection_id: body.connection_id || connectionId,
    quote_type: body.quote_type || "dropoff_point_to_pickup_point",
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
      name: "Preview pickup point",
      address: "Preview pickup point address",
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
      mockRequests.push({ method: req.method || "GET", pathname })

      if (req.method === "GET" && pathname === "/health") {
        sendJson(res, 200, { ok: true })
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
        sendJson(res, 200, { cart: buildCart() })
        return
      }

      if (req.method === "GET" && pathname === "/store/shipping-options") {
        sendJson(res, 200, {
          shipping_options: [
            {
              id: "apiship_medusa_smoke_option",
              name: "ApiShip/Medusa fallback shipping",
              provider_id: "apiship",
              price_type: "flat",
              amount: 390,
              data: { contour: "existing_apiship_medusa" },
              provider: { is_enabled: true },
            },
          ],
        })
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

      if (req.method === "GET" && pathname === "/store/delivery/pickup-points") {
        sendJson(res, 200, {
          ok: true,
          points: [
            {
              provider_point_id: destinationPointId,
              provider_point_code: "PVZ-SMOKE",
              name: "Smoke pickup point",
              address: "Preview pickup point address",
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
        sendJson(res, 200, {
          ok: true,
          quotes: [
            {
              carrier_code: "neutral_carrier",
              carrier_label: "Neutral Carrier",
              mode_code: "dropoff_point_to_pickup_point",
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
        })
        return
      }

      if (req.method === "POST" && pathname === "/store/delivery/selection") {
        const body = await readJsonBody(req)
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
    fail("Unable to start Delivery Hub preview mock backend.")
  }
  const url = `http://127.0.0.1:${port}`
  log(`Delivery Hub preview mock Store API listening on ${url}`)
  return url
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
      checkout_source_of_truth: candidate.checkout_source_of_truth,
      can_commit_shipping_method: false,
      guardrails: candidate.guardrails,
    },
    required_acknowledgements: {
      rollback_reviewed: false,
      apiship_fallback_available: false,
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
        code: "preview_ui_ready",
        label: "Preview UI ready",
        status: "ready",
        ready: true,
        detail: "Preview/shadow UI exposes verifier status near the cutover gate.",
        evidence: [{ label: "delivery-hub-cutover-preconditions-status", status: "ready" }],
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
        label: "Rollback plan ready",
        status: "ready",
        ready: true,
        detail: "Rollback remains flag-off/source-of-truth unchanged.",
        evidence: [{ label: "checkout cutover plan documents rollback", status: "ready" }],
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

  fail("Delivery Hub preview browser smoke requires Chrome/Chromium or BROWSER_SMOKE_BROWSER_BIN.")
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
  await waitForHttpOk(`${url}/ru/checkout?step=delivery`, `Storefront preview smoke server (${label})`)
  log(`Storefront preview smoke server ready (${label}) on ${url}`)
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
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-hub-preview-smoke-"))
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
      await send({
        method: "Network.setCookie",
        params: { name: "_medusa_cart_id", value: cartId, url: baseUrl, path: "/" },
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
    fail(result.exceptionDetails.text || "Browser evaluation failed.")
  }
  return result.result?.value
}

async function waitFor(sessionId, expression, description) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await evaluate(sessionId, expression)
    if (result) return result
    await delay(250)
  }
  fail(`Timed out waiting for ${description}.`)
}

async function runDisabledCheck(baseUrl, label = "disabled feature-flag check") {
  resetMockRequestLog()
  const sessionId = await newPageSession(baseUrl)
  await navigate(sessionId, `${baseUrl}/ru/checkout?step=delivery`)
  await waitFor(sessionId, "Boolean(document.querySelector('[data-testid=\"delivery-options-container\"]'))", "checkout delivery options")
  const disabledState = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    const absentTestIds = [
      'delivery-hub-preview-shadow-block',
      'delivery-hub-cutover-gate-status',
      'delivery-hub-cutover-preconditions-status',
      'delivery-hub-cutover-candidate-status',
      'delivery-hub-cutover-approval-artifact',
    ].filter((testId) => !document.querySelector('[data-testid="' + testId + '"]'))
    return {
      text,
      absentTestIds,
      existingShippingVisible: text.includes('ApiShip/Medusa fallback shipping'),
      deliveryHubPreviewTextVisible: text.includes('Delivery Hub Preview/Shadow UI'),
      cutoverArtifactTextVisible: text.includes('delivery_hub_checkout_cutover_decision') || text.includes('Decision artifact only / no approval execution'),
      commitStatusTextVisible: text.includes('canCommitShippingMethod=') || text.includes('candidate only / no checkout commit'),
    }
  })()`)
  const expectedAbsentCount = 5
  if (disabledState.absentTestIds.length !== expectedAbsentCount) {
    fail("Delivery Hub preview/cutover artifact blocks are visible while NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=false.")
  }
  if (!disabledState.existingShippingVisible) {
    fail("Existing ApiShip/Medusa checkout contour was not visible in disabled smoke.")
  }
  if (disabledState.deliveryHubPreviewTextVisible || disabledState.cutoverArtifactTextVisible || disabledState.commitStatusTextVisible) {
    fail("Delivery Hub preview/cutover source-of-truth text was visible in disabled fallback contour.")
  }
  assertNoUnsafeNeedles(disabledState.text, label)
  assertNoShipmentLifecycleActions(disabledState.text, label)
  assertNoDeliveryHubCommitRequests(label)
  log(`${label} passed: Delivery Hub blocks are hidden, commit is not attempted, and existing shipping contour remains visible.`)
}

async function runEnabledFlow(baseUrl, { expectedCutoverEnabled = false, label = "enabled browser smoke" } = {}) {
  resetMockRequestLog()
  const sessionId = await newPageSession(baseUrl)
  await navigate(sessionId, `${baseUrl}/ru/checkout?step=delivery`)
  await waitFor(sessionId, "Boolean(document.querySelector('[data-testid=\"delivery-hub-preview-shadow-block\"]'))", "Delivery Hub preview block")
  await waitFor(
    sessionId,
    "document.querySelector('[data-testid=\"delivery-hub-cutover-preconditions-status\"]')?.innerText.includes('Preconditions verifier: available')",
    "cutover preconditions verifier"
  )

  await waitFor(
    sessionId,
    "document.querySelector('[data-testid=\"delivery-hub-cutover-candidate-status\"]')?.innerText.includes('Candidate planner: available')",
    "cutover candidate planner"
  )

  const initial = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    return {
      text,
      previewVisible: Boolean(document.querySelector('[data-testid="delivery-hub-preview-shadow-block"]')),
      existingShippingVisible: text.includes('ApiShip/Medusa fallback shipping'),
      guardrails: document.querySelector('[data-testid="delivery-hub-preview-guardrails"]')?.innerText || '',
      cutoverGate: document.querySelector('[data-testid="delivery-hub-cutover-gate-status"]')?.innerText || '',
      cutoverPreconditions: document.querySelector('[data-testid="delivery-hub-cutover-preconditions-status"]')?.innerText || '',
      cutoverCandidate: document.querySelector('[data-testid="delivery-hub-cutover-candidate-status"]')?.innerText || '',
      approvalArtifact: document.querySelector('[data-testid="delivery-hub-cutover-approval-artifact"]')?.innerText || '',
      operationStatus: document.querySelector('[data-testid="delivery-hub-preview-operation-status"]')?.innerText || '',
      selectionStatus: document.querySelector('[data-testid="delivery-hub-preview-selection-status"]')?.innerText || '',
    }
  })()`)

  if (!initial.previewVisible) fail("Delivery Hub preview block did not render when enabled.")
  if (!initial.existingShippingVisible) fail("Existing ApiShip/Medusa checkout contour is missing; preview must stay adjacent.")
  if (!initial.guardrails.includes("checkout source-of-truth unchanged")) fail("Source-of-truth guardrail is missing.")
  if (!initial.guardrails.includes("does not commit a Medusa shipping method")) fail("No-checkout-cutover guardrail is missing.")
  assertCutoverGate(initial.cutoverGate, expectedCutoverEnabled)
  assertCutoverPreconditions(initial.cutoverPreconditions)
  assertCutoverCandidate(initial.cutoverCandidate, "ready_for_review")
  assertCutoverApprovalArtifact(initial.approvalArtifact)
  assertNoUnsafeNeedles(initial.text, "initial enabled preview page")

  await evaluate(sessionId, "document.querySelector('[data-testid=\"delivery-hub-preview-get-quotes-button\"]').click()")
  await waitFor(sessionId, "document.querySelector('[data-testid=\"delivery-hub-preview-operation-status\"]')?.innerText.includes('ready')", "mocked quote ready status")

  const afterQuote = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    return {
      text,
      quoteCount: document.querySelector('[data-testid="delivery-hub-preview-quote-count"]')?.innerText || '',
      correlation: document.querySelector('[data-testid="delivery-hub-preview-quote-correlation-id"]')?.innerText || '',
      operationStatus: document.querySelector('[data-testid="delivery-hub-preview-operation-status"]')?.innerText || '',
      quoteList: document.querySelector('[data-testid="delivery-hub-preview-quotes-list"]')?.innerText || '',
      sourceOfTruth: document.querySelector('[data-testid="delivery-hub-preview-source-of-truth-status"]')?.innerText || '',
    }
  })()`)

  if (!afterQuote.quoteCount.includes("Quote count: 1")) fail("Mocked quote count was not visible.")
  if (!afterQuote.quoteList.includes("Neutral Carrier") || !afterQuote.quoteList.includes("RUB") && !afterQuote.quoteList.includes("₽")) fail("Mocked quote price/currency was not visible.")
  if (!afterQuote.correlation.includes(correlationId)) fail("Mocked quote correlation id was not visible.")
  if (!afterQuote.operationStatus.includes("ready")) fail("Quote operation status did not become ready.")
  if (!afterQuote.sourceOfTruth.includes("checkout source-of-truth unchanged")) fail("Source-of-truth status changed after quote.")
  assertNoUnsafeNeedles(afterQuote.text, "after mocked quote")

  await evaluate(sessionId, "document.querySelector('[data-testid=\"delivery-hub-preview-save-selection-button\"]').click()")
  await waitFor(sessionId, "document.querySelector('[data-testid=\"delivery-hub-preview-selection-status\"]')?.innerText.includes('saved')", "mocked selection saved status")

  const afterSave = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    return {
      text,
      selectionStatus: document.querySelector('[data-testid="delivery-hub-preview-selection-status"]')?.innerText || '',
      operationStatus: document.querySelector('[data-testid="delivery-hub-preview-operation-status"]')?.innerText || '',
      selectionCorrelation: document.querySelector('[data-testid="delivery-hub-preview-selection-correlation-id"]')?.innerText || '',
      sourceOfTruth: document.querySelector('[data-testid="delivery-hub-preview-source-of-truth-status"]')?.innerText || '',
      existingShippingVisible: text.includes('ApiShip/Medusa fallback shipping'),
      cutoverGate: document.querySelector('[data-testid="delivery-hub-cutover-gate-status"]')?.innerText || '',
      cutoverPreconditions: document.querySelector('[data-testid="delivery-hub-cutover-preconditions-status"]')?.innerText || '',
      cutoverCandidate: document.querySelector('[data-testid="delivery-hub-cutover-candidate-status"]')?.innerText || '',
      approvalArtifact: document.querySelector('[data-testid="delivery-hub-cutover-approval-artifact"]')?.innerText || '',
    }
  })()`)

  if (!afterSave.selectionStatus.includes("saved")) fail("Mocked selection save did not surface saved metadata status.")
  if (!afterSave.sourceOfTruth.includes("checkout source-of-truth unchanged")) fail("Source-of-truth status changed after save.")
  if (!afterSave.existingShippingVisible) fail("Existing ApiShip/Medusa checkout contour disappeared after save.")
  assertCutoverGate(afterSave.cutoverGate, expectedCutoverEnabled)
  assertCutoverPreconditions(afterSave.cutoverPreconditions)
  assertCutoverCandidate(afterSave.cutoverCandidate, "ready_for_review")
  assertCutoverApprovalArtifact(afterSave.approvalArtifact)
  assertNoUnsafeNeedles(afterSave.text, "after mocked selection save")

  await requestMockClearSelection()
  await delay(1000)

  const afterClear = await evaluate(sessionId, `(() => {
    const text = document.body.innerText
    return {
      text,
      sourceOfTruth: document.querySelector('[data-testid="delivery-hub-preview-source-of-truth-status"]')?.innerText || '',
      existingShippingVisible: text.includes('ApiShip/Medusa fallback shipping'),
    }
  })()`)

  if (!afterClear.sourceOfTruth.includes("checkout source-of-truth unchanged")) fail("Source-of-truth status changed after clear.")
  if (!afterClear.existingShippingVisible) fail("Existing ApiShip/Medusa checkout contour disappeared after clear.")
  assertNoUnsafeNeedles(afterClear.text, "after mocked selection clear")

  assertNoDeliveryHubCommitRequests(label)
  const requestedDeliveryHubRoutes = new Set(mockRequests
    .filter((entry) => entry.pathname.startsWith("/store/delivery/"))
    .map((entry) => `${entry.method} ${entry.pathname}`))
  for (const expectedRoute of [
    "GET /store/delivery/settings",
    "GET /store/delivery/selection",
    "GET /store/delivery/cutover-preconditions",
    "GET /store/delivery/cutover-candidate",
    "GET /store/delivery/cutover-approval-template",
    "POST /store/delivery/quotes",
    "POST /store/delivery/selection",
    "DELETE /store/delivery/selection",
  ]) {
    if (!requestedDeliveryHubRoutes.has(expectedRoute)) {
      fail(`${label} did not exercise expected mocked Delivery Hub route: ${expectedRoute}`)
    }
  }

  log(`${label} passed: quote/save/clear used mocked Store API responses and checkout contour stayed adjacent.`)
}

async function runRollbackDrillSequence(mockBackendUrl) {
  log("Starting rollback/fallback drill: flags off baseline -> preview on/cutover off -> preview on/cutover true -> flags off rollback.")

  mockSelection = buildSelectionFromBody({})
  let storefront = await startStorefront({ enabled: false, mockBackendUrl })
  await runDisabledCheck(storefront.url, "rollback drill all flags off baseline")
  await storefront.stop()
  nextProcess = null

  mockSelection = null
  storefront = await startStorefront({ enabled: true, cutoverEnabled: false, mockBackendUrl })
  await runEnabledFlow(storefront.url, { expectedCutoverEnabled: false, label: "rollback drill preview enabled cutover false" })
  await storefront.stop()
  nextProcess = null

  mockSelection = null
  storefront = await startStorefront({ enabled: true, cutoverEnabled: true, mockBackendUrl })
  await runEnabledFlow(storefront.url, { expectedCutoverEnabled: true, label: "rollback drill preview enabled cutover true pre-rollback" })
  await storefront.stop()
  nextProcess = null

  mockSelection = buildSelectionFromBody({})
  storefront = await startStorefront({ enabled: false, cutoverEnabled: false, mockBackendUrl })
  await runDisabledCheck(storefront.url, "rollback drill simulated flags-off rollback after cutover-true rehearsal")
  await storefront.stop()
  nextProcess = null

  log("Delivery Hub rollback/fallback drill passed: flags-off runs hide Delivery Hub artifacts, keep ApiShip/Medusa visible, and make no commit requests.")
}

function assertCutoverGate(text, expectedEnabled) {
  const gateText = String(text || "")
  if (!gateText.includes("NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED")) {
    fail("Cutover gate flag status is not visible in preview guardrails.")
  }
  if (!gateText.includes(`=${expectedEnabled ? "true" : "false"}`)) {
    fail(`Cutover gate did not reflect expected flag value ${expectedEnabled}.`)
  }
  if (!gateText.includes("canCommitShippingMethod=false")) {
    fail("Cutover gate did not preserve canCommitShippingMethod=false invariant.")
  }
  if (!gateText.includes("Commit blocked/preflight only")) {
    fail("Cutover gate did not visibly state commit blocked/preflight-only posture.")
  }
  if (expectedEnabled && !gateText.includes("preflight")) {
    fail("Cutover gate true run did not remain preflight-only.")
  }
  if (!expectedEnabled && !gateText.includes("default-off")) {
    fail("Cutover gate default run did not show default-off posture.")
  }
}

function assertCutoverCandidate(text, expectedStatus) {
  const candidateText = String(text || "")
  if (!candidateText.includes("Candidate planner: available")) {
    fail("Cutover candidate planner availability is not visible in preview guardrails.")
  }
  if (!candidateText.includes("candidate only / no checkout commit")) {
    fail("Cutover candidate planner did not state candidate-only/no-commit posture.")
  }
  if (!candidateText.includes("canCommitShippingMethod=false")) {
    fail("Cutover candidate planner did not preserve canCommitShippingMethod=false invariant.")
  }
  const statusSatisfied =
    candidateText.includes(expectedStatus) ||
    (expectedStatus === "ready_for_review" && candidateText.includes("ready for review")) ||
    (expectedStatus === "selection_missing" && candidateText.includes("selection missing"))
  if (!statusSatisfied) {
    fail(`Cutover candidate planner did not surface expected status ${expectedStatus}: ${candidateText}`)
  }
  if (expectedStatus === "ready_for_review" && !candidateText.includes(candidateShippingOptionId)) {
    fail("Cutover candidate planner did not surface safe candidate shipping option id.")
  }
}

function assertCutoverPreconditions(text) {
  const verifierText = String(text || "")
  if (!verifierText.includes("Preconditions verifier: available")) {
    fail("Cutover preconditions verifier availability is not visible in preview guardrails.")
  }
  if (!verifierText.includes("canCommitShippingMethod=false")) {
    fail("Cutover preconditions verifier did not preserve canCommitShippingMethod=false invariant.")
  }
  if (!verifierText.includes("operator_approval_required")) {
    fail("Cutover preconditions verifier did not surface operator approval as required.")
  }
  if (!verifierText.includes("shipment_lifecycle_not_enabled")) {
    fail("Cutover preconditions verifier did not surface shipment lifecycle as not enabled.")
  }
  if (!verifierText.includes("can_commit_shipping_method")) {
    fail("Cutover preconditions verifier did not surface commit blocker evidence.")
  }
}

function assertCutoverApprovalArtifact(text) {
  const artifactText = String(text || "")
  if (!artifactText.includes("Approval artifact: available")) {
    fail("Cutover approval artifact availability is not visible in preview guardrails.")
  }
  if (!artifactText.includes("Decision artifact only / no approval execution")) {
    fail("Cutover approval artifact did not state non-executable decision-only posture.")
  }
  if (!artifactText.includes("can_commit_shipping_method=false") || !artifactText.includes("canCommitShippingMethod=false")) {
    fail("Cutover approval artifact did not preserve commit false controls.")
  }
  if (!artifactText.includes("approval_is_executable=false")) {
    fail("Cutover approval artifact did not show approval_is_executable=false.")
  }
  if (!artifactText.includes("requires_separate_implementation=true")) {
    fail("Cutover approval artifact did not require separate implementation.")
  }
  if (!artifactText.includes("operator=pending") || !artifactText.includes("reviewer=pending")) {
    fail("Cutover approval artifact did not surface pending signoff placeholders.")
  }
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

function assertNoShipmentLifecycleActions(text, label) {
  const lowered = String(text || "").toLowerCase()
  const lifecycleNeedles = [
    "create shipment",
    "cancel shipment",
    "refresh status",
    "retry shipment",
    "retry execution",
    "shipment lifecycle",
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

  log("Delivery Hub preview browser smoke passed without live Yandex/backend and without checkout cutover.")
}

main()
  .catch((error) => {
    process.stderr.write(`[error] Delivery Hub preview browser smoke failed: ${error.message}\n`)
    process.exitCode = 1
  })
  .finally(cleanup)
