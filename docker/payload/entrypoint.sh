#!/usr/bin/env sh
set -eu

if [ "${RUN_PAYLOAD_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Payload database migrations..."
  node - <<'EOF'
process.env.PAYLOAD_MIGRATING = 'true'
try {
  const [{ default: payload }, { default: config }] = await Promise.all([
    import('payload'),
    import('./src/payload.config.ts'),
  ])
  await payload.init({ config, disableOnInit: true })
  await payload.db.migrate()
  if (typeof payload.destroy === 'function') {
    await payload.destroy()
  }
  // payload.init() opens a Postgres connection pool whose handles keep the
  // event loop alive even after destroy(). Exit explicitly so the docker
  // compose run --rm one-off container terminates instead of hanging.
  process.exit(0)
} catch (err) {
  console.error('Payload migration failed:', err && err.stack ? err.stack : err)
  process.exit(1)
}
EOF
fi

if [ "${RUN_PAYLOAD_SEED:-false}" = "true" ]; then
  echo "Running Payload marketing seed..."
  npm run seed
fi

exec "$@"
