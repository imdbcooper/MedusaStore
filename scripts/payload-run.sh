#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

PAYLOAD_DIR="$ROOT_DIR/payload-cms"
PAYLOAD_ENV_TEMPLATE="$PAYLOAD_DIR/.env.example"
PAYLOAD_ENV_FILE="$PAYLOAD_DIR/.env"
PAYLOAD_COMMAND="${1:-}"

if [[ -z "$PAYLOAD_COMMAND" ]]; then
  log_error "Usage: bash ./scripts/payload-run.sh <payload-script>"
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

case "$PAYLOAD_COMMAND" in
  build | start)
    export NODE_ENV=production
    ;;
  dev)
    export NODE_ENV=development
    ;;
esac

payload_dependencies_ready() {
  [[ -d "$PAYLOAD_DIR/node_modules" ]] && [[ -x "$PAYLOAD_DIR/node_modules/.bin/next" ]]
}

if ! payload_dependencies_ready; then
  log_info "Installing payload-cms dependencies with npm to ensure local runtime readiness."
  (
    cd "$PAYLOAD_DIR"
    npm install
  )
fi

cd "$PAYLOAD_DIR"
npm run "$PAYLOAD_COMMAND"
