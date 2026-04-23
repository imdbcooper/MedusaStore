#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

DEFAULT_STAGING_VERIFICATION_CONTOUR="smoke:backend,smoke:storefront,smoke:browser,smoke:notification"
DEFAULT_STAGING_VERIFICATION_EXPECT_ACCOUNT_PATH="/ru/account"

trim_whitespace() {
  local value="$1"

  VALUE="$value" node <<'NODE'
const value = process.env.VALUE || ""
process.stdout.write(value.trim())
NODE
}

normalize_base_url() {
  local value="$1"

  VALUE="$value" node <<'NODE'
const value = (process.env.VALUE || "").trim()
if (!value) {
  process.exit(1)
}
process.stdout.write(value.replace(/\/+$/, ""))
NODE
}

build_url() {
  local base_url="$1"
  local path_suffix="$2"

  BASE_URL="$base_url" PATH_SUFFIX="$path_suffix" node <<'NODE'
const baseUrl = process.env.BASE_URL || ""
const pathSuffix = process.env.PATH_SUFFIX || ""
process.stdout.write(`${baseUrl}${pathSuffix}`)
NODE
}

run_named_check() {
  local check_name="$1"

  case "$check_name" in
    smoke:backend)
      bash "$ROOT_DIR/scripts/smoke-backend.sh"
      ;;
    smoke:storefront)
      bash "$ROOT_DIR/scripts/smoke-storefront.sh"
      ;;
    smoke:browser)
      bash "$ROOT_DIR/scripts/browser-smoke.sh"
      ;;
    smoke:notification)
      bash "$ROOT_DIR/scripts/notification-smoke.sh"
      ;;
    *)
      log_error "Unknown staging verification check: $check_name"
      exit 1
      ;;
  esac
}

staging_backend_url="$(normalize_base_url "${MEDUSA_BACKEND_URL}")"
staging_storefront_url="$(normalize_base_url "${STOREFRONT_URL}")"
account_path="$(trim_whitespace "${STAGING_BROWSER_ACCOUNT_PATH:-$DEFAULT_STAGING_VERIFICATION_EXPECT_ACCOUNT_PATH}")"
contour_definition="${STAGING_VERIFICATION_CONTOUR:-$DEFAULT_STAGING_VERIFICATION_CONTOUR}"

if [[ -z "$account_path" ]]; then
  log_error "STAGING_BROWSER_ACCOUNT_PATH must not be empty."
  exit 1
fi

if [[ "$account_path" != /* ]]; then
  log_error "STAGING_BROWSER_ACCOUNT_PATH must start with '/': $account_path"
  exit 1
fi

export MEDUSA_BACKEND_URL="$staging_backend_url"
export STOREFRONT_URL="$staging_storefront_url"
export NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-$staging_storefront_url}"
export BROWSER_SMOKE_PATH_EXPECTATION="$account_path"
export BROWSER_SMOKE_URL="$(build_url "$staging_storefront_url" "$account_path")"

if [[ -n "${BACKEND_DATABASE_URL:-}" ]]; then
  export DATABASE_URL="$BACKEND_DATABASE_URL"
fi

if [[ -n "${BACKEND_REDIS_URL:-}" ]]; then
  export REDIS_URL="$BACKEND_REDIS_URL"
fi

log_info "Running staging verification contour against backend $MEDUSA_BACKEND_URL and storefront $STOREFRONT_URL"

IFS=',' read -r -a requested_checks <<< "$contour_definition"

if [[ "${#requested_checks[@]}" -eq 0 ]]; then
  log_error "STAGING_VERIFICATION_CONTOUR did not define any checks."
  exit 1
fi

for raw_check in "${requested_checks[@]}"; do
  check_name="$(trim_whitespace "$raw_check")"

  if [[ -z "$check_name" ]]; then
    log_error "STAGING_VERIFICATION_CONTOUR contains an empty check name."
    exit 1
  fi

  log_info "Starting staging verification check: $check_name"
  run_named_check "$check_name"
  log_info "Completed staging verification check: $check_name"
done

log_info "Staging verification contour passed."
