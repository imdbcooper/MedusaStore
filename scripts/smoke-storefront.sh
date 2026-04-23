#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

curl -fsS "$STOREFRONT_URL" >/dev/null
log_info "Storefront smoke passed: $STOREFRONT_URL"
