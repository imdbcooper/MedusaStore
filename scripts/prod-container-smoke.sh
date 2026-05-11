#!/usr/bin/env bash
set -euo pipefail

base_url="${SMOKE_BASE_URL:-http://127.0.0.1}"
backend_url="${SMOKE_BACKEND_URL:-http://127.0.0.1/admin/}"
payload_url="${SMOKE_PAYLOAD_URL:-http://127.0.0.1/payload/api/pages?limit=1}"

check_url() {
  local name="$1"
  local url="$2"
  local expected_regex="${3:-^2|^3|^4}"
  local output

  output="$(curl -sS --max-time 20 --retry 3 --retry-delay 2 --retry-connrefused -o /tmp/prod-smoke-${name}.out -w '%{http_code} %{time_total}' "$url")"
  local code="${output%% *}"
  local time="${output#* }"

  echo "${name}: ${code} ${time}s ${url}"

  if ! [[ "$code" =~ $expected_regex ]]; then
    echo "Unexpected HTTP status for ${name}: ${code}" >&2
    head -c 500 "/tmp/prod-smoke-${name}.out" >&2 || true
    echo >&2
    return 1
  fi
}

check_url health "${base_url}/healthz" '^200$'
check_url storefront_home "${base_url}/" '^(200|307|308)$'
check_url about "${base_url}/ru/about" '^200$'
check_url promotions "${base_url}/ru/promotions" '^200$'
check_url delivery "${base_url}/ru/delivery-and-payment" '^200$'
check_url backend_admin "$backend_url" '^(200|301|302|401)$'
check_url payload_pages "$payload_url" '^200$'

if [[ "${AI_ASSISTANT_ENABLED:-false}" == "true" ]]; then
  docker exec medusastore-ai-assistant python - <<'PY'
import urllib.request
urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=10).read()
print('ai_assistant_container: ok')
PY
fi
