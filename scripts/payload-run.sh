#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

PAYLOAD_DIR="$ROOT_DIR/payload-cms"
PAYLOAD_ENV_TEMPLATE="$PAYLOAD_DIR/.env.example"
PAYLOAD_ENV_FILE="$PAYLOAD_DIR/.env"
PAYLOAD_COMMAND="${1:-}"
PAYLOAD_NEXT_DIR="$PAYLOAD_DIR/.next"

if [[ -z "$PAYLOAD_COMMAND" ]]; then
  log_error "Usage: bash ./scripts/payload-run.sh <payload-script>"
  log_error "Examples: dev, build, start, stop, clean, restart, payload:generate:types, payload:generate:importmap, seed, status"
  exit 1
fi

if [[ ! -d "$PAYLOAD_DIR" ]]; then
  log_error "Missing payload app directory: $PAYLOAD_DIR"
  exit 1
fi

if [[ ! -f "$PAYLOAD_ENV_FILE" && -f "$PAYLOAD_ENV_TEMPLATE" ]]; then
  log_info "Creating payload-cms/.env from payload-cms/.env.example for local runtime."
  cp "$PAYLOAD_ENV_TEMPLATE" "$PAYLOAD_ENV_FILE"
fi

if [[ -f "$PAYLOAD_ENV_FILE" ]]; then
  load_env_file "$PAYLOAD_ENV_FILE"
fi

if [[ -n "${PAYLOAD_DATABASE_URL:-}" && ( -z "${DATABASE_URL:-}" || "${DATABASE_URL:-}" == *"medusa-db:5432"* ) ]]; then
  DATABASE_URL="$PAYLOAD_DATABASE_URL"
fi

PAYLOAD_PORT="${PAYLOAD_PORT:-3100}"
PAYLOAD_CMS_URL="${PAYLOAD_CMS_URL:-http://localhost:${PAYLOAD_PORT}}"
PAYLOAD_PUBLIC_SERVER_URL="${PAYLOAD_PUBLIC_SERVER_URL:-$PAYLOAD_CMS_URL}"

export DATABASE_URL PAYLOAD_PORT PAYLOAD_CMS_URL PAYLOAD_PUBLIC_SERVER_URL

case "$PAYLOAD_COMMAND" in
  build | start)
    export NODE_ENV=production
    ;;
  dev | seed | status | stop | clean | restart)
    export NODE_ENV=development
    ;;
esac

payload_dependencies_ready() {
  [[ -d "$PAYLOAD_DIR/node_modules" ]] && [[ -x "$PAYLOAD_DIR/node_modules/.bin/next" ]]
}

payload_next_pid_list() {
  ps -eo pid=,ppid=,cmd= | awk -v dir="$PAYLOAD_DIR" '
    index($0, dir) && $0 !~ /awk -v dir=/ && ($0 ~ /next dev/ || $0 ~ /next-server \(v/ || $0 ~ /next start/ || $0 ~ /npm run payload:dev/ || $0 ~ /npm run payload:start/ || $0 ~ /payload-run\.sh dev/ || $0 ~ /payload-run\.sh start/) {
      print $1
    }
  ' | sort -n | uniq
}

payload_next_process_details() {
  ps -eo pid=,ppid=,lstart=,cmd= | awk -v dir="$PAYLOAD_DIR" '
    index($0, dir) && $0 !~ /awk -v dir=/ && ($0 ~ /next dev/ || $0 ~ /next-server \(v/ || $0 ~ /next start/ || $0 ~ /npm run payload:dev/ || $0 ~ /npm run payload:start/ || $0 ~ /payload-run\.sh dev/ || $0 ~ /payload-run\.sh start/) {
      print
    }
  '
}

payload_port_details() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -n -P 2>/dev/null | tail -n +2 || true
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :${port} )" 2>/dev/null | tail -n +2 || true
  fi
}

payload_stop_dev() {
  local pids=""
  pids="$(payload_next_pid_list || true)"

  if [[ -z "$pids" ]]; then
    log_info "No active Payload/Next dev/start processes detected."
    return 0
  fi

  log_info "Stopping active Payload/Next dev processes: $(tr '\n' ' ' <<<"$pids" | sed 's/[[:space:]]*$//')"
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    kill -TERM "$pid" 2>/dev/null || true
  done <<< "$pids"

  local attempt=0
  for attempt in $(seq 1 30); do
    if [[ -z "$(payload_next_pid_list || true)" ]]; then
      return 0
    fi
    sleep 1
  done

  log_warn "Some Payload/Next dev processes did not exit after SIGTERM; sending SIGKILL."
  pids="$(payload_next_pid_list || true)"
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    kill -KILL "$pid" 2>/dev/null || true
  done <<< "$pids"
}

payload_clean_next_cache() {
  if [[ -d "$PAYLOAD_NEXT_DIR" ]]; then
    log_info "Removing Payload Next cache/build directory: ${PAYLOAD_NEXT_DIR#$ROOT_DIR/}"
    rm -rf "$PAYLOAD_NEXT_DIR"
  else
    log_info "Payload Next cache/build directory is already absent: ${PAYLOAD_NEXT_DIR#$ROOT_DIR/}"
  fi
}

payload_vendor_chunk_missing() {
  [[ -d "$PAYLOAD_NEXT_DIR/server" ]] || return 1

  if grep -Rqs "vendor-chunks/date-fns" "$PAYLOAD_NEXT_DIR/server/app" 2>/dev/null \
    && [[ ! -f "$PAYLOAD_NEXT_DIR/server/vendor-chunks/date-fns.js" ]]; then
    return 0
  fi

  return 1
}

payload_admin_reports_missing_vendor_chunk() {
  local server_url="${PAYLOAD_PUBLIC_SERVER_URL:-${PAYLOAD_CMS_URL:-http://localhost:${PAYLOAD_PORT}}}"
  local response=""

  if ! command -v curl >/dev/null 2>&1; then
    return 1
  fi

  response="$(curl -sS --max-time 6 "$server_url/admin" 2>/dev/null || true)"
  [[ "$response" == *"Cannot find module './vendor-chunks/date-fns.js'"* ]]
}

payload_guard_no_active_dev_for_build() {
  local pids=""
  pids="$(payload_next_pid_list || true)"

  if [[ -z "$pids" ]]; then
    return 0
  fi

  log_error "Refusing to run Payload production build while Payload/Next dev is active."
  log_error "Concurrent next dev/build writes to payload-cms/.next can corrupt server chunks and trigger: Cannot find module './vendor-chunks/date-fns.js'."
  log_error "Stop/restart dev first with: npm run payload:restart"
  log_error "Active Payload/Next processes:"
  payload_next_process_details >&2 || true
  exit 1
}

if [[ "$PAYLOAD_COMMAND" != "status" && "$PAYLOAD_COMMAND" != "stop" && "$PAYLOAD_COMMAND" != "clean" ]] && ! payload_dependencies_ready; then
  log_info "Installing payload-cms dependencies with npm to ensure local runtime readiness."
  (
    cd "$PAYLOAD_DIR"
    npm install
  )
fi

if [[ "$PAYLOAD_COMMAND" == "status" ]]; then
  port="${PAYLOAD_PORT:-3100}"
  server_url="${PAYLOAD_PUBLIC_SERVER_URL:-${PAYLOAD_CMS_URL:-http://localhost:${port}}}"

  log_info "Payload CMS directory: ${PAYLOAD_DIR#$ROOT_DIR/}"
  log_info "Payload CMS env file: ${PAYLOAD_ENV_FILE#$ROOT_DIR/}"
  log_info "Payload CMS URL: $server_url"

  if [[ -n "${DATABASE_URL:-}" ]]; then
    log_info "DATABASE_URL is configured for Payload runtime."
  else
    log_error "DATABASE_URL is not configured for Payload runtime."
  fi

  if [[ -n "${PAYLOAD_SECRET:-}" ]]; then
    log_info "PAYLOAD_SECRET is configured."
  else
    log_error "PAYLOAD_SECRET is not configured."
  fi

  if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${port}\$"; then
    log_info "Port :${port} is listening."
    payload_port_details "$port" | sed 's/^/[info] Port process: /' || true
  else
    log_warn "Port :${port} is not listening."
  fi

  active_processes="$(payload_next_process_details || true)"
  if [[ -n "$active_processes" ]]; then
    log_info "Active Payload/Next processes:"
    printf '%s\n' "$active_processes" | sed 's/^/[info]   /'
  else
    log_warn "No active Payload/Next dev/start process detected."
  fi

  if payload_vendor_chunk_missing; then
    log_error "Detected corrupt Next server output: app chunks reference vendor-chunks/date-fns, but payload-cms/.next/server/vendor-chunks/date-fns.js is missing."
    log_error "Run: npm run payload:restart"
  fi

  if command -v curl >/dev/null 2>&1 && curl -fsS -o /dev/null --max-time 6 "$server_url/admin" 2>/dev/null; then
    log_info "Payload admin healthcheck passed: ${server_url}/admin"
  else
    log_warn "Payload admin healthcheck did not pass: ${server_url}/admin"
    if payload_admin_reports_missing_vendor_chunk; then
      log_error "Payload admin currently reports missing vendor chunk date-fns. Run: npm run payload:restart"
    fi
  fi

  exit 0
fi

case "$PAYLOAD_COMMAND" in
  stop)
    payload_stop_dev
    exit 0
    ;;
  clean)
    payload_stop_dev
    payload_clean_next_cache
    exit 0
    ;;
  restart)
    payload_stop_dev
    payload_clean_next_cache
    cd "$PAYLOAD_DIR"
    exec npm run dev
    ;;
  build)
    payload_guard_no_active_dev_for_build
    ;;
  dev)
    if payload_vendor_chunk_missing; then
      log_warn "Detected stale/corrupt Payload Next cache with missing date-fns vendor chunk; cleaning before dev start."
      payload_clean_next_cache
    fi
    ;;
esac

cd "$PAYLOAD_DIR"
npm run "$PAYLOAD_COMMAND"
