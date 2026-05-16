#!/usr/bin/env bash
set -euo pipefail

repo_dir="${DEPLOY_PATH:-/home/som/MedusaStore}"
branch="${DEPLOY_BRANCH:-main}"
compose_file="${COMPOSE_FILE:-docker-compose.prod.yml}"
project_name="${COMPOSE_PROJECT_NAME:-medusastore}"

cd "$repo_dir"

run_with_heartbeat() {
  local label="$1"
  shift
  local heartbeat_pid=""

  (
    while true; do
      sleep 60
      echo "${label} still running at $(date -Is)..."
    done
  ) &
  heartbeat_pid="$!"

  set +e
  "$@"
  local status="$?"
  set -e

  kill "$heartbeat_pid" 2>/dev/null || true
  wait "$heartbeat_pid" 2>/dev/null || true

  return "$status"
}

env_file_value() {
  local key="$1"
  local value=""

  value="$(grep -E "^${key}=" .env | tail -1 | cut -d= -f2- || true)"
  value="${value%$'\r'}"

  if [[ ${#value} -ge 2 && "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
    value="${value//\\\"/\"}"
    value="${value//\\\\/\\}"
  elif [[ ${#value} -ge 2 && "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "$value"
}

sibling_origin() {
  local label="$1"
  local deploy_domain="$2"

  if [[ "$deploy_domain" == *.*.* ]]; then
    printf 'https://%s.%s' "$label" "${deploy_domain#*.}"
  else
    printf 'https://%s.%s' "$label" "$deploy_domain"
  fi
}

echo "Fetching ${branch}..."
git fetch origin "$branch"
git checkout "$branch"
git reset --hard "origin/${branch}"

if [[ ! -f .env ]]; then
  echo "Missing ${repo_dir}/.env" >&2
  exit 1
fi

echo "Building production images..."
run_with_heartbeat "Docker image build" \
  docker compose -p "$project_name" -f "$compose_file" --env-file .env build

echo "Starting database and redis..."
docker compose -p "$project_name" -f "$compose_file" --env-file .env up -d medusa-db medusa-redis

run_payload_migrations="$(grep -E '^RUN_PAYLOAD_MIGRATIONS=' .env | tail -1 | cut -d= -f2- || true)"
run_payload_migrations="${RUN_PAYLOAD_MIGRATIONS:-${run_payload_migrations:-false}}"

if [[ "$run_payload_migrations" == "true" ]]; then
  echo "Running Payload migrations as one-off job..."
  docker compose -p "$project_name" -f "$compose_file" --env-file .env run --rm \
    -e RUN_PAYLOAD_MIGRATIONS=true \
    -e RUN_PAYLOAD_SEED=false \
    --entrypoint payload-entrypoint \
    payload-cms true
else
  echo "Skipping Payload migrations; set RUN_PAYLOAD_MIGRATIONS=true in remote .env to enable them."
fi

run_payload_seed="$(grep -E '^RUN_PAYLOAD_SEED=' .env | tail -1 | cut -d= -f2- || true)"
run_payload_seed="${RUN_PAYLOAD_SEED:-${run_payload_seed:-false}}"

if [[ "$run_payload_seed" == "true" ]]; then
  echo "Running Payload seed as one-off job..."
  docker compose -p "$project_name" -f "$compose_file" --env-file .env run --rm \
    -e RUN_PAYLOAD_MIGRATIONS=false \
    -e RUN_PAYLOAD_SEED=true \
    --entrypoint payload-entrypoint \
    payload-cms true
fi

compose_profiles=()
if grep -Eq '^AI_ASSISTANT_ENABLED=true$' .env; then
  echo "AI Assistant enabled; including ai-assistant production profile."
  compose_profiles+=(--profile ai-assistant)
else
  echo "AI Assistant disabled; skipping ai-assistant profile."
fi

echo "Starting application containers..."
app_services=(medusa-backend payload-cms storefront caddy)
if [[ ${#compose_profiles[@]} -gt 0 ]]; then
  app_services=(ai-assistant "${app_services[@]}")
fi
# Force recreation keeps staging deploy idempotent after interrupted or partially
# completed compose recreates, which can leave replace-labeled containers behind.
run_with_heartbeat "Application containers up" \
  docker compose -p "$project_name" -f "$compose_file" --env-file .env "${compose_profiles[@]}" up -d --force-recreate --remove-orphans "${app_services[@]}"

echo "Pruning dangling Docker images..."
docker image prune -f >/dev/null || true

echo "Running production smoke checks..."
smoke_base_url="$(env_file_value SMOKE_BASE_URL)"
smoke_backend_url="$(env_file_value SMOKE_BACKEND_URL)"
smoke_payload_url="$(env_file_value SMOKE_PAYLOAD_URL)"

deploy_domain="${DEPLOY_DOMAIN:-}"
if [[ -z "$deploy_domain" ]]; then
  deploy_domain="$(env_file_value DEPLOY_DOMAIN)"
fi
if [[ -z "$deploy_domain" ]]; then
  deploy_domain="studio.slavx.ru"
fi
public_base_url="https://${deploy_domain}"
admin_base_url="$(sibling_origin admin "$deploy_domain")"
payload_base_url="$(sibling_origin cms "$deploy_domain")"

if [[ -z "${SMOKE_BASE_URL:-}" ]]; then
  export SMOKE_BASE_URL="${smoke_base_url:-$public_base_url}"
fi
if [[ -z "${SMOKE_BACKEND_URL:-}" ]]; then
  export SMOKE_BACKEND_URL="${smoke_backend_url:-$admin_base_url/app}"
fi
if [[ -z "${SMOKE_PAYLOAD_URL:-}" ]]; then
  export SMOKE_PAYLOAD_URL="${smoke_payload_url:-$payload_base_url/api/pages}"
fi

run_with_heartbeat "Smoke checks" bash ./scripts/staging-container-smoke.sh

echo "Deployment complete."
