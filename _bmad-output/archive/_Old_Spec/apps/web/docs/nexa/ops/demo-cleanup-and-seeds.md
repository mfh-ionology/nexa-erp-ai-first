# Demo Cleanup & Onboarding Seeds

## Onboarding model
- Users can be created with a temporary password via `onboardUserWithTempPassword`.
- Temp password is emailed (or logged if SMTP missing) with a clear note to change on first login.
- `mustChangePasswordOnNextLogin` is enforced in-app via the blocking modal after login (no redirect to legacy reset routes).

## Seeding
- Reference data and canonical users run as normal.
- Demo data is **opt-in only**: set `SEED_DEMO_DATA=true` before running demo seeds (e.g. `pnpm tsx scripts/seed/demo-data.ts`). Without the flag, demo seeds exit immediately.
- Production/staging default: no demo tenants/data unless explicitly gated by env.

## Cleanup
- Preferred: create a fresh DB/Neon branch and re-seed.
- Last resort: `NUKE_ALL_TENANT_DATA=YES_I_UNDERSTAND pnpm tsx scripts/ops/nuke-tenant-data.ts` — wipes tenant-scoped data except platform/root tenants.
- Existing `cleanup-demo-data.ts` remains focused on demo patterns; `nuke-tenant-data.ts` is the explicit wipe tool.

## How to use onboarding helper
1) Import `onboardUserWithTempPassword` from `src/server/auth/onboarding.service`.
2) Call with `{ email, role, tenantId, tenantName, loginUrl }`.
3) The helper creates the user with `mustChangePasswordOnNextLogin=true`, returns the temp password, and sends/logs the welcome email.
4) User signs in, is redirected to `/reset-temp-password`, sets a new password, and continues.


