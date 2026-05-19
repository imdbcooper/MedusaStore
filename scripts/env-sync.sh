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
payload_env="$ROOT_DIR/payload-cms/.env"
payload_example="$ROOT_DIR/payload-cms/.env.example"

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

ensure_payload_env_exists() {
  if [[ -f "$payload_env" ]]; then
    return
  fi

  if [[ -f "$payload_example" ]]; then
    cp "$payload_example" "$payload_env"
    log_info "Created payload env from template: ${payload_env#$ROOT_DIR/}"
    return
  fi

  : > "$payload_env"
  log_info "Created empty payload env: ${payload_env#$ROOT_DIR/}"
}

payload_database_url="${PAYLOAD_DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/payload_cms}"
payload_cms_url="${PAYLOAD_CMS_URL:-http://localhost:${PAYLOAD_PORT:-3100}}"

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
upsert_env_value "$backend_env" "UNISENDER_API_KEY" "${UNISENDER_API_KEY:-}"
upsert_env_value "$backend_env" "UNISENDER_BASE_URL" "${UNISENDER_BASE_URL:-}"
upsert_env_value "$backend_env" "SMTP_HOST" "${SMTP_HOST:-}"
upsert_env_value "$backend_env" "SMTP_PORT" "${SMTP_PORT:-587}"
upsert_env_value "$backend_env" "SMTP_SECURE" "${SMTP_SECURE:-false}"
upsert_env_value "$backend_env" "SMTP_USER" "${SMTP_USER:-}"
upsert_env_value "$backend_env" "SMTP_PASSWORD" "${SMTP_PASSWORD:-}"
upsert_env_value "$backend_env" "SMTP_FROM" "${SMTP_FROM:-}"
upsert_env_value "$backend_env" "SMTP_FROM_NAME" "${SMTP_FROM_NAME:-}"
upsert_env_value "$backend_env" "SMTP_REPLY_TO" "${SMTP_REPLY_TO:-}"
upsert_env_value "$backend_env" "SMTP_TLS_REJECT_UNAUTHORIZED" "${SMTP_TLS_REJECT_UNAUTHORIZED:-true}"
upsert_env_value "$backend_env" "BRAND_NAME" "${BRAND_NAME:-}"
upsert_env_value "$backend_env" "BRAND_LOGO_URL" "${BRAND_LOGO_URL:-}"
upsert_env_value "$backend_env" "BRAND_PRIMARY_COLOR" "${BRAND_PRIMARY_COLOR:-}"
upsert_env_value "$backend_env" "BRAND_ACCENT_COLOR" "${BRAND_ACCENT_COLOR:-}"
upsert_env_value "$backend_env" "BRAND_TEXT_COLOR" "${BRAND_TEXT_COLOR:-}"
upsert_env_value "$backend_env" "BRAND_BACKGROUND_COLOR" "${BRAND_BACKGROUND_COLOR:-}"
upsert_env_value "$backend_env" "BRAND_FOOTER_HTML" "${BRAND_FOOTER_HTML:-}"
upsert_env_value "$backend_env" "NOTIFICATION_VK_PROVIDER" "${NOTIFICATION_VK_PROVIDER:-disabled}"
upsert_env_value "$backend_env" "VK_COMMUNITY_ACCESS_TOKEN" "${VK_COMMUNITY_ACCESS_TOKEN:-}"
upsert_env_value "$backend_env" "VK_COMMUNITY_GROUP_ID" "${VK_COMMUNITY_GROUP_ID:-}"
upsert_env_value "$backend_env" "VK_API_VERSION" "${VK_API_VERSION:-}"
upsert_env_value "$backend_env" "VK_ID_ENABLED" "${VK_ID_ENABLED:-false}"
upsert_env_value "$backend_env" "VK_ID_CLIENT_ID" "${VK_ID_CLIENT_ID:-}"
upsert_env_value "$backend_env" "VK_ID_CLIENT_SECRET" "${VK_ID_CLIENT_SECRET:-}"
upsert_env_value "$backend_env" "VK_ID_REDIRECT_URI" "${VK_ID_REDIRECT_URI:-}"
upsert_env_value "$backend_env" "VK_ID_SCOPES" "${VK_ID_SCOPES:-}"
upsert_env_value "$backend_env" "VK_ID_SESSION_SECRET" "${VK_ID_SESSION_SECRET:-}"
upsert_env_value "$backend_env" "VK_ID_STOREFRONT_RETURN_ORIGINS" "${VK_ID_STOREFRONT_RETURN_ORIGINS:-http://localhost:${STOREFRONT_PORT}}"
upsert_env_value "$backend_env" "YOOKASSA_SHOP_ID" "${YOOKASSA_SHOP_ID:-}"
upsert_env_value "$backend_env" "YOOKASSA_SECRET_KEY" "${YOOKASSA_SECRET_KEY:-}"
upsert_env_value "$backend_env" "YOOKASSA_RETURN_URL" "${YOOKASSA_RETURN_URL:-}"
upsert_env_value "$backend_env" "YOOKASSA_STOREFRONT_RETURN_ORIGINS" "${YOOKASSA_STOREFRONT_RETURN_ORIGINS:-http://localhost:${STOREFRONT_PORT}}"
upsert_env_value "$backend_env" "YOOKASSA_WEBHOOK_URL" "${YOOKASSA_WEBHOOK_URL:-}"
upsert_env_value "$backend_env" "YOOKASSA_WEBHOOK_SECRET" "${YOOKASSA_WEBHOOK_SECRET:-}"
upsert_env_value "$backend_env" "YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS" "${YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS:-false}"
upsert_env_value "$backend_env" "STOREFRONT_URL" "${STOREFRONT_URL:-http://localhost:${STOREFRONT_PORT}}"
upsert_env_value "$backend_env" "STOREFRONT_REVALIDATE_SECRET" "${STOREFRONT_REVALIDATE_SECRET:-${REVALIDATE_SECRET:-}}"
upsert_env_value "$backend_env" "AI_ASSISTANT_ENABLED" "${AI_ASSISTANT_ENABLED:-false}"
upsert_env_value "$backend_env" "AI_ASSISTANT_BASE_URL" "${AI_ASSISTANT_BASE_URL:-}"
upsert_env_value "$backend_env" "AI_ASSISTANT_SERVER_TOKEN" "${AI_ASSISTANT_SERVER_TOKEN:-}"
upsert_env_value "$backend_env" "AI_ASSISTANT_TIMEOUT_MS" "${AI_ASSISTANT_TIMEOUT_MS:-60000}"
upsert_env_value "$backend_env" "ASSISTANT_SETTINGS_ENCRYPTION_KEY" "${ASSISTANT_SETTINGS_ENCRYPTION_KEY:-}"
upsert_env_value "$backend_env" "REVIEWS_CAPTCHA_PROVIDER" "${REVIEWS_CAPTCHA_PROVIDER:-none}"
upsert_env_value "$backend_env" "MEDUSA_ADMIN_SECRET_API_KEY" "${MEDUSA_ADMIN_SECRET_API_KEY:-}"
upsert_env_value "$backend_env" "S3_FILE_URL" "${S3_FILE_URL:-}"
upsert_env_value "$backend_env" "S3_ACCESS_KEY_ID" "${S3_ACCESS_KEY_ID:-}"
upsert_env_value "$backend_env" "S3_SECRET_ACCESS_KEY" "${S3_SECRET_ACCESS_KEY:-}"
upsert_env_value "$backend_env" "S3_REGION" "${S3_REGION:-us-east-1}"
upsert_env_value "$backend_env" "S3_BUCKET" "${S3_BUCKET:-}"
upsert_env_value "$backend_env" "S3_ENDPOINT" "${S3_ENDPOINT:-}"

ensure_storefront_env_exists

log_info "Syncing storefront env with root orchestration values..."
upsert_env_value "$storefront_env" "MEDUSA_BACKEND_URL" "$MEDUSA_BACKEND_URL"
upsert_env_value "$storefront_env" "MEDUSA_BACKEND_PORT" "${MEDUSA_BACKEND_PORT:-9000}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_BACKEND_URL" "${NEXT_PUBLIC_MEDUSA_BACKEND_URL:-$MEDUSA_BACKEND_URL}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_BACKEND_PORT" "${NEXT_PUBLIC_MEDUSA_BACKEND_PORT:-${MEDUSA_BACKEND_PORT:-9000}}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_BASE_URL" "$NEXT_PUBLIC_BASE_URL"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_DEFAULT_REGION" "${NEXT_PUBLIC_DEFAULT_REGION:-ru}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_STOREFRONT_PRESET" "${NEXT_PUBLIC_STOREFRONT_PRESET:-atelier}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_YOOKASSA_ENABLED" "${NEXT_PUBLIC_YOOKASSA_ENABLED:-$([[ -n "${YOOKASSA_SHOP_ID:-}" && -n "${YOOKASSA_SECRET_KEY:-}" && -n "${YOOKASSA_RETURN_URL:-}" ]] && echo true || echo false)}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_VK_ID_ENABLED" "${NEXT_PUBLIC_VK_ID_ENABLED:-$([[ "${VK_ID_ENABLED:-false}" == "true" && -n "${VK_ID_CLIENT_ID:-}" && -n "${VK_ID_REDIRECT_URI:-}" ]] && echo true || echo false)}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED" "${NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED:-false}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT" "${NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT:-/store/assistant/chat}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_STRIPE_KEY" "${NEXT_PUBLIC_STRIPE_KEY:-}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY" "${NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY:-}"
upsert_env_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID" "${NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID:-}"
upsert_env_value "$storefront_env" "PAYLOAD_ENABLED" "${PAYLOAD_ENABLED:-false}"
upsert_env_value "$storefront_env" "PAYLOAD_CMS_URL" "${PAYLOAD_CMS_URL:-http://localhost:${PAYLOAD_PORT:-3100}}"
upsert_env_value "$storefront_env" "PAYLOAD_CONTENT_PREVIEW_TOKEN" "${PAYLOAD_CONTENT_PREVIEW_TOKEN:-}"
upsert_env_value "$storefront_env" "PAYLOAD_PREVIEW_SECRET" "${PAYLOAD_PREVIEW_SECRET:-}"
upsert_env_value "$storefront_env" "PAYLOAD_REVALIDATE_SECRET" "${PAYLOAD_REVALIDATE_SECRET:-}"
upsert_env_value "$storefront_env" "REVALIDATE_SECRET" "${REVALIDATE_SECRET:-${STOREFRONT_REVALIDATE_SECRET:-}}"
upsert_env_value "$storefront_env" "MEDUSA_CLOUD_S3_HOSTNAME" "${MEDUSA_CLOUD_S3_HOSTNAME:-}"
upsert_env_value "$storefront_env" "MEDUSA_CLOUD_S3_PATHNAME" "${MEDUSA_CLOUD_S3_PATHNAME:-}"

ensure_payload_env_exists

log_info "Syncing payload-cms env with root orchestration values..."
upsert_env_value "$payload_env" "PAYLOAD_PORT" "${PAYLOAD_PORT:-3100}"
upsert_env_value "$payload_env" "PAYLOAD_PUBLIC_SERVER_URL" "${PAYLOAD_PUBLIC_SERVER_URL:-$payload_cms_url}"
upsert_env_value "$payload_env" "PAYLOAD_CMS_URL" "$payload_cms_url"
upsert_env_value "$payload_env" "DATABASE_URL" "$payload_database_url"
upsert_env_value "$payload_env" "PAYLOAD_DATABASE_URL" "$payload_database_url"
upsert_env_value "$payload_env" "PAYLOAD_SECRET" "${PAYLOAD_SECRET:-CHANGE_ME_PAYLOAD_SECRET}"
upsert_env_value "$payload_env" "PAYLOAD_CONTENT_PREVIEW_TOKEN" "${PAYLOAD_CONTENT_PREVIEW_TOKEN:-CHANGE_ME_PAYLOAD_CONTENT_PREVIEW_TOKEN}"
upsert_env_value "$payload_env" "PAYLOAD_PREVIEW_SECRET" "${PAYLOAD_PREVIEW_SECRET:-CHANGE_ME_PAYLOAD_PREVIEW_SECRET}"
upsert_env_value "$payload_env" "PAYLOAD_REVALIDATE_SECRET" "${PAYLOAD_REVALIDATE_SECRET:-CHANGE_ME_PAYLOAD_REVALIDATE_SECRET}"
upsert_env_value "$payload_env" "STOREFRONT_PREVIEW_URL" "${STOREFRONT_PREVIEW_URL:-http://localhost:${STOREFRONT_PORT}}"
upsert_env_value "$payload_env" "STOREFRONT_PREVIEW_LOCALE" "${STOREFRONT_PREVIEW_LOCALE:-ru}"
upsert_env_value "$payload_env" "STOREFRONT_REVALIDATE_URL" "${STOREFRONT_REVALIDATE_URL:-http://localhost:${STOREFRONT_PORT}/api/content/revalidate}"
upsert_env_value "$payload_env" "PAYLOAD_CORS" "${PAYLOAD_CORS:-http://localhost:${STOREFRONT_PORT}}"
upsert_env_value "$payload_env" "PAYLOAD_CSRF" "${PAYLOAD_CSRF:-$payload_cms_url}"
upsert_env_value "$payload_env" "MEDUSA_BACKEND_URL" "$MEDUSA_BACKEND_URL"
upsert_env_value "$payload_env" "MEDUSA_ADMIN_SECRET_API_KEY" "${MEDUSA_ADMIN_SECRET_API_KEY:-}"

if ! env_file_has_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"; then
  upsert_env_value "$storefront_env" "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY" "REPLACE_WITH_ROOT_BOOTSTRAP"
fi

log_info "Application env sync completed."
log_info "Backend env: ${backend_env#$ROOT_DIR/}"
log_info "Storefront env: ${storefront_env#$ROOT_DIR/}"
log_info "Payload env: ${payload_env#$ROOT_DIR/}"
