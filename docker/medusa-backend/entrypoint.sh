#!/usr/bin/env sh
set -eu

if [ "${RUN_MEDUSA_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Medusa database migrations..."
  npm exec medusa db:migrate
fi

if [ "${COPY_MEDUSA_ADMIN_ASSET_WORKAROUND:-true}" = "true" ] && [ -d ".medusa/server/public/admin" ]; then
  mkdir -p public
  cp -a .medusa/server/public/admin public/admin
fi

exec "$@"
