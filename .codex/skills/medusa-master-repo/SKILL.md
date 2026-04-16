---
name: medusa-master-repo
description: Use when working in this medusa-agency-boilerplate repository on planning, implementation, architecture, integrations, storefront strategy, or status tracking. This skill tells Codex which local documents are the source of truth, what project state is already confirmed, and which docs must be updated after meaningful changes.
---

# Medusa Master Repo

Use this skill for any substantial work in this repository.

## First Read

Read documents in this order:

1. `Docs/current_work.md`
   This is the canonical answer to: what are we doing now, where is the current work happening, and what should an agent do first with empty context.
2. `Docs/master_repo_plan_v2.md`
   This is the main roadmap and the canonical project plan.
3. `Docs/plan_analysis.md`
   This is the audit of what is actually done, partially done, blocked, or overstated.
4. `Docs/env_contract.md`
   Read this when working on local startup, ports, env files, or root orchestration.
5. Relevant code and config files
   Trust the repository state over narrative documents.
6. `Docs/master_repo_guide.md`
   Use only for older business framing and historical context. Do not trust its status table as canonical.
7. `Docs/medusa_project_summary.md` and `Docs/Medusa.md`
   Use as background/reference only.

## Current Known Reality

Before making claims, remember these points were already verified:

- Root `package.json` and `scripts/` are now the canonical entrypoint for bootstrap, preflight, dev, build, smoke, and permission repair.
- The clean-state onboarding path `cp .env.example .env` → `npm run bootstrap` → `npm run preflight` → `npm run dev` is confirmed.
- Gate A and Phase 1 are effectively closed for clean local onboarding.
- Re-running `npm run bootstrap` on an already populated database remains a separate non-idempotency hardening concern, not a reason to reopen Gate A.
- `medusa-config.ts` currently contains only base config and no real integration/module registration.
- `docker-compose.yml` currently covers PostgreSQL, Redis, and backend, but not the storefront.
- Backend generated directories `.medusa` and `node_modules/.vite` may inherit bad ownership from older container runs; `npm run permissions:fix` repairs them.
- Storefront currently depends on a working `MEDUSA_BACKEND_URL`, publishable API key, and at least one valid region.
- Seed/baseline data are still starter-oriented (`Europe`, `EUR`, starter shipping labels), which makes Phase 2 the current main workstream.
- Storefront still contains starter branding and defaults such as `NEXT_PUBLIC_DEFAULT_REGION=us`.
- On this workstation, local root `.env` is aligned to backend port `9001` because `9000` is occupied by another service. `.env.example` still keeps `9000` as the template default.

Re-verify any of these if the code has changed.

## Working Rules

- Do not mark an item as done unless its Definition of Done is actually satisfied.
- Do not copy old statuses from `master_repo_guide.md` into new planning.
- Do not describe Gate A or Phase 1 as open if the topic is clean local onboarding; that status is already confirmed closed.
- Treat bootstrap hardening on dirty databases as a separate concern from clean onboarding validation.
- For unstable or integration-specific claims, verify against official Medusa docs or the actual package/provider source.
- Keep the distinction clear between:
  - confirmed repo state;
  - project decisions;
  - hypotheses still requiring validation.

## Documentation Roles

- `Docs/current_work.md`
  Canonical operational status: what we are doing now, where the active work surface is, and what an empty-context agent should do first.
- `Docs/master_repo_plan_v2.md`
  Main roadmap, phases, gates, target architecture, and documentation policy.
- `Docs/plan_analysis.md`
  Audit and factual gap analysis.
- `Docs/env_contract.md`
  Env and startup contract for root orchestration, backend runtime, and storefront runtime.
- `Docs/master_repo_guide.md`
  Older executive/business narrative; update only if we intentionally keep it aligned.
- `Docs/medusa_project_summary.md`
  Broader technical summary and background notes.
- `Docs/Medusa.md`
  High-level Medusa notes and collected observations.
- `.codex/skills/medusa-master-repo/SKILL.md`
  Fast onboarding context for Codex working in this repo.

## Mandatory Updates After Meaningful Changes

Update `Docs/current_work.md` when:

- the active phase changes;
- the current concrete workstream changes;
- the answer to "what are we doing right now" changes;
- the current work surface changes;
- a current blocker is added or removed.

Update `Docs/master_repo_plan_v2.md` when:

- a phase starts, is re-scoped, or is completed;
- a blocker is added or removed;
- a new architectural decision is made;
- an integration path is approved or rejected;
- documentation policy or rollout order changes.

Update `Docs/plan_analysis.md` when:

- a previous audit statement becomes false;
- a major blocker is resolved;
- the actual status of completed/partial work materially changes;
- a reassessment of current reality is needed.

Update this skill when:

- the source-of-truth document set changes;
- document roles change;
- the repo structure changes in a way that affects agent navigation;
- the current known reality section becomes outdated;
- there is a new mandatory rule for how Codex should work in this repo.

Update `Docs/master_repo_guide.md` only when:

- we intentionally want the business-facing summary to stay aligned with the canonical plan.

## Default Behavior

When the user asks “what is done / what is next / where to look”, answer from:

1. `Docs/current_work.md` for the live operational answer;
2. `Docs/master_repo_plan_v2.md` for direction;
3. `Docs/plan_analysis.md` for reality;
4. code/config for final verification.

Default orientation after the current status update:
- treat clean onboarding as confirmed baseline;
- treat Phase 2 baseline replacement as the default next implementation step;
- mention dirty-DB bootstrap behavior only as a hardening note unless the user is explicitly asking about idempotency.

When these disagree, code and verified repo state win.
