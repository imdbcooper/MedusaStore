#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

export NODE_ENV=production
export STOREFRONT_PORT
export MEDUSA_BACKEND_URL
export NEXT_PUBLIC_BASE_URL

cd "$ROOT_DIR/medusa-agency-boilerplate-storefront"
npm run build
