# Prod Smoke Verification (Live)

## Overview
- Runner: `bash ${ROOT_DIR:-/Users/waheedraja/NexaLocal/Nexa ERP}/scripts/verification/run_prod_smoke.sh`
- Shortcut: `pnpm verify:prod-smoke`
- Output: `reports/verification/prod-smoke-YYYYMMDD-HHMMSS/` containing `summary.json`, `summary.md`, `logs/`, `artifacts/`, `html/`, `screenshots/`.

## Environment
- Required: `PROD_BASE_URL` (e.g. `https://app.nexaai.co.uk`)
- Credentials (UI required by default; missing values fail fast):
  - `PROD_SMOKE_SUPER_EMAIL` / `PROD_SMOKE_SUPER_PASSWORD`
  - `PROD_SMOKE_ADMIN_EMAIL` / `PROD_SMOKE_ADMIN_PASSWORD`
  - `PROD_SMOKE_STAFF_EMAIL` / `PROD_SMOKE_STAFF_PASSWORD`
- Write mode (disabled by default):
  - `PROD_SMOKE_WRITE=1`
  - `PROD_TEST_TENANT_SLUG=<tenant-code>` (required when write mode is on)
- UI requirement toggle: `PROD_SMOKE_UI_REQUIRED=1` (set to `0` to allow API-only)
- Side-effect guards (default off): `PROD_SMOKE_ENABLE_EMAIL`, `PROD_SMOKE_ENABLE_STRIPE`, `PROD_SMOKE_ENABLE_WEBHOOKS`

## What Runs
1) API checks (Vitest) — read-only coverage of module list endpoints and RBAC.
2) Playwright checks — page reachability, session persistence, RBAC “Not authorised” detection, tenancy isolation.
3) Summary merge — aggregates `vitest.json` + `playwright.json` into `summary.json` and `summary.md`.

## Modes
- Read-only (default): `PROD_SMOKE_WRITE` unset or `0`; flow tests are marked `SKIP`.
- Write mode: set `PROD_SMOKE_WRITE=1` and provide `PROD_TEST_TENANT_SLUG`; flows attempt write-safe paths only within that tenant.

## Interpreting Results
- `summary.md` lists per-module and per-flow PASS/FAIL/SKIP with evidence locations.
- Playwright HTML + screenshots live under `html/` and `screenshots/` in the run folder.
- Logs per step are under `logs/`.

## Example
```bash
# Read-only
PROD_BASE_URL="https://app.nexaai.co.uk" \
PROD_SMOKE_UI_REQUIRED=1 \
PROD_SMOKE_SUPER_EMAIL="..." PROD_SMOKE_SUPER_PASSWORD="..." \
PROD_SMOKE_ADMIN_EMAIL="..." PROD_SMOKE_ADMIN_PASSWORD="..." \
PROD_SMOKE_STAFF_EMAIL="..." PROD_SMOKE_STAFF_PASSWORD="..." \
pnpm verify:prod-smoke

# Write-mode (PROD_TEST_TENANT_SLUG required)
PROD_BASE_URL="https://app.nexaai.co.uk" \
PROD_SMOKE_WRITE=1 \
PROD_TEST_TENANT_SLUG="prod-test" \
PROD_SMOKE_SUPER_EMAIL="..." PROD_SMOKE_SUPER_PASSWORD="..." \
PROD_SMOKE_ADMIN_EMAIL="..." PROD_SMOKE_ADMIN_PASSWORD="..." \
PROD_SMOKE_STAFF_EMAIL="..." PROD_SMOKE_STAFF_PASSWORD="..." \
pnpm verify:prod-smoke
```

