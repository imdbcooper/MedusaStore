import * as migration_20260510_005157_initial_payload_schema from './20260510_005157_initial_payload_schema';
import * as migration_20260516_062031_marketing_campaigns from './20260516_062031_marketing_campaigns';
import * as migration_20260516_063010_idempotency_key from './20260516_063010_idempotency_key';

export const migrations = [
  {
    up: migration_20260510_005157_initial_payload_schema.up,
    down: migration_20260510_005157_initial_payload_schema.down,
    name: '20260510_005157_initial_payload_schema',
  },
  {
    up: migration_20260516_062031_marketing_campaigns.up,
    down: migration_20260516_062031_marketing_campaigns.down,
    name: '20260516_062031_marketing_campaigns',
  },
  {
    up: migration_20260516_063010_idempotency_key.up,
    down: migration_20260516_063010_idempotency_key.down,
    name: '20260516_063010_idempotency_key'
  },
];
