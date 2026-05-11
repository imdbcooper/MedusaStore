# Staging Runbook

> Current reality: this repository documents production on `slavx.mooo.com`, but does not currently define a concrete separate staging server. Existing staging documents are a historical/generic contour unless a separate stage host is provisioned.

## 1. Status

| Question | Current answer |
| --- | --- |
| Is there a concrete remote staging host in this repo? | No. |
| Is `slavx.mooo.com` staging? | No. It is production. |
| Is there a staging GitHub Actions deploy workflow? | No concrete stage workflow is currently present. |
| Are existing staging docs useless? | No. They remain planning/checklist/verification contours, but they are not evidence of a provisioned stage server. |
| Is production deploy automation present? | Yes. See [`production_runbook.md`](./production_runbook.md). |

## 2. How to read existing staging docs

- [`staging_deploy_path.md`](./staging_deploy_path.md) — generic/historical staging deploy contour; do not read its older limitations as statements about current production capability.
- [`staging_verification_contour.md`](./staging_verification_contour.md) — executable verification concept via `npm run staging:verify`; can be used for any already-running remote candidate with a prepared env file.
- [`staging_checklist.md`](./staging_checklist.md), [`staging_backup_restore_runbook.md`](./staging_backup_restore_runbook.md), [`staging_rollback_runbook.md`](./staging_rollback_runbook.md), [`staging_monitoring_baseline.md`](./staging_monitoring_baseline.md) — retained staging planning/checklist material.

For actual production operations, use [`production_runbook.md`](./production_runbook.md), not staging docs.

## 3. Minimum requirements to add real staging

Provision a separate environment; do not reuse production host/database as staging.

Required decisions:

1. Stage domain, for example `stage.<domain>` or another DNS name.
2. Stage server/VM/container host.
3. Stage SSH user and path.
4. Stage branch policy: deploy `main`, `develop`, or a dedicated staging branch.
5. Stage `.env` with non-production secrets and separate data.
6. Stage PostgreSQL/Redis volumes distinct from production.
7. Stage Caddy ACME/email configuration.
8. Stage GitHub Secrets separate from production.
9. Stage smoke URLs and product handle fixtures.

## 4. Recommended staging topology

Use the same shape as production, but with different names/domains/secrets:

- `docker-compose.prod.yml` can be reused if env values point to staging domain and staging data.
- Use a different `COMPOSE_PROJECT_NAME`, for example `medusastore-stage`, if staging shares a Docker host with anything else.
- Use separate volumes. Never mount production volumes into staging.
- Use Caddy for stage ingress, but with a stage domain.
- Use a stage `.env`, never copy production secrets directly.

## 5. Recommended staging deploy automation

If staging is provisioned, add a new workflow rather than overloading production:

- `.github/workflows/deploy-staging.yml`;
- secrets like `STAGING_DEPLOY_HOST`, `STAGING_DEPLOY_USER`, `STAGING_DEPLOY_PATH`, `STAGING_DEPLOY_SSH_PRIVATE_KEY`;
- branch input defaulting to a staging branch or `main`, per policy;
- remote script can reuse [`scripts/github-deploy-prod.sh`](../scripts/github-deploy-prod.sh) if `DEPLOY_PATH`, `DEPLOY_BRANCH`, `COMPOSE_PROJECT_NAME`, and stage `.env` are correct, or a thin `github-deploy-staging.sh` wrapper can be introduced.

Do not point staging secrets at `/home/som/MedusaStore` on production unless the operator explicitly intends to deploy production.

## 6. Stage env contract

Use [`.env.prod.example`](../.env.prod.example) as the closest runtime contract, but set stage-specific values:

- `DEPLOY_DOMAIN=<stage-domain>`;
- `NEXT_PUBLIC_BASE_URL=https://<stage-domain>`;
- `DOCKER_NEXT_PUBLIC_BASE_URL=https://<stage-domain>`;
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://<stage-domain>` or stage public origin;
- `DOCKER_MEDUSA_BACKEND_URL=http://medusa-backend:9000`;
- separate database credentials and volumes;
- stage-only JWT/cookie/Payload secrets;
- stage-specific CORS origins;
- stage smoke overrides as needed.

## 7. Verification once staging exists

Prepare a stage env file locally or in CI and run:

```bash
ROOT_ENV_FILE=./staging.env npm run staging:verify
```

Recommended stage checks:

- backend health;
- storefront root;
- `/ru/account` browser smoke;
- notification smoke if admin key/data-plane path is intentionally configured;
- `GET /healthz` through stage Caddy;
- `GET /ru/about` and `GET /ru/promotions`;
- `GET /ru/products/<known-stage-product-handle>` for dynamic product rendering;
- `GET /payload/api/pages?limit=1` through the stage proxy if Payload is enabled.

## 8. What not to do

- Do not call production `slavx.mooo.com` staging.
- Do not reuse production PostgreSQL volumes/data for staging tests.
- Do not place production deploy SSH key in staging secrets.
- Do not treat old statements like “production packaging is absent” as current truth; production packaging/deploy now exists.
- Do not deploy documentation-only changes to production unless there is an operational reason to update the remote checkout.

## 9. Current practical path

Until a concrete stage host is provisioned, use:

- local checks for code/docs consistency;
- production runbook for real production deploys;
- staging docs only as planning material and verification contour examples.
