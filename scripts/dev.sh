#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

bash "$ROOT_DIR/scripts/preflight.sh"

log_info "Starting PostgreSQL and Redis..."
docker compose up -d medusa-db medusa-redis

bash "$ROOT_DIR/scripts/fix-medusa-permissions.sh"

log_info "Starting backend container on ${MEDUSA_BACKEND_URL}..."
docker compose up -d medusa-backend

backend_ready=0
for _ in $(seq 1 60); do
  if curl -fsS "${MEDUSA_BACKEND_URL}/health" >/dev/null 2>&1; then
    backend_ready=1
    break
  fi

  sleep 1
done

if [[ "$backend_ready" -ne 1 ]]; then
  log_error "Backend did not become healthy within 60 seconds."
  docker compose logs --tail=80 medusa-backend 2>/dev/null || true
  exit 1
fi

log_info "Backend is healthy. Starting storefront on http://localhost:${STOREFRONT_PORT}..."
bash "$ROOT_DIR/scripts/storefront-dev.sh"
