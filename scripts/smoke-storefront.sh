#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

curl -fsS "http://localhost:${STOREFRONT_PORT}" >/dev/null
log_info "Storefront smoke passed: http://localhost:${STOREFRONT_PORT}"
