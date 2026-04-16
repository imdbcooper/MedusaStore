#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

log_info() {
  printf '[info] %s\n' "$*"
}

log_warn() {
  printf '[warn] %s\n' "$*" >&2
}

log_error() {
  printf '[error] %s\n' "$*" >&2
}

load_root_env() {
  local env_file="$ROOT_DIR/.env"
  local fallback_file="$ROOT_DIR/.env.example"
  local source_file="$fallback_file"

  if [[ -f "$env_file" ]]; then
    source_file="$env_file"
  fi

  set -a
  # shellcheck disable=SC1090
  source "$source_file"
  set +a

  ROOT_ENV_SOURCE="$source_file"
  POSTGRES_PORT="${POSTGRES_PORT:-5433}"
  REDIS_PORT="${REDIS_PORT:-6379}"
  MEDUSA_BACKEND_PORT="${MEDUSA_BACKEND_PORT:-9000}"
  STOREFRONT_PORT="${STOREFRONT_PORT:-8000}"
  HOST_UID="${HOST_UID:-$(id -u)}"
  HOST_GID="${HOST_GID:-$(id -g)}"
  MEDUSA_BACKEND_URL="${MEDUSA_BACKEND_URL:-http://localhost:${MEDUSA_BACKEND_PORT}}"
  NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-http://localhost:${STOREFRONT_PORT}}"

  export ROOT_ENV_SOURCE
  export POSTGRES_PORT REDIS_PORT MEDUSA_BACKEND_PORT STOREFRONT_PORT
  export HOST_UID HOST_GID MEDUSA_BACKEND_URL NEXT_PUBLIC_BASE_URL
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_file() {
  local file_path="$1"
  local label="${2:-$1}"

  if [[ ! -f "$file_path" ]]; then
    log_error "Missing ${label}: ${file_path}"
    return 1
  fi
}

env_file_has_value() {
  local file_path="$1"
  local key="$2"

  grep -Eq "^${key}=.+" "$file_path"
}

port_in_use() {
  local port="$1"

  if command_exists ss; then
    ss -ltn "( sport = :${port} )" | tail -n +2 | grep -q LISTEN
    return
  fi

  if command_exists lsof; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return
  fi

  log_error "Neither 'ss' nor 'lsof' is available for port checks."
  return 2
}

port_details() {
  local port="$1"
  local details=""

  if command_exists lsof; then
    details="$(lsof -iTCP:"${port}" -sTCP:LISTEN -n -P 2>/dev/null | tail -n +2 || true)"

    if [[ -n "$details" ]]; then
      printf '%s\n' "$details"
      return
    fi
  fi

  if command_exists ss; then
    ss -ltnp "( sport = :${port} )" | tail -n +2
  fi
}

compose_service_running() {
  local service_name="$1"

  docker compose ps --services --status running 2>/dev/null | grep -Fxq "$service_name"
}
