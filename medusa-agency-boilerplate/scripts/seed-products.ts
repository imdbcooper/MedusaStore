#!/usr/bin/env npx tsx
/**
 * Seed-скрипт для добавления IT-услуг в Medusa v2.
 *
 * Запуск локально:
 *   MEDUSA_ADMIN_EMAIL=admin@medusa-test.com MEDUSA_ADMIN_PASSWORD=supersecret \
 *     npx tsx scripts/seed-products.ts
 *
 * Запуск для staging:
 *   MEDUSA_BACKEND_URL=https://studio.slavx.ru \
 *   MEDUSA_ADMIN_EMAIL=admin@example.com MEDUSA_ADMIN_PASSWORD=xxx \
 *     npx tsx scripts/seed-products.ts
 *
 * Env:
 *   MEDUSA_BACKEND_URL  — URL бэкенда (default: http://localhost:9000)
 *   MEDUSA_ADMIN_EMAIL  — email администратора (обязательно)
 *   MEDUSA_ADMIN_PASSWORD — пароль администратора (обязательно)
 *   DRY_RUN=true        — только вывести план без создания
 */

import { COLLECTIONS } from "./seed-data/collections";
import { PRODUCTS, type ProductDefinition } from "./seed-data/products";

// ─── Config ──────────────────────────────────────────────────────────────────

const BACKEND_URL = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.MEDUSA_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD;
const DRY_RUN = process.env.DRY_RUN === "true";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[seed] ${msg}`);
}

function logError(msg: string) {
  console.error(`[seed:ERROR] ${msg}`);
}

async function adminRequest<T = unknown>(
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: T }> {
  const url = `${BACKEND_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }

  return { ok: res.ok, status: res.status, data };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function authenticate(): Promise<string> {
  log(`Authenticating as ${ADMIN_EMAIL} at ${BACKEND_URL}...`);

  const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { token?: string };
  if (!json.token) {
    throw new Error("Auth response missing token");
  }

  log("Authenticated successfully.");
  return json.token;
}

// ─── Region ──────────────────────────────────────────────────────────────────

interface RegionResponse {
  regions: { id: string; currency_code: string; countries: { iso_2: string }[] }[];
}

async function ensureRegion(token: string): Promise<string> {
  log("Checking for RU/RUB region...");

  const { data } = await adminRequest<RegionResponse>("GET", "/admin/regions", token);
  const existing = data.regions?.find(
    (r) => r.currency_code === "rub" && r.countries?.some((c) => c.iso_2 === "ru")
  );

  if (existing) {
    log(`Region found: ${existing.id}`);
    return existing.id;
  }

  log("Creating RU/RUB region...");
  const { ok, data: created } = await adminRequest<{ region: { id: string } }>(
    "POST",
    "/admin/regions",
    token,
    {
      name: "Russia",
      currency_code: "rub",
      countries: ["ru"],
    }
  );

  if (!ok || !created.region?.id) {
    throw new Error("Failed to create region");
  }

  log(`Region created: ${created.region.id}`);
  return created.region.id;
}

// ─── Sales Channel ───────────────────────────────────────────────────────────

interface SalesChannelResponse {
  sales_channels: { id: string; name: string }[];
}

async function ensureSalesChannel(token: string): Promise<string> {
  log("Checking for sales channel...");

  const { data } = await adminRequest<SalesChannelResponse>(
    "GET",
    "/admin/sales-channels",
    token
  );
  const existing = data.sales_channels?.[0];

  if (existing) {
    log(`Sales channel found: ${existing.id} (${existing.name})`);
    return existing.id;
  }

  log("Creating default sales channel...");
  const { ok, data: created } = await adminRequest<{ sales_channel: { id: string } }>(
    "POST",
    "/admin/sales-channels",
    token,
    { name: "Default Sales Channel", is_disabled: false }
  );

  if (!ok || !created.sales_channel?.id) {
    throw new Error("Failed to create sales channel");
  }

  log(`Sales channel created: ${created.sales_channel.id}`);
  return created.sales_channel.id;
}

// ─── Collections ─────────────────────────────────────────────────────────────

interface CollectionItem {
  id: string;
  handle: string;
  title: string;
}

interface CollectionsResponse {
  collections: CollectionItem[];
}

async function ensureCollections(token: string): Promise<Map<string, string>> {
  log("Ensuring collections...");

  const handleToId = new Map<string, string>();

  // Fetch existing
  const { data } = await adminRequest<CollectionsResponse>(
    "GET",
    "/admin/collections?limit=50",
    token
  );
  for (const col of data.collections || []) {
    handleToId.set(col.handle, col.id);
  }

  for (const col of COLLECTIONS) {
    if (handleToId.has(col.handle)) {
      log(`  ✓ Collection "${col.title}" already exists`);
      continue;
    }

    if (DRY_RUN) {
      log(`  [DRY] Would create collection: ${col.title}`);
      handleToId.set(col.handle, `dry-${col.handle}`);
      continue;
    }

    const { ok, data: created } = await adminRequest<{ collection: CollectionItem }>(
      "POST",
      "/admin/collections",
      token,
      { title: col.title, handle: col.handle }
    );

    if (ok && created.collection?.id) {
      handleToId.set(col.handle, created.collection.id);
      log(`  + Created collection: ${col.title}`);
    } else {
      logError(`  Failed to create collection: ${col.title}`);
    }
  }

  log(`Collections ready: ${handleToId.size}`);
  return handleToId;
}

// ─── Products ────────────────────────────────────────────────────────────────

interface ExistingProduct {
  id: string;
  handle: string;
}

interface ProductsListResponse {
  products: ExistingProduct[];
  count: number;
}

async function getExistingProductHandles(token: string): Promise<Set<string>> {
  const handles = new Set<string>();
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data } = await adminRequest<ProductsListResponse>(
      "GET",
      `/admin/products?limit=${limit}&offset=${offset}&fields=handle`,
      token
    );

    for (const p of data.products || []) {
      if (p.handle) handles.add(p.handle);
    }

    if (!data.products || data.products.length < limit) break;
    offset += limit;
  }

  return handles;
}

async function createProduct(
  token: string,
  product: ProductDefinition,
  collectionId: string | undefined,
  salesChannelId: string,
  regionId: string
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    title: product.title,
    subtitle: product.subtitle,
    handle: product.handle,
    description: product.description,
    status: product.status,
    is_giftcard: product.is_giftcard,
    metadata: product.metadata,
    options: product.options.map((o) => ({
      title: o.title,
      values: o.values,
    })),
    variants: product.variants.map((v) => ({
      title: v.title,
      manage_inventory: v.manage_inventory,
      options: v.options,
      prices: v.prices.map((p) => ({
        amount: p.amount,
        currency_code: p.currency_code,
      })),
    })),
    sales_channels: [{ id: salesChannelId }],
  };

  if (collectionId) {
    payload.collection_id = collectionId;
  }

  const { ok, status, data } = await adminRequest<{ product?: { id: string } }>(
    "POST",
    "/admin/products",
    token,
    payload
  );

  if (ok && data.product?.id) {
    return true;
  }

  logError(`  Failed to create "${product.handle}" (HTTP ${status}): ${JSON.stringify(data)}`);
  return false;
}

async function seedProducts(
  token: string,
  collectionMap: Map<string, string>,
  salesChannelId: string,
  regionId: string
): Promise<{ created: number; skipped: number; failed: number }> {
  log("Fetching existing products for idempotency check...");
  const existingHandles = await getExistingProductHandles(token);
  log(`Found ${existingHandles.size} existing products.`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of PRODUCTS) {
    if (existingHandles.has(product.handle)) {
      log(`  ✓ Skip (exists): ${product.handle}`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      log(`  [DRY] Would create: ${product.title} (${product.handle})`);
      created++;
      continue;
    }

    const collectionId = collectionMap.get(product.collection_handle);

    try {
      const success = await createProduct(token, product, collectionId, salesChannelId, regionId);
      if (success) {
        log(`  + Created: ${product.title}`);
        created++;
      } else {
        failed++;
      }
    } catch (err) {
      logError(`  Exception creating "${product.handle}": ${err}`);
      failed++;
    }
  }

  return { created, skipped, failed };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Medusa IT-Services Product Seed");
  console.log(`  Backend: ${BACKEND_URL}`);
  console.log(`  Products to seed: ${PRODUCTS.length}`);
  console.log(`  Collections: ${COLLECTIONS.length}`);
  if (DRY_RUN) console.log("  MODE: DRY RUN (no changes will be made)");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      "ERROR: MEDUSA_ADMIN_EMAIL and MEDUSA_ADMIN_PASSWORD env variables are required."
    );
    process.exit(1);
  }

  // 1. Authenticate
  const token = await authenticate();

  // 2. Ensure region
  const regionId = await ensureRegion(token);

  // 3. Ensure sales channel
  const salesChannelId = await ensureSalesChannel(token);

  // 4. Ensure collections
  const collectionMap = await ensureCollections(token);

  // 5. Seed products
  const result = await seedProducts(token, collectionMap, salesChannelId, regionId);

  // 6. Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log(`  Created: ${result.created}`);
  console.log(`  Skipped (already exist): ${result.skipped}`);
  console.log(`  Failed: ${result.failed}`);
  console.log("═══════════════════════════════════════════════════════════");

  if (result.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
