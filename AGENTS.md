# Repository notes

## Verified commands

- Backend tests: `ai-assistant/.venv/bin/python -m pytest ai-assistant/backend/tests`
- Medusa unit tests: `npm --prefix medusa-agency-boilerplate run test:unit`
- Medusa typecheck: `npm --prefix medusa-agency-boilerplate run typecheck`
- Storefront lint: `npm --prefix medusa-agency-boilerplate-storefront run lint`
- Storefront typecheck: `npm --prefix medusa-agency-boilerplate-storefront run typecheck`
- Python CLI syntax check: `python3 -m py_compile ai-assistant/scripts/eval_dataset.py ai-assistant/scripts/replay_session.py`

## Notes

- In this environment, calling `tsc --noEmit` through `npm exec` did not forward arguments reliably; `npm run typecheck` worked as expected.
- pnpm-only hoisting settings for the Medusa package live in `medusa-agency-boilerplate/pnpm-workspace.yaml`, not `.npmrc`, to avoid npm v11 unknown-config warnings.
