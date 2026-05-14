#!/usr/bin/env bash
set -euo pipefail

repo_dir="${DEPLOY_PATH:-/home/som/MedusaStore}"
branch="${DEPLOY_BRANCH:-main}"
compose_file="${COMPOSE_FILE:-docker-compose.prod.yml}"
project_name="${COMPOSE_PROJECT_NAME:-medusastore}"

cd "$repo_dir"

echo "Fetching ${branch}..."
git fetch origin "$branch"
git checkout "$branch"
git reset --hard "origin/${branch}"

if [[ ! -f .env ]]; then
  echo "Missing ${repo_dir}/.env" >&2
  exit 1
fi

echo "Building production images..."
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
docker compose -p "$project_name" -f "$compose_file" --env-file .env "${compose_profiles[@]}" up -d --force-recreate --remove-orphans "${app_services[@]}"

echo "Pruning dangling Docker images..."
docker image prune -f >/dev/null || true

echo "Running production smoke checks..."
smoke_base_url="$(grep -E '^SMOKE_BASE_URL=' .env | tail -1 | cut -d= -f2- || true)"
smoke_backend_url="$(grep -E '^SMOKE_BACKEND_URL=' .env | tail -1 | cut -d= -f2- || true)"
smoke_payload_url="$(grep -E '^SMOKE_PAYLOAD_URL=' .env | tail -1 | cut -d= -f2- || true)"

deploy_domain="${DEPLOY_DOMAIN:-}"
if [[ -z "$deploy_domain" ]]; then
  deploy_domain="$(grep -E '^DEPLOY_DOMAIN=' .env | tail -1 | cut -d= -f2- || true)"
fi
if [[ -z "$deploy_domain" ]]; then
  deploy_domain="studio.slavx.ru"
fi
public_base_url="https://${deploy_domain}"

if [[ -z "${SMOKE_BASE_URL:-}" ]]; then
  export SMOKE_BASE_URL="${smoke_base_url:-$public_base_url}"
fi
if [[ -z "${SMOKE_BACKEND_URL:-}" ]]; then
  export SMOKE_BACKEND_URL="${smoke_backend_url:-$public_base_url/admin/}"
fi
if [[ -z "${SMOKE_PAYLOAD_URL:-}" ]]; then
  export SMOKE_PAYLOAD_URL="${smoke_payload_url:-$public_base_url/payload/api/pages?limit=1}"
fi

bash ./scripts/staging-container-smoke.sh

echo "Deployment complete."
