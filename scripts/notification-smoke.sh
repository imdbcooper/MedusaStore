#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

DEFAULT_NOTIFICATION_SMOKE_TO="admin@example.com"
DEFAULT_NOTIFICATION_SMOKE_SUBJECT="Notification v1 smoke"
DEFAULT_NOTIFICATION_SMOKE_MESSAGE="Notification v1 smoke trigger completed."

extract_secret_api_key() {
  local create_output="$1"

  CREATE_SECRET_OUTPUT="$create_output" node <<'NODE'
const text = process.env.CREATE_SECRET_OUTPUT || ""
const match = text.match(/ROOT_LOCAL_ADMIN_SECRET_API_KEY=([^\s]+)/)
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

  NOTIFICATION_SMOKE_TO_VALUE="$to" \
  NOTIFICATION_SMOKE_SUBJECT_VALUE="$subject" \
  NOTIFICATION_SMOKE_MESSAGE_VALUE="$message" node <<'NODE'
const payload = {
  to: process.env.NOTIFICATION_SMOKE_TO_VALUE || "",
  subject: process.env.NOTIFICATION_SMOKE_SUBJECT_VALUE || "",
  message: process.env.NOTIFICATION_SMOKE_MESSAGE_VALUE || "",
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

log_info "Creating a fresh secret admin API key for authenticated smoke..."
set +e
create_output="$(
  (
    cd "$ROOT_DIR/medusa-agency-boilerplate"
    npm run admin:api-key:local --silent
  ) 2>&1
)"
create_status=$?
set -e

if [[ "$create_status" -ne 0 ]]; then
  log_error "Failed to create a secret admin API key for notification smoke."
  exit "$create_status"
fi

secret_api_key="$(extract_secret_api_key "$create_output" || true)"

if [[ -z "$secret_api_key" ]]; then
  log_error "Notification smoke could not extract ROOT_LOCAL_ADMIN_SECRET_API_KEY from helper output."
  exit 1
fi

basic_auth="$(encode_basic_auth "$secret_api_key")"
payload="$(build_payload "$smoke_to" "$smoke_subject" "$smoke_message")"

log_info "Calling authenticated notification smoke route..."
response="$(
  curl --fail-with-body -sS \
    -X POST "${MEDUSA_BACKEND_URL}/admin/notifications/smoke" \
    -H "Authorization: Basic ${basic_auth}" \
    -H "Content-Type: application/json" \
    --data "$payload"
)"

pretty_print_json "$response"
log_info "Notification smoke passed."
