import * as migration_20260510_005157_initial_payload_schema from './20260510_005157_initial_payload_schema';

export const migrations = [
  {
    up: migration_20260510_005157_initial_payload_schema.up,
    down: migration_20260510_005157_initial_payload_schema.down,
    name: '20260510_005157_initial_payload_schema'
  },
];
