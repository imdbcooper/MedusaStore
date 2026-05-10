#!/usr/bin/env sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  SELECT 'CREATE DATABASE payload_cms OWNER "$POSTGRES_USER"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payload_cms')\gexec
EOSQL
