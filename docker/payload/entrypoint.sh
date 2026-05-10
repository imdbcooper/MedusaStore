#!/usr/bin/env sh
set -eu

if [ "${RUN_PAYLOAD_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Payload database migrations..."
  node - <<'EOF'
process.env.PAYLOAD_MIGRATING = 'true'
const [{ default: payload }, { default: config }] = await Promise.all([
  import('payload'),
  import('./src/payload.config.ts'),
])
await payload.init({ config, disableOnInit: true })
await payload.db.migrate()
await payload.destroy?.()
EOF
fi

if [ "${RUN_PAYLOAD_SEED:-false}" = "true" ]; then
  echo "Running Payload marketing seed..."
  npm run seed
fi

exec "$@"
