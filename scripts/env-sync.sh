#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  log_error "Missing root .env: $ROOT_DIR/.env"
  log_error "Create it from .env.example before syncing application env files."
  exit 1
fi

backend_env="$ROOT_DIR/medusa-agency-boilerplate/.env"
storefront_env="$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local"
storefront_example="$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local.example"

upsert_env_value() {
  local file_path="$1"
  local key="$2"
  local value="$3"

  ENV_FILE="$file_path" ENV_KEY="$key" ENV_VALUE="$value" node <<'NODE'
const fs = require("fs")
const path = require("path")

const filePath = process.env.ENV_FILE
const key = process.env.ENV_KEY
const value = process.env.ENV_VALUE ?? ""
const line = `${key}=${value}`

fs.mkdirSync(path.dirname(filePath), { recursive: true })

let content = ""
if (fs.existsSync(filePath)) {
  content = fs.readFileSync(filePath, "utf8")
}

const rows = content === "" ? [] : content.split(/\r?\n/)
let updated = false

const nextRows = rows.map((row) => {
  if (row.startsWith(`${key}=`)) {
    updated = true
    return line
  }

  return row
})

if (!updated) {
  nextRows.push(line)
}

const normalized = nextRows
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/^\n+/, "")

fs.writeFileSync(filePath, `${normalized.replace(/\n*$/, "")}\n`)
NODE
}

ensure_storefront_env_exists() {
  if [[ -f "$storefront_env" ]]; then
    return
  fi

  if [[ -f "$storefront_example" ]]; then
    cp "$storefront_example" "$storefront_env"
    log_info "Created storefront env from template: ${storefront_env#$ROOT_DIR/}"
    return
  fi

  : > "$storefront_env"
  log_info "Created empty storefront env: ${storefront_env#$ROOT_DIR/}"
}

log_info "Syncing backend env with root orchestration values..."
upsert_env_value "$backend_env" "DATABASE_URL" "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
upsert_env_value "$backend_env" "REDIS_URL" "redis://localhost:${REDIS_PORT}"
upsert_env_value "$backend_env" "STORE_CORS" "http://localhost:${STOREFRONT_PORT},https://docs.medusajs.com"
upsert_env_value "$backend_env" "ADMIN_CORS" "http://localhost:5173,${MEDUSA_BACKEND_URL},https://docs.medusajs.com"
upsert_env_value "$backend_env" "AUTH_CORS" "http://localhost:5173,${MEDUSA_BACKEND_URL},http://localhost:${STOREFRONT_PORT},https://docs.medusajs.com"
upsert_env_value "$backend_env" "JWT_SECRET" "$JWT_SECRET"
upsert_env_value "$backend_env" "COOKIE_SECRET" "$COOKIE_SECRET"
upsert_env_value "$backend_env" "NOTIFICATION_EMAIL_PROVIDER" "${NOTIFICATION_EMAIL_PROVIDER:-local}"
upsert_env_value "$backend_env" "NOTIFICATION_EMAIL_FROM" "${NOTIFICATION_EMAIL_FROM:-notifications@example.com}"
upsert_env_value "$backend_env" "SENDGRID_API_KEY" "${SENDGRID_API_KEY:-}"
upsert_env_value "$backend_env" "APISHIP_TOKEN" "${APISHIP_TOKEN:-}"
upsert_env_value "$backend_env" "APISHIP_TEST_MODE" "${APISHIP_TEST_MODE:-true}"
upsert_env_value "$backend_env" "YOOKASSA_SHOP_ID" "${YOOKASSA_SHOP_ID:-}"
upsert_env_value "$backend_env" "YOOKASSA_SECRET_KEY" "${YOOKASSA_SECRET_KEY:-}"
upsert_env_value "$backend_env" "YOOKASSA_RETURN_URL" "${YOOKASSA_RETURN_URL:-}"
upsert_env_value "$backend_env" "YOOKASSA_STOREFRONT_RETURN_ORIGINS" "${YOOKASSA_STOREFRONT_RETURN_ORIGINS:-http://localhost:${STOREFRONT_PORT}}"
upsert_env_value "$backend_env" "YOOKASSA_WEBHOOK_URL" "${YOOKASSA_WEBHOOK_URL:-}"
upsert_env_value "$backend_env" "YOOKASSA_WEBHOOK_SECRET" "${YOOKASSA_WEBHOOK_SECRET:-}"
upsert_env_value "$backend_env" "YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS" "${YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS:-false}"

ensure_storefront_env_exists

log_info "Syncing storefront env with root orchestration values..."
upsert_env_value "$storefront_env" "MEDUSA_BACKEND_URL" "$MEDUSA_BACKEND_URL"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_BASE_URL" "$NEXT_PUBLIC_BASE_URL"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_DEFAULT_REGION" "ru"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_YOOKASSA_ENABLED" "$([[ -n "${YOOKASSA_SHOP_ID:-}" && -n "${YOOKASSA_SECRET_KEY:-}" && -n "${YOOKASSA_RETURN_URL:-}" ]] && echo true || echo false)"

if ! env_file_has_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"; then
  upsert_env_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY" "REPLACE_WITH_ROOT_BOOTSTRAP"
fi

log_info "Application env sync completed."
log_info "Backend env: ${backend_env#$ROOT_DIR/}"
log_info "Storefront env: ${storefront_env#$ROOT_DIR/}"
