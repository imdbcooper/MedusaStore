import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"

const ROOT = new URL("..", import.meta.url).pathname
const SRC = join(ROOT, "src")

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function read(path) {
  return readFileSync(join(ROOT, path), "utf8")
}

test("adapter exposes the expected copy-ready file structure", () => {
  const files = new Set(walk(SRC).map((path) => relative(ROOT, path)))

  for (const expected of [
    "src/api/store/assistant/chat/route.ts",
    "src/api/admin/assistant/reindex/route.ts",
    "src/api/admin/assistant/stats/route.ts",
    "src/api/admin/assistant/jobs/[id]/route.ts",
    "src/api/admin/assistant/reindex/process/route.ts",
    "src/api/admin/assistant/reindex/intents/route.ts",
    "src/api/middlewares.ts",
    "src/lib/assistant-client.ts",
    "src/lib/assistant-reindex-queue.ts",
    "src/lib/config.ts",
    "src/modules/assistant-runtime.ts",
    "src/workflows/assistant-reindex-product.ts",
    "src/workflows/assistant-reindex-all-products.ts",
    "src/subscribers/_assistant-product-event.ts",
    "src/subscribers/assistant-product-created.ts",
    "src/subscribers/assistant-product-updated.ts",
    "src/subscribers/assistant-product-deleted.ts",
    "src/subscribers/assistant-product-variant-updated.ts",
    "src/subscribers/assistant-product-category-updated.ts",
    "src/subscribers/assistant-product-collection-updated.ts",
  ]) {
    assert.ok(files.has(expected), `missing ${expected}`)
  }
})

test("env contract is explicit and server token is only used in backend client auth headers", () => {
  const config = read("src/lib/config.ts")
  assert.match(config, /AI_ASSISTANT_BASE_URL/)
  assert.match(config, /AI_ASSISTANT_SERVER_TOKEN/)
  assert.match(config, /AI_ASSISTANT_TIMEOUT_MS/)
  assert.match(config, /AI_ASSISTANT_ENABLED/)
  assert.match(config, /env\.AI_ASSISTANT_ENABLED === "true"/)
  assert.doesNotMatch(config, /\["1", "true", "yes", "on"\]/)

  const storeRoute = read("src/api/store/assistant/chat/route.ts")
  assert.doesNotMatch(storeRoute, /AI_ASSISTANT_SERVER_TOKEN/)
  assert.match(read("src/lib/assistant-client.ts"), /authorization: `Bearer \$\{this\.config\.serverToken\}`/)
})

test("routes point to assistant backend contract paths", () => {
  const client = read("src/lib/assistant-client.ts")
  assert.match(client, /"\/chat"/)
  assert.match(client, /"\/chat\/stream"/)
  assert.match(client, /"\/ingest\/medusa\/products\/sync"/)
  assert.match(client, /"\/admin\/stats"/)
  assert.match(client, /"\/admin\/sessions\/bind"/)
  assert.match(client, /"\/admin\/reindex\/intents"/)
  assert.match(client, /"\/admin\/reindex\/process"/)
  assert.match(client, /`\/ingest\/jobs\/\$\{encodeURIComponent\(jobId\)\}`/)
})

test("subscriber helper is enqueue-intent only and does not run reindex workflows", () => {
  const source = read("src/subscribers/_assistant-product-event.ts")
  assert.match(source, /assistant\.product_reindex\.intent/)
  assert.match(source, /enqueueAssistantReindexIntent/)
  assert.match(source, /coalescing_key/)
  assert.match(source, /broad_catalog_event/)
  assert.match(source, /void enqueueAssistantReindexIntent/)
  assert.doesNotMatch(source, /fetch\(/)
  assert.doesNotMatch(source, /client\.reindex/)
  assert.doesNotMatch(source, /requireAssistantBackendClient/)
  assert.doesNotMatch(source, /assistantReindex(AllProducts|Product)Workflow/)
  assert.doesNotMatch(source, /\.run\(/)
})

test("subscriber files enqueue intents instead of doing heavy indexing inline", () => {
  for (const file of [
    "src/subscribers/assistant-product-created.ts",
    "src/subscribers/assistant-product-updated.ts",
    "src/subscribers/assistant-product-deleted.ts",
    "src/subscribers/assistant-product-variant-updated.ts",
    "src/subscribers/assistant-product-category-updated.ts",
    "src/subscribers/assistant-product-collection-updated.ts",
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /fetch\(/)
    assert.doesNotMatch(source, /client\.reindex/)
    assert.doesNotMatch(source, /\.run\(/)
    assert.match(source, /enqueueAssistant(Product|AllProducts)Reindex/)
  }
})

test("store chat route does not forward browser-supplied cart_id or customer_id", () => {
  const storeRoute = read("src/api/store/assistant/chat/route.ts")
  assert.match(storeRoute, /cart_id: _untrustedCartId/)
  assert.match(storeRoute, /extractAuthenticatedCustomerId/)
  assert.match(storeRoute, /client\.bindSession/)
  assert.match(storeRoute, /source: "medusa_store_auth_context"/)
  assert.doesNotMatch(storeRoute, /cart_id: body\.cart_id/)
  assert.doesNotMatch(storeRoute, /cart_id: safeBody\.cart_id/)
  const payloadBlock = storeRoute.slice(storeRoute.indexOf("const payload ="), storeRoute.indexOf("try {"))
  assert.doesNotMatch(payloadBlock, /customer_id:/)
  assert.doesNotMatch(storeRoute, /customer_id: safeBody\.customer_id/)
})

test("admin selected-product reindex rejects empty product list", () => {
  const adminRoute = read("src/api/admin/assistant/reindex/route.ts")
  assert.match(adminRoute, /body\.scope === "products" && !body\.force && body\.product_ids\.length === 0/)
  assert.match(adminRoute, /AI_ASSISTANT_PRODUCT_IDS_REQUIRED/)
  assert.match(adminRoute, /product_ids must contain at least one product id/)
  assert.match(adminRoute, /res\.status\(400\)/)
})

test("admin reindex route queues durable intent instead of running workflows inline", () => {
  const adminRoute = read("src/api/admin/assistant/reindex/route.ts")
  assert.match(adminRoute, /enqueueReindexIntent/)
  assert.match(adminRoute, /queued: true/)
  assert.match(adminRoute, /coalescing_key/)
  assert.doesNotMatch(adminRoute, /\.run\(/)
  assert.doesNotMatch(adminRoute, /assistantReindex(AllProducts|Product)Workflow/)
})

test("queue processor/status routes are exposed", () => {
  const processRoute = read("src/api/admin/assistant/reindex/process/route.ts")
  const intentsRoute = read("src/api/admin/assistant/reindex/intents/route.ts")
  const middlewares = read("src/api/middlewares.ts")
  assert.match(processRoute, /processReindexQueue/)
  assert.match(intentsRoute, /listReindexIntents/)
  assert.match(middlewares, /\/admin\/assistant\/reindex\/process/)
  assert.match(middlewares, /\/admin\/assistant\/reindex\/intents/)
})
