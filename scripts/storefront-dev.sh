#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

export NODE_ENV=development
export STOREFRONT_PORT
export MEDUSA_BACKEND_URL
export NEXT_PUBLIC_BASE_URL

STOREFRONT_DIR="$ROOT_DIR/medusa-agency-boilerplate-storefront"
NEXT_DIR="$STOREFRONT_DIR/.next"
RESET_NEXT_DIR=0

if [[ -d "$NEXT_DIR" ]]; then
  if [[ -f "$NEXT_DIR/BUILD_ID" || -f "$NEXT_DIR/export-marker.json" ]]; then
    log_warn "Storefront dev bootstrap detected prebuilt .next artifacts (BUILD_ID/export-marker)."
    RESET_NEXT_DIR=1
  fi

  if [[ ! -d "$NEXT_DIR/static/development" ]]; then
    log_warn "Storefront dev bootstrap: .next/static/development is missing before next dev starts."
    RESET_NEXT_DIR=1
  fi

  if [[ ! -d "$NEXT_DIR/server/edge/chunks" ]]; then
    log_warn "Storefront dev bootstrap: .next/server/edge/chunks is missing before next dev starts."
    RESET_NEXT_DIR=1
  fi
fi

if [[ "$RESET_NEXT_DIR" -eq 1 ]]; then
  log_warn "Storefront dev bootstrap: removing stale .next before next dev."
  rm -rf "$NEXT_DIR"
fi

cd "$STOREFRONT_DIR"
npm run dev
