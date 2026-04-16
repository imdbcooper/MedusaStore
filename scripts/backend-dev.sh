#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

bash "$ROOT_DIR/scripts/fix-medusa-permissions.sh"

cd "$ROOT_DIR/medusa-agency-boilerplate"
npm run dev -- --port "$MEDUSA_BACKEND_PORT"
