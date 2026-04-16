#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

curl -fsS "${MEDUSA_BACKEND_URL}/health" >/dev/null
log_info "Backend smoke passed: ${MEDUSA_BACKEND_URL}/health"
