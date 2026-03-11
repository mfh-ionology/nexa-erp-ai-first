# Missing Functionality - Epic E13b

> Auto-generated during frontend E2E testing

## BUG: Suspend Tenant API returns 500 Internal Server Error
- **Journey**: J6: Suspend an Active Tenant, Step 5
- **Expected**: POST /admin/tenants/:id/suspend with `{ reason }` should return 200 with updated tenant summary showing SUSPENDED status
- **Actual**: API returns 500 `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}}`. The frontend correctly sends the request and handles the error gracefully with a toast notification.
- **Related Story**: E13b-2
- **Root Cause**: TenantLifecycleService.suspendTenant() in `apps/platform-api/src/services/tenant-lifecycle.service.ts` throws an unhandled error during the Prisma transaction. Possible causes: (1) syntax issue on line 317 (`/ Webhook:` instead of `// Webhook:`), (2) table name mismatch in raw SQL query `SELECT id, status FROM tenants`, or (3) missing/incompatible column data.
- **Suggested Fix**: Debug the platform API server logs to identify the exact error in TenantLifecycleService.suspendTenant(). The frontend implementation is correct.

## BLOCKED: Reactivate Tenant flow cannot be tested (depends on Suspend bug fix)
- **Journey**: J7: Reactivate a Suspended Tenant, Pre-step (setup)
- **Expected**: Journey 7 requires a SUSPENDED tenant to exist. The test first attempts to suspend an ACTIVE tenant via the frontend (mimicking J6), then reactivate it.
- **Actual**: The Suspend API returns 500 (same bug as J6 above), so no SUSPENDED tenant can be created through the frontend. The Reactivate button, confirmation dialog, and POST /admin/tenants/:id/reactivate endpoint cannot be exercised.
- **Related Story**: E13b-2
- **Dependency**: Requires the Suspend API bug (documented above) to be fixed first. Once a tenant can be suspended, the full reactivation flow can be tested.
- **Frontend Assessment**: The Reactivate button (`data-testid="reactivate-btn"`), ConfirmationDialog with "Reactivate Tenant" title and "restore full ERP access" description, and the `useReactivateTenant()` mutation hook all exist in the codebase and appear correctly implemented. The UI rendering cannot be visually verified until the precondition is met.

## Missing: Seeded AI usage data for cross-tenant dashboard testing
- **Journey**: J13: Cross-Tenant AI Usage Dashboard, Step 2-3
- **Expected**: Top consumers table should display up to 10 tenants with name links, tenant codes, and formatted token counts. Clicking a tenant name link should navigate to tenant detail AI usage drill-down.
- **Actual**: Top consumers section shows "No usage data available yet." because no AI usage records are seeded in the platform database. Step 3 (clicking a tenant link) could not be tested.
- **Related Story**: E13b-4
- **Suggested Story Title**: Seed AI usage data in platform-api prisma seed for E2E testing

## BUG: Update Provider API Key returns 500 Internal Server Error
- **Journey**: J16: Vendor AI Provider Key Management, Step 5
- **Expected**: Submitting a new API key via the Update Key modal should succeed (200), close the modal, and show a success toast. The provider row should show the updated masked key.
- **Actual**: The API returns an error ("An unexpected error occurred" shown in red in the modal). The modal stays open. The key is not updated. The frontend error handling works correctly (displays the error inline in the modal).
- **Related Story**: E13b-4
- **Root Cause**: The platform API endpoint for updating vendor provider keys (likely PUT /admin/ai/providers/:id/key or similar) is returning a server error. Needs investigation in platform API logs.
- **Suggested Fix**: Debug the platform API vendor credential update endpoint. The frontend `useUpdateProviderKey()` mutation and `UpdateKeyModal` component are correctly implemented.

## Missing: No Enterprise tenant with BYOK keys seeded for per-tenant BYOK testing
- **Journey**: J17: Per-Tenant AI Usage and BYOK Key Management, Steps 4b-6
- **Expected**: An Enterprise-plan tenant with BYOK keys should exist so that the BYOK management section (donut chart, key list, Add BYOK Key modal, toggle/remove actions) can be exercised through the frontend.
- **Actual**: The only seeded tenant ("Development Tenant") has a plan code that does not match "enterprise" (lowercase), so the BYOK section (`data-testid="byok-management-section"`) is correctly hidden. Steps 4b (BYOK section verification), 5 (Add BYOK Key modal), and 6 (cancel modal) were skipped.
- **Related Story**: E13b-4
- **Suggested Story Title**: Seed Enterprise tenant with BYOK keys in platform-api prisma seed for E2E testing

## Missing: Seeded AI alerts for alerts tab E2E testing
- **Journey**: J14: AI Quota Alerts and Spike Detection, Steps 2-6
- **Expected**: Alerts list should display active alerts with type-specific styling (quota_warning=amber, quota_exceeded=red, usage_spike=purple). Steps 3-4 test type filtering, step 5 tests acknowledge, step 6 tests viewing acknowledged alerts.
- **Actual**: Alerts tab shows "No active alerts" empty state. The PlatformAiAlert table exists in schema but no seed data is provided. All alert filtering, acknowledge, and acknowledged-view steps could not be tested.
- **Related Story**: E13b-4
- **Suggested Story Title**: Seed PlatformAiAlert records in platform-api prisma seed for E2E testing

## BUG: Impersonation sessions API stuck in loading state (30+ seconds)
- **Journey**: J18: Support Console Tenant Search, Step 8
- **Expected**: The "Recent Impersonation Sessions" section should finish loading and show either session rows or the "No impersonation sessions in the last 30 days" empty state.
- **Actual**: The sessions table remains in skeleton loading state for 30+ seconds and never resolves. The API endpoint (`GET /admin/impersonation-sessions`) appears to be failing or rate-limited, causing React Query to retry indefinitely. The frontend has no error handling for the sessions query (only checks `isLoadingSessions` and `sessions.length`), so a persistent error state manifests as an infinite loading spinner rather than an error message.
- **Related Story**: E13b-5
- **Suggested Fix**: (1) Add error handling to the sessions table in the Support Console page (display error message when `useImpersonationSessions()` returns an error), (2) Investigate why the sessions API endpoint fails or is heavily rate-limited during testing.

