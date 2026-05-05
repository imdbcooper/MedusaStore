#!/usr/bin/env node
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

const evidence = []

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8")
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath))
}

function listCommittedFiles(prefix) {
  const gitIndexPath = path.join(repoRoot, ".git/index")
  if (!fs.existsSync(gitIndexPath)) {
    return []
  }

  return execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", prefix], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function pass(name, details) {
  evidence.push({ name, details })
  console.log(`ok - ${name}`)
}

function assertContains(source, fragment, message) {
  assert.ok(source.includes(fragment), message ?? `Expected source to include ${fragment}`)
}

function assertNotContains(source, fragment, message) {
  assert.ok(!source.includes(fragment), message ?? `Expected source not to include ${fragment}`)
}

function assertCommittedRuntimeDeliveryFacadeQuarantined() {
  const committedApiFiles = listCommittedFiles("medusa-agency-boilerplate/src/api")
  const committedDeliveryRouteFiles = committedApiFiles.filter((file) =>
    /\/src\/api\/(store|admin)\/delivery\//.test(file)
  )
  const committedStoreDeliveryRouteFiles = committedDeliveryRouteFiles.filter((file) =>
    /\/src\/api\/store\/delivery\//.test(file)
  )
  const middlewares = readText("medusa-agency-boilerplate/src/api/middlewares.ts")
  const quarantineMatchers = [
    "/store/delivery/catalog",
    "/store/delivery/settings",
    "/store/delivery/cutover-preconditions",
    "/store/delivery/cutover-candidate",
    "/store/delivery/cutover-approval-template",
    "/store/delivery/quotes",
    "/store/delivery/pickup-points",
    "/store/delivery/pickup-windows",
    "/store/delivery/selection",
    "/store/delivery/readiness",
    "/store/delivery/selection/commit",
  ]

  assert.deepEqual(
    committedStoreDeliveryRouteFiles,
    [],
    `Committed public /store/delivery/* route files must remain physically absent: ${committedStoreDeliveryRouteFiles.join(", ")}`
  )

  for (const matcher of quarantineMatchers) {
    const matcherIndex = middlewares.indexOf(`matcher: "${matcher}"`)
    assert.ok(matcherIndex >= 0, `${matcher} must stay explicitly quarantined`)
    const routeBlock = middlewares.slice(matcherIndex, matcherIndex + 220)
    assertContains(routeBlock, "enforceDeliveryHubRuntimeQuarantine")
  }

  pass("committed Delivery Hub public runtime facade remains absent/quarantined", {
    checkedPrefix: "medusa-agency-boilerplate/src/api",
    committedDeliveryRouteFiles,
    committedStoreDeliveryRouteFiles,
    quarantineMatchers,
  })
}

function assertBackendRuntimeWiring() {
  const medusaConfig = readText("medusa-agency-boilerplate/medusa-config.ts")
  const middlewares = readText("medusa-agency-boilerplate/src/api/middlewares.ts")
  const diagnosticsRoute = readText(
    "medusa-agency-boilerplate/src/api/admin/apiship/diagnostics/route.ts"
  )
  const diagnosticsModule = readText(
    "medusa-agency-boilerplate/src/modules/apiship-operator-diagnostics.ts"
  )
  const readinessModule = readText(
    "medusa-agency-boilerplate/src/modules/apiship-checkout-readiness.ts"
  )
  const shipmentGuardModule = readText(
    "medusa-agency-boilerplate/src/modules/apiship-shipment-execution-guard.ts"
  )
  const quarantineModule = readText(
    "medusa-agency-boilerplate/src/modules/delivery-hub-runtime-quarantine.ts"
  )

  assertContains(
    medusaConfig,
    '"@gorgo/medusa-fulfillment-apiship/providers/fulfillment-apiship"',
    "ApiShip/Gorgo provider module must stay registered"
  )
  assertContains(medusaConfig, 'const APISHIP_FULFILLMENT_PROVIDER_CODE = "apiship"')
  assertContains(medusaConfig, "id: APISHIP_FULFILLMENT_PROVIDER_CODE")

  assertContains(
    middlewares,
    'matcher: "/store/payment-collections/:id/payment-sessions"',
    "checkout payment-session readiness middleware must stay wired"
  )
  assertContains(
    middlewares,
    "enforceApishipCheckoutReadinessForPaymentSession",
    "payment-session readiness guard must stay wired"
  )
  assertContains(
    middlewares,
    'matcher: "/store/carts/:id/complete"',
    "cart-completion readiness middleware must stay wired"
  )
  assertContains(
    middlewares,
    "enforceApishipCheckoutReadinessForCartCompletion",
    "cart-completion readiness guard must stay wired"
  )

  assertContains(middlewares, 'matcher: "/admin/fulfillments"')
  assertContains(middlewares, 'matcher: "/admin/orders/:id/fulfillments"')
  assertContains(middlewares, "enforceApishipDirectFulfillmentCreateExecutionGuard")
  assertContains(middlewares, "enforceApishipOrderFulfillmentCreateExecutionGuard")

  assertContains(middlewares, 'matcher: "/admin/apiship/diagnostics"')
  assertContains(middlewares, "middlewares: [adminAuth]")
  assertContains(diagnosticsRoute, "buildApishipOperatorDiagnosticsSnapshot")
  assertContains(diagnosticsModule, "redacted: true")
  assertContains(diagnosticsModule, "external_apiship_health_call: false")
  assertContains(diagnosticsModule, "live_shipment_execution: false")
  assertContains(diagnosticsModule, "online_auth_validation: false")
  assertContains(diagnosticsModule, "sensitive_values_returned: false")
  assertContains(diagnosticsModule, "assertApishipOperatorDiagnosticsSecretSafe")
  assertContains(diagnosticsModule, '"authorization"')
  assertContains(diagnosticsModule, '"bearer "')

  assertContains(readinessModule, "APISHIP_CHECKOUT_READINESS_ERROR_CODE")
  assertContains(readinessModule, "apishipData")
  assertContains(readinessModule, "pickup_point_id_missing")
  assertContains(shipmentGuardModule, "APISHIP_SHIPMENT_EXECUTION_ENABLED")
  assertContains(shipmentGuardModule, '?.trim() === "true"')
  assertContains(shipmentGuardModule, "ApiShip shipment execution is disabled by default")

  assertContains(quarantineModule, "DELIVERY_HUB_RUNTIME_QUARANTINE_STATUS = 410")
  assertContains(quarantineModule, "baseline: \"apiship_gorgo\"")
  assertContains(quarantineModule, "previous_baseline: \"delivery_hub\"")
  assertContains(quarantineModule, "live_shipment_execution_enabled: false")

  pass("backend runtime wiring, guards, diagnostics, and quarantine are present", {
    config: "medusa-agency-boilerplate/medusa-config.ts",
    middlewares: "medusa-agency-boilerplate/src/api/middlewares.ts",
    diagnostics: "medusa-agency-boilerplate/src/api/admin/apiship/diagnostics/route.ts",
  })
}

function assertStorefrontRuntimeWiring() {
  const apishipDataHelper = readText("medusa-agency-boilerplate-storefront/src/lib/data/apiship.ts")
  const apishipUtil = readText("medusa-agency-boilerplate-storefront/src/lib/util/apiship.ts")
  const deliveryCheckoutUtil = readText(
    "medusa-agency-boilerplate-storefront/src/lib/util/delivery-checkout.ts"
  )
  const checkoutTemplate = readText(
    "medusa-agency-boilerplate-storefront/src/modules/checkout/templates/checkout-form/index.tsx"
  )
  const paymentButton = readText(
    "medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment-button/index.tsx"
  )
  const payment = readText(
    "medusa-agency-boilerplate-storefront/src/modules/checkout/components/payment/index.tsx"
  )
  const review = readText(
    "medusa-agency-boilerplate-storefront/src/modules/checkout/components/review/index.tsx"
  )
  const shipping = readText(
    "medusa-agency-boilerplate-storefront/src/modules/checkout/components/shipping/index.tsx"
  )

  assertContains(apishipUtil, 'APISHIP_STORE_API_PREFIX = "/store/apiship"')
  assertContains(apishipDataHelper, "`${APISHIP_STORE_API_PREFIX}/providers`")
  assertContains(apishipDataHelper, "`${APISHIP_STORE_API_PREFIX}/points`")
  assertContains(apishipDataHelper, "`${APISHIP_STORE_API_PREFIX}/${shippingOptionId}/calculate`")
  assertContains(apishipDataHelper, "setShippingMethod")
  assertContains(apishipDataHelper, "shapeApishipAddShippingMethodData")
  assertContains(apishipUtil, "apishipData")
  assertContains(apishipUtil, "isApishipCheckoutReady")
  assertContains(apishipUtil, "isApishipShippingMethodReady")
  assertContains(apishipUtil, "getApishipDataFromShippingMethod")
  assertContains(apishipUtil, "customerPricePolicy")
  assertNotContains(apishipDataHelper, "/store/delivery")

  assertContains(deliveryCheckoutUtil, 'DELIVERY_CHECKOUT_PROVIDER_APISHIP = "apiship"')
  assertContains(deliveryCheckoutUtil, "getApishipDataFromShippingMethod")
  assertContains(deliveryCheckoutUtil, "normalizeApishipTariffForCheckout")
  assertContains(deliveryCheckoutUtil, "pickup_point_missing")
  assertContains(deliveryCheckoutUtil, "context_mismatch")
  assertContains(deliveryCheckoutUtil, "buildDeliveryCheckoutSummary")

  assertContains(paymentButton, "isDeliveryCheckoutReady")
  assertContains(paymentButton, "Выберите и сохраните валидную доставку ApiShip")
  assertContains(payment, "isDeliveryCheckoutReady")
  assertContains(payment, "router.replace")
  assertContains(payment, "step", "payment component must keep step guard wiring")
  assertContains(review, "PaymentButton")
  assertContains(checkoutTemplate, "<Shipping")
  assertContains(checkoutTemplate, "<Payment")
  assertContains(checkoutTemplate, "<Review")

  assertContains(shipping, "isDeliveryCheckoutReady")
  assertContains(shipping, "listApishipProviders")
  assertContains(shipping, "listApishipPoints")
  assertContains(shipping, "calculateApishipShippingOption")
  assertContains(shipping, "addApishipShippingMethodToCart")
  assertContains(shipping, "data-testid=\"apiship-customer-delivery-card\"")
  assertContains(shipping, "data-testid=\"apiship-pickup-point-selector\"")
  assertContains(shipping, "data-testid=\"apiship-tariff-selector\"")
  assertNotContains(shipping, "delivery-hub")
  assertNotContains(shipping, "/store/delivery")

  pass("storefront checkout projects ApiShip helpers and readiness without Delivery Hub facade", {
    helpers: "medusa-agency-boilerplate-storefront/src/lib/data/apiship.ts",
    util: "medusa-agency-boilerplate-storefront/src/lib/util/apiship.ts",
    providerNeutralReadiness: "medusa-agency-boilerplate-storefront/src/lib/util/delivery-checkout.ts",
    checkout: "medusa-agency-boilerplate-storefront/src/modules/checkout",
  })
}

function assertSmokePrerequisitesDocumented() {
  assert.ok(exists("Docs/apiship_baseline_smoke_evidence.md"))
  const evidenceDoc = readText("Docs/apiship_baseline_smoke_evidence.md")
  assertContains(evidenceDoc, "Browser/runtime smoke posture")
  assertContains(evidenceDoc, "preflight-only")
  assertContains(evidenceDoc, "no live ApiShip credentials")
  assertContains(evidenceDoc, "no external ApiShip")
  pass("browser/runtime smoke evidence document records preflight-only posture", {
    evidence: "Docs/apiship_baseline_smoke_evidence.md",
  })
}

function main() {
  assertCommittedRuntimeDeliveryFacadeQuarantined()
  assertBackendRuntimeWiring()
  assertStorefrontRuntimeWiring()
  assertSmokePrerequisitesDocumented()

  console.log("\nApiShip runtime preflight smoke passed")
  console.log(JSON.stringify({ ok: true, checks: evidence }, null, 2))
}

main()
