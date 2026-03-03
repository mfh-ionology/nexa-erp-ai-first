# Phase 1.2a Canonical Baseline Checklist (Hard-Fail)

Single Source of Truth:
- Master Plan: `docs/master-plan/nexa-erp-v1-master-plan.md`
- Phase Spec: `docs/spec-intake/phase-1.2a.external.md`

Purpose:
Lock the minimal canonical flows and invariants required by the Master Plan (Auth, RBAC, Tenancy, Core routes) so every subsequent phase has a proven baseline. Any missing item is a FAIL.

## 1) Personas (no secrets in docs)
Use env vars only (never paste credentials into docs):
- SUPER_ADMIN: `PROD_SMOKE_SUPER_EMAIL` / `PROD_SMOKE_SUPER_PASSWORD`
- ADMIN: `PROD_SMOKE_ADMIN_EMAIL` / `PROD_SMOKE_ADMIN_PASSWORD`
- STAFF: `PROD_SMOKE_STAFF_EMAIL` / `PROD_SMOKE_STAFF_PASSWORD`

## 2) Canonical authentication flows (must PASS)
A1. Login (credentials) → `/dashboard`
- PASS for: SUPER_ADMIN, ADMIN, STAFF
- Expected: redirect to `/dashboard`, authenticated UI shell visible

A2. Session persistence
- PASS for: SUPER_ADMIN, ADMIN, STAFF
- Expected: hard refresh on `/dashboard` stays authenticated (no redirect to `/login`)

A3. Logout
- PASS for: SUPER_ADMIN, ADMIN, STAFF
- Expected: lands on `/login`
- Expected: attempting to access a protected route after logout redirects to `/login`

A4. Forgot/reset password basic reachability (minimum baseline)
- `/forgot-password` page loads (public)
- `/api/auth/forgot-password` returns 200 (even if SMTP missing; must not leak errors)
- `/reset-password` page loads (public)

## 3) Canonical route baseline (explicit)
These routes MUST exist and load with deterministic outcomes.

### 3.1 Public routes (must be 200)
- `/`
- `/login`
- `/forgot-password`
- `/reset-password`
- `/legal/privacy`
- `/legal/terms`
- `/legal/cookies`
- `/status`

### 3.2 Core shell routes (tenant-scoped; require auth)
- `/dashboard`
- `/notifications`
- `/tasks`
- `/activity`

### 3.3 Tenant Admin Console routes (ADMIN only)
- `/admin`
- `/admin/company`
- `/admin/users`
- `/admin/roles`
- `/admin/security`
- `/admin/billing`
- `/admin/integrations`
- `/admin/numbering`
- `/admin/tax`
- `/admin/audit`
- `/admin/data-import`
- `/admin/data-export`

### 3.4 Platform Console routes (SUPER_ADMIN only)
- `/sa`
- `/sa/tenants`
- `/sa/users`
- `/sa/billing`
- `/sa/support`
- `/sa/audit`
- `/sa/monitoring`
- `/sa/feature-flags`
- `/sa/migrations`
- `/sa/integrations`

### 3.5 ERP module smoke routes (minimum subset used for baseline)
Finance:
- `/finance/overview`
- `/finance/ar/invoices`
- `/finance/ap/bills`
- `/finance/reports` (if restricted for STAFF, must show Not Authorised deterministically)
Inventory/WMS:
- `/inventory/overview`
- `/inventory/items`
Sales/CRM:
- `/sales/overview`
- `/sales/leads`

## 4) RBAC matrix for the baseline routes (explicit expected outcomes)

Legend:
- ALLOW: 200 + authenticated shell + route marker
- DENY: deterministic Not Authorised UI OR 403 (must be consistent per route)
- REDIRECT: to `/login` if unauthenticated

### 4.1 Public routes
- All roles (including unauthenticated): ALLOW (200)

### 4.2 Core shell routes
- Unauthenticated: REDIRECT
- SUPER_ADMIN: ALLOW
- ADMIN: ALLOW
- STAFF: ALLOW

### 4.3 Tenant Admin Console routes (/admin/*)
- Unauthenticated: REDIRECT
- SUPER_ADMIN: DENY by default unless explicitly in support mode (future phase); for Phase 1.2a treat as DENY (to avoid silent tenant mutation)
- ADMIN: ALLOW
- STAFF: DENY

### 4.4 Platform Console routes (/sa/*)
- Unauthenticated: REDIRECT
- SUPER_ADMIN: ALLOW
- ADMIN: DENY
- STAFF: DENY

### 4.5 Finance/Inventory/Sales baseline module routes
- Unauthenticated: REDIRECT
- SUPER_ADMIN: ALLOW (support-audited behaviour handled in later phase; Phase 1.2a requires at least safe read access without errors)
- ADMIN: ALLOW
- STAFF: ALLOW except:
  - `/finance/reports`: DENY (Not Authorised or 403) if your policy restricts it (must be deterministic)

## 5) Tenancy isolation test cases (concrete; must PASS)

T1. Cross-tenant API read is blocked
- Setup: login as ADMIN of Tenant A
- Action: call an API endpoint (e.g., finance invoice fetch) using an ID belonging to Tenant B
- PASS: response is 403 (preferred) or 404 (if masking is the chosen policy), but MUST NOT return Tenant B data

T2. Cross-tenant API write is blocked
- Setup: login as ADMIN of Tenant A
- Action: attempt to create/update a record with Tenant B identifiers (or using an endpoint targeting Tenant B)
- PASS: 403/404; no write occurs

T3. Cross-tenant UI navigation does not leak
- Setup: login as Tenant A user
- Action: attempt to open a Tenant B record route directly by URL (e.g., `/finance/ar/invoices/[id]`)
- PASS: Not Authorised/404; never renders Tenant B data

T4. Tenant derived from session only (never client-provided)
- PASS: APIs ignore any client tenantId input; tenantId is derived server-side from session

T5. Search isolation (if `/search` exists)
- Setup: Tenant A user
- Action: run global search for known Tenant B unique identifiers
- PASS: no Tenant B results returned

## 6) Schema/migration hardening checks (minimum verification)
S1. tenantId required enforcement
- PASS: all tenant-scoped tables have required tenantId in Prisma schema (or documented exceptions for global reference tables)

S2. Composite uniqueness for business identifiers
- PASS: key business numbers are unique per tenant (e.g., Invoice.number unique (tenantId, number))

S3. Migration safety posture
- PASS: migrations follow expand/backfill/contract when needed; no destructive schema changes without staged rollout

## 7) Verification procedure + evidence (hard-fail)

V1. Local verification (minimum)
- Run typecheck:
  - `pnpm -C apps/web typecheck`
- Run the smallest relevant test set for any changes made in Phase 1.2a (Phase 1.2a is baseline; keep tests minimal but sufficient)

V2. Preview verification (required for completion)
- Deploy preview from branch `phase1/phase-1.2a`
- Run prod-smoke wrapper against preview URL:

  PROD_BASE_URL="https://<NEW_PREVIEW>.vercel.app" \
  VERCEL_AUTOMATION_BYPASS_SECRET="b0b46fd9e7b45c5d389f044dcbc39fa4" \
  PROD_SMOKE_UI_REQUIRED=1 \
  PROD_SMOKE_SUPER_EMAIL="(env)" \
  PROD_SMOKE_SUPER_PASSWORD="(env)" \
  PROD_SMOKE_ADMIN_EMAIL="(env)" \
  PROD_SMOKE_ADMIN_PASSWORD="(env)" \
  PROD_SMOKE_STAFF_EMAIL="(env)" \
  PROD_SMOKE_STAFF_PASSWORD="(env)" \
  pnpm run verify:prod-smoke:safe

- Evidence folder MUST be saved under:
  `reports/verification/prod-smoke-wrapper-<timestamp>/`

V3. Hard-fail rules
- Any missing route above is a FAIL unless explicitly feature-flagged in the Master Plan with documented rationale.
- Any RBAC mismatch is a FAIL.
- Any tenancy leak is a FAIL.
- Any Prisma runtime error in logs is a FAIL.
- Any skipped E2E test is a FAIL unless explicitly accepted.

## 8) Phase 1.2a completion artefacts (only after V2 is green)
- `docs/checkpoints/phase-1.2a.md` with timestamp, branch, sha, preview URL, evidence folder, PASS summary.
- Annotated tag `phase-1.2a-green` pushed.
