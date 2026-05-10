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

if [[ "${RUN_PAYLOAD_MIGRATIONS:-false}" == "true" ]]; then
  echo "Running Payload migrations as one-off job..."
  docker compose -p "$project_name" -f "$compose_file" --env-file .env run --rm \
    -e RUN_PAYLOAD_MIGRATIONS=true \
    -e RUN_PAYLOAD_SEED=false \
    --entrypoint payload-entrypoint \
    payload-cms true
else
  echo "Skipping Payload migrations; set RUN_PAYLOAD_MIGRATIONS=true in remote .env to enable them."
fi

if [[ "${RUN_PAYLOAD_SEED:-false}" == "true" ]]; then
  echo "Running Payload seed as one-off job..."
  docker compose -p "$project_name" -f "$compose_file" --env-file .env run --rm \
    -e RUN_PAYLOAD_MIGRATIONS=false \
    -e RUN_PAYLOAD_SEED=true \
    --entrypoint payload-entrypoint \
    payload-cms true
fi

echo "Starting application containers..."
docker compose -p "$project_name" -f "$compose_file" --env-file .env up -d --remove-orphans medusa-backend payload-cms storefront caddy

echo "Pruning dangling Docker images..."
docker image prune -f >/dev/null || true

echo "Running production smoke checks..."
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1}" \
SMOKE_BACKEND_URL="${SMOKE_BACKEND_URL:-http://127.0.0.1/admin/}" \
SMOKE_PAYLOAD_URL="${SMOKE_PAYLOAD_URL:-http://127.0.0.1/payload/api/pages?limit=1}" \
  bash ./scripts/prod-container-smoke.sh

echo "Deployment complete."
