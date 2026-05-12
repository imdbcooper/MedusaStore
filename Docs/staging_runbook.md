# Staging Runbook

> Current reality: this repository runs a **single staging environment** at `studio.slavx.ru`. Real production is **not provisioned yet** and will be added after development is complete. All current operational documents describe the staging environment; any historical "production" wording should be read as either a Node.js technical term (`NODE_ENV=production`) or as a TBD future environment.

## 1. Status

| Question | Current answer |
| --- | --- |
| Is there a concrete remote staging host in this repo? | Yes. `studio.slavx.ru`. |
| Is `studio.slavx.ru` production? | No. It is the single staging environment. |
| Is there a staging GitHub Actions deploy workflow? | Yes: [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) (`Deploy Staging`). |
| Is there a real production environment? | No. Not provisioned yet. Will be added after development is complete. |
| Is deployment by any method other than GitHub Actions supported? | No. Direct SSH + docker build is not canonical. |
| How do secrets reach the staging server? | Only through GitHub Secrets and GitHub Variables, injected into the remote `.env` during deploy. |

## 2. Concrete staging facts

| Item | Value |
| --- | --- |
| Domain | `studio.slavx.ru` |
| SSH alias | `slavx-store` |
| IP | `171.22.180.206` |
| SSH user | `som` |
| Deploy path | `/home/som/MedusaStore` |
| GitHub repo | `imdbcooper/MedusaStore` |
| Default branch | `main` |
| Compose file | [`docker-compose.prod.yml`](../docker-compose.prod.yml) (filename retained as Medusa convention) |
| Deploy workflow | [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) |
| Remote deploy script | [`scripts/github-deploy-staging.sh`](../scripts/github-deploy-staging.sh) |
| Smoke script | [`scripts/staging-container-smoke.sh`](../scripts/staging-container-smoke.sh) |
| Env contract | [`.env.staging.example`](../.env.staging.example) |

Mail infrastructure runs on a separate VPS (`smtpserv` / `77.83.92.194`, hostname `smtp.slavx.ru`, docker-mailserver with Let's Encrypt TLS and DKIM/SPF/DMARC for `notify.slavx.ru`). Transactional email sender is `noreply@notify.slavx.ru`.

## 3. Deploy Governance

- **Only** deploy method: GitHub Actions workflow `Deploy Staging` (`.github/workflows/deploy-staging.yml`).
- **Never** deploy via direct SSH + docker build. If used in an emergency, document the reason in [`troubleshooting.md`](./troubleshooting.md).
- Pre-deploy: compose config validation, tests.
- Post-deploy: automated smoke via [`scripts/staging-container-smoke.sh`](../scripts/staging-container-smoke.sh).

## 4. Secrets Governance

- **Only** source of real secrets: GitHub Secrets (passwords, tokens, API keys).
- **Only** source of non-secret config: GitHub Variables.
- Never commit real secret values to git.
- Remote `.env` on staging is built from GitHub Secrets/Variables during deploy.
- [`.env.example`](../.env.example), [`.env.staging.example`](../.env.staging.example), and the per-app templates contain only placeholder values for documentation.

## 5. How to read existing staging docs

- [`staging_deploy_path.md`](./staging_deploy_path.md) — historical planning contour; treat as background.
- [`staging_verification_contour.md`](./staging_verification_contour.md) — executable verification via `npm run staging:verify` against any prepared env file.
- [`staging_checklist.md`](./staging_checklist.md), [`staging_backup_restore_runbook.md`](./staging_backup_restore_runbook.md), [`staging_rollback_runbook.md`](./staging_rollback_runbook.md), [`staging_monitoring_baseline.md`](./staging_monitoring_baseline.md) — planning/checklist material.

For current concrete staging operations (deploy, env, smoke, Caddy routing), see [`production_runbook.md`](./production_runbook.md). That runbook is the single current staging source of truth and will be split into staging/production runbooks once real production is provisioned.

## 6. Stage env contract

Use [`.env.staging.example`](../.env.staging.example) as the runtime contract. Key stage-specific values already reflect the canonical staging reality:

- `DEPLOY_DOMAIN=studio.slavx.ru`;
- `NEXT_PUBLIC_BASE_URL=https://studio.slavx.ru`;
- `DOCKER_NEXT_PUBLIC_BASE_URL=https://studio.slavx.ru`;
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://studio.slavx.ru` (public Caddy origin);
- `DOCKER_MEDUSA_BACKEND_URL=http://medusa-backend:9000` (internal Docker network);
- staging-only JWT/cookie/Payload secrets;
- staging-specific CORS origins;
- staging smoke overrides as needed.

Real secret values are sourced from GitHub Secrets and injected during deploy; the committed example only declares the contract.

## 7. Verification after deploy

After every staging deploy the workflow runs [`scripts/staging-container-smoke.sh`](../scripts/staging-container-smoke.sh). For ad-hoc verification on a prepared env file:

```bash
ROOT_ENV_FILE=./staging.env npm run staging:verify
```

Recommended checks:

- `GET /healthz` through Caddy returns `200` / `ok`;
- backend admin reachable (`200`, `301`, `302`, or `401`, not connection error);
- storefront root renders;
- `GET /ru/about` and `GET /ru/promotions` render when Payload is enabled;
- `GET /ru/products/<known-product-handle>` returns `200` for an existing handle;
- `GET /payload/api/pages?limit=1` returns `200` when Payload is enabled;
- optional `/ru/account` browser smoke;
- optional notification smoke when admin key/data-plane path is intentionally configured.

## 8. What not to do

- Do not call `studio.slavx.ru` production. It is staging. Real production is not provisioned yet.
- Do not deploy by any method other than the `Deploy Staging` GitHub Actions workflow.
- Do not commit real secret values. They belong in GitHub Secrets.
- Do not pass secrets through chat, email, or any channel other than GitHub Secrets/Variables.
- Do not deploy documentation-only changes to staging unless there is an operational reason to update the remote checkout.

## 9. When real production is provisioned

When real production is set up as a second environment:

- add a new deploy workflow (for example `.github/workflows/deploy-production.yml`) that targets the production host;
- add production-scoped GitHub Secrets separate from staging;
- split [`production_runbook.md`](./production_runbook.md) into a dedicated staging runbook and a dedicated production runbook;
- update [`.kilocode/skills/medusa-master-repo/SKILL.md`](../.kilocode/skills/medusa-master-repo/SKILL.md) to describe the two-environment reality.
