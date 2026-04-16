#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

target_dir="$ROOT_DIR/medusa-agency-boilerplate/.medusa"
vite_dir="$ROOT_DIR/medusa-agency-boilerplate/node_modules/.vite"

if [[ ! -e "$target_dir" && ! -e "$vite_dir" ]]; then
  log_info "No generated backend directories found. Nothing to fix."
  exit 0
fi

log_info "Fixing backend generated directories ownership to ${HOST_UID}:${HOST_GID}"

docker run --rm \
  -v "$ROOT_DIR/medusa-agency-boilerplate:/app" \
  alpine:3.22 \
  sh -lc "if [ -e /app/.medusa ]; then chown -R ${HOST_UID}:${HOST_GID} /app/.medusa; fi; if [ -e /app/node_modules/.vite ]; then chown -R ${HOST_UID}:${HOST_GID} /app/node_modules/.vite; fi"

log_info "Ownership fix completed."
