#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

failed=0

check_command() {
  local name="$1"

  if ! command_exists "$name"; then
    log_error "Required command not found: ${name}"
    failed=1
  fi
}

check_required_file() {
  local file_path="$1"
  local label="$2"

  if ! require_file "$file_path" "$label"; then
    failed=1
  fi
}

check_port_for_reuse() {
  local label="$1"
  local port="$2"
  local service_name="$3"

  if port_in_use "$port"; then
    if compose_service_running "$service_name"; then
      log_info "${label} port ${port} is already used by running compose service ${service_name}; it will be reused."
    else
      log_error "${label} port ${port} is busy: $(port_details "$port")"
      failed=1
    fi
  else
    log_info "${label} port ${port} is available."
  fi
}

check_local_port() {
  local label="$1"
  local port="$2"

  if port_in_use "$port"; then
    log_error "${label} port ${port} is busy: $(port_details "$port")"
    log_error "Choose another value for this port in root .env if the conflict is expected."
    failed=1
  else
    log_info "${label} port ${port} is available."
  fi
}

check_command docker
check_command npm
check_command curl
check_command node

if ! command_exists ss && ! command_exists lsof; then
  log_error "Preflight requires either 'ss' or 'lsof' for port checks."
  failed=1
fi

check_required_file "$ROOT_DIR/.env" "root .env"
check_required_file "$ROOT_DIR/medusa-agency-boilerplate/.env" "backend .env"
check_required_file "$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local" "storefront .env.local"

if [[ -f "$ROOT_DIR/.env" ]]; then
  if ! node "$ROOT_DIR/scripts/env-contract.mjs" check-local --env "$ROOT_DIR/.env"; then
    failed=1
  fi
fi

if [[ -f "$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local" ]]; then
  if ! env_file_has_value "$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local" "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"; then
    log_error "storefront .env.local must define NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"
    failed=1
  elif grep -Eq '^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=REPLACE_WITH_ROOT_BOOTSTRAP$' "$ROOT_DIR/medusa-agency-boilerplate-storefront/.env.local"; then
    log_error "storefront .env.local still uses placeholder NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=REPLACE_WITH_ROOT_BOOTSTRAP"
    log_error "Run `npm run bootstrap` from repo root to populate the actual publishable key."
    failed=1
  fi
fi

if ! docker compose config -q >/dev/null 2>&1; then
  log_error "docker compose config -q failed. Check root .env and docker-compose.yml."
  failed=1
else
  log_info "docker compose config is valid."
fi

check_port_for_reuse "PostgreSQL" "$POSTGRES_PORT" "medusa-db"
check_port_for_reuse "Redis" "$REDIS_PORT" "medusa-redis"
check_port_for_reuse "Backend" "$MEDUSA_BACKEND_PORT" "medusa-backend"
check_local_port "Storefront" "$STOREFRONT_PORT"

if [[ "$failed" -ne 0 ]]; then
  log_error "Preflight failed."
  exit 1
fi

log_info "Preflight passed."
log_info "Using root env source: ${ROOT_ENV_SOURCE}"
log_info "Backend URL: ${MEDUSA_BACKEND_URL}"
log_info "Storefront URL: http://localhost:${STOREFRONT_PORT}"
