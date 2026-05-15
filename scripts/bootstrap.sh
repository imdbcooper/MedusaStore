#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

backend_env="$ROOT_DIR/medusa-agency-boilerplate/.env"
storefront_env="$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local"

require_value() {
  local key="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    log_error "Missing required root env value: ${key}"
    exit 1
  fi
}

extract_publishable_key() {
  local bootstrap_output="$1"

  BOOTSTRAP_OUTPUT="$bootstrap_output" node <<'NODE'
const text = process.env.BOOTSTRAP_OUTPUT || ""
const match = text.match(/ROOT_BOOTSTRAP_PUBLISHABLE_KEY=([^\s]+)/)
if (!match) {
  process.exit(1)
}
process.stdout.write(match[1])
NODE
}

require_value "POSTGRES_USER" "${POSTGRES_USER:-}"
require_value "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD:-}"
require_value "POSTGRES_DB" "${POSTGRES_DB:-}"
require_value "JWT_SECRET" "${JWT_SECRET:-}"
require_value "COOKIE_SECRET" "${COOKIE_SECRET:-}"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  log_error "Missing root .env: $ROOT_DIR/.env"
  log_error "Create it from .env.example before bootstrap."
  exit 1
fi

node "$ROOT_DIR/scripts/env-contract.mjs" check-local --env "$ROOT_DIR/.env"

log_info "Synchronizing backend/storefront env files from root env..."
bash "$ROOT_DIR/scripts/env-sync.sh"

log_info "Starting PostgreSQL and Redis for bootstrap..."
docker compose up -d medusa-db medusa-redis

log_info "Waiting for PostgreSQL healthcheck to pass..."
postgres_ready=0
for _ in $(seq 1 60); do
  if docker compose ps --format json medusa-db 2>/dev/null | grep -q '"Health":"healthy"'; then
    postgres_ready=1
    break
  fi

  sleep 1
done

if [[ "$postgres_ready" -ne 1 ]]; then
  log_error "PostgreSQL did not become healthy within 60 seconds."
  docker compose logs --tail=80 medusa-db 2>/dev/null || true
  exit 1
fi

log_info "Running Medusa database migrations on a fresh-or-existing database..."
(
  cd "$ROOT_DIR/medusa-agency-boilerplate"
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
  npm exec medusa db:migrate
)

log_info "Running application seed to create storefront-required defaults..."
set +e
bootstrap_output="$(
  (
    cd "$ROOT_DIR/medusa-agency-boilerplate"
    set -a
    # shellcheck disable=SC1091
    source ./.env
    set +a
    npm run seed --silent
  ) 2>&1
)"
seed_status=$?
set -e
printf '%s\n' "$bootstrap_output"

if [[ "$seed_status" -ne 0 ]]; then
  log_error "Bootstrap seed failed on the current database state."
  log_error "Bootstrap does not update storefront env when seed short-circuits or finds conflicting baseline entities."
  exit "$seed_status"
fi

publishable_key="$(extract_publishable_key "$bootstrap_output" || true)"

if [[ -z "$publishable_key" ]]; then
  log_error "Bootstrap could not detect a publishable API key from seed output."
  log_error "See logs above and fix the seed path before onboarding a clean clone."
  exit 1
fi

log_info "Writing detected publishable key into storefront env..."
PUBLISHABLE_KEY="$publishable_key" node <<'NODE'
const fs = require("fs")
const path = require("path")

const filePath = path.join(process.cwd(), "medusa-agency-boilerplate-storefront/.env.local")
const key = process.env.PUBLISHABLE_KEY || ""
const line = `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${key}`

let content = ""
if (fs.existsSync(filePath)) {
  content = fs.readFileSync(filePath, "utf8")
}

const rows = content === "" ? [] : content.split(/\r?\n/)
let updated = false
const nextRows = rows.map((row) => {
  if (row.startsWith("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=")) {
    updated = true
    return line
  }
  return row
})

if (!updated) {
  nextRows.push(line)
}

fs.writeFileSync(filePath, `${nextRows.join("\n").replace(/\n*$/, "")}\n`)
NODE

log_info "Bootstrap completed."
log_info "Canonical next step: npm run dev"
log_info "Publishable key stored in ${storefront_env#$ROOT_DIR/}"
