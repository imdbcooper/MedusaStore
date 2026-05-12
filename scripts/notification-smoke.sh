#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

DEFAULT_NOTIFICATION_SMOKE_TO="admin@example.com"
DEFAULT_NOTIFICATION_SMOKE_SUBJECT="Notification v1 smoke"
DEFAULT_NOTIFICATION_SMOKE_MESSAGE="Notification v1 smoke trigger completed."
DEFAULT_NOTIFICATION_SMOKE_API_KEY_ENV_NAME="NOTIFICATION_SMOKE_ADMIN_SECRET_API_KEY"

extract_secret_api_key() {
  local create_output="$1"
  local output_env_name="$2"

  CREATE_SECRET_OUTPUT="$create_output" OUTPUT_ENV_NAME="$output_env_name" node <<'NODE'
const text = process.env.CREATE_SECRET_OUTPUT || ""
const envName =
  process.env.OUTPUT_ENV_NAME || "NOTIFICATION_SMOKE_ADMIN_SECRET_API_KEY"
const escapedEnvName = envName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const match = text.match(new RegExp(`${escapedEnvName}=(sk_[A-Za-z0-9]+)`))
if (!match) {
  process.exit(1)
}
process.stdout.write(match[1])
NODE
}

encode_basic_auth() {
  local api_key="$1"

  ADMIN_SECRET_API_KEY="$api_key" node <<'NODE'
const apiKey = process.env.ADMIN_SECRET_API_KEY || ""
process.stdout.write(Buffer.from(`${apiKey}:`).toString("base64"))
NODE
}

build_payload() {
  local to="$1"
  local subject="$2"
  local message="$3"
  local dry_run="$4"

  NOTIFICATION_SMOKE_TO_VALUE="$to" \
  NOTIFICATION_SMOKE_SUBJECT_VALUE="$subject" \
  NOTIFICATION_SMOKE_MESSAGE_VALUE="$message" \
  NOTIFICATION_SMOKE_DRY_RUN_VALUE="$dry_run" node <<'NODE'
const payload = {
  to: process.env.NOTIFICATION_SMOKE_TO_VALUE || "",
  subject: process.env.NOTIFICATION_SMOKE_SUBJECT_VALUE || "",
  message: process.env.NOTIFICATION_SMOKE_MESSAGE_VALUE || "",
}

if (process.env.NOTIFICATION_SMOKE_DRY_RUN_VALUE === "true") {
  payload.dry_run = true
}

process.stdout.write(JSON.stringify(payload))
NODE
}

pretty_print_json() {
  local response_json="$1"

  RESPONSE_JSON="$response_json" node <<'NODE'
const text = process.env.RESPONSE_JSON || ""
try {
  const parsed = JSON.parse(text)
  process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`)
} catch {
  process.stdout.write(`${text}\n`)
}
NODE
}

log_info "Checking backend health before notification smoke..."
curl -fsS "${MEDUSA_BACKEND_URL}/health" >/dev/null

smoke_to="${NOTIFICATION_SMOKE_TO:-$DEFAULT_NOTIFICATION_SMOKE_TO}"
smoke_subject="${NOTIFICATION_SMOKE_SUBJECT:-$DEFAULT_NOTIFICATION_SMOKE_SUBJECT}"
smoke_message="${NOTIFICATION_SMOKE_MESSAGE:-$DEFAULT_NOTIFICATION_SMOKE_MESSAGE}"
smoke_dry_run="${NOTIFICATION_SMOKE_DRY_RUN:-false}"
create_key_timeout="${NOTIFICATION_SMOKE_CREATE_KEY_TIMEOUT:-60s}"
api_key_env_name="$DEFAULT_NOTIFICATION_SMOKE_API_KEY_ENV_NAME"
secret_api_key="${NOTIFICATION_SMOKE_ADMIN_SECRET_API_KEY:-}"
create_key_database_url="${BACKEND_DATABASE_URL:-}"
create_key_redis_url="${BACKEND_REDIS_URL:-}"

case "$smoke_dry_run" in
  true|false) ;;
  *)
    log_error "NOTIFICATION_SMOKE_DRY_RUN must be either true or false."
    exit 1
    ;;
esac

if [[ -n "$secret_api_key" ]]; then
  log_info "Using secret admin API key from ${api_key_env_name} for authenticated smoke..."
else
  if [[ -n "$create_key_database_url" || -n "$create_key_redis_url" ]]; then
    log_info "No ${api_key_env_name} provided; creating a fresh secret admin API key against explicit backend data-plane connection settings..."
    create_key_env=(env)

    if [[ -n "$create_key_database_url" ]]; then
      create_key_env+=("DATABASE_URL=$create_key_database_url")
    fi

    if [[ -n "$create_key_redis_url" ]]; then
      create_key_env+=("REDIS_URL=$create_key_redis_url")
    fi
  else
    log_info "No ${api_key_env_name} provided; creating a fresh secret admin API key from the synced local backend env..."
    create_key_env=(env -u DATABASE_URL -u REDIS_URL)
  fi

  set +e
  create_output="$(
    cd "$ROOT_DIR/medusa-agency-boilerplate" &&
      "${create_key_env[@]}" \
        ADMIN_SECRET_API_KEY_OUTPUT_ENV_NAME="$api_key_env_name" \
        timeout "$create_key_timeout" npm run admin:api-key:local --silent
  )"
  create_status=$?
  set -e

  if [[ "$create_status" -ne 0 ]]; then
    log_error "Failed to create a fresh secret admin API key for notification smoke."
    exit "$create_status"
  fi

  secret_api_key="$(extract_secret_api_key "$create_output" "$api_key_env_name" || true)"

  if [[ -z "$secret_api_key" ]]; then
    log_error "Notification smoke could not extract ${api_key_env_name} from helper output."
    exit 1
  fi
fi

basic_auth="$(encode_basic_auth "$secret_api_key")"
payload="$(build_payload "$smoke_to" "$smoke_subject" "$smoke_message" "$smoke_dry_run")"

if [[ "$smoke_dry_run" == "true" ]]; then
  log_info "Calling authenticated notification smoke route in dry-run mode..."
else
  log_info "Calling authenticated notification smoke route..."
fi

response="$(
  curl --fail-with-body -sS \
    -X POST "${MEDUSA_BACKEND_URL}/admin/notifications/smoke" \
    -H "Authorization: Basic ${basic_auth}" \
    -H "Content-Type: application/json" \
    --data "$payload"
)"

pretty_print_json "$response"
log_info "Notification smoke passed."
