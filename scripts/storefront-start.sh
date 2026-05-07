#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

export NODE_ENV=production
export STOREFRONT_PORT
export MEDUSA_BACKEND_URL
export NEXT_PUBLIC_MEDUSA_BACKEND_URL="${NEXT_PUBLIC_MEDUSA_BACKEND_URL:-$MEDUSA_BACKEND_URL}"
export NEXT_PUBLIC_MEDUSA_BACKEND_PORT="${NEXT_PUBLIC_MEDUSA_BACKEND_PORT:-${MEDUSA_BACKEND_PORT:-9000}}"
export NEXT_PUBLIC_BASE_URL

STOREFRONT_DIR="$ROOT_DIR/medusa-agency-boilerplate-storefront"
NEXT_DIR="$STOREFRONT_DIR/.next"

if [[ ! -f "$NEXT_DIR/BUILD_ID" ]]; then
  log_error "Storefront production build is missing: $NEXT_DIR/BUILD_ID"
  log_error "Run 'npm run storefront:build' before production start."
  exit 1
fi

cd "$STOREFRONT_DIR"
npm run start
