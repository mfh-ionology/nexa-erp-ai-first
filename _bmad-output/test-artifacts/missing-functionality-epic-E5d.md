# Missing Functionality - Epic E5d

> Auto-generated during frontend E2E testing

## RESOLVED: Training Examples tab crash (was regression, now fixed)
- **Journey**: Journey 1: Knowledge Management Page Shell & Navigation, Step 4
- **Status**: RESOLVED — Training Examples tab now loads correctly. Shows training example cards with skill tags, category badges, toggles. Verified in run 2026-03-04T20:32.

## Bug: Corrections tab crashes with 500 error (React error boundary)
- **Journey**: Journey 1: Knowledge Management Page Shell & Navigation, Step 5
- **Expected**: Clicking "Corrections" tab should show correction logs with stats row, filters, and grouped accordion list
- **Actual**: App crashes with "500 Something went wrong" error page when Corrections tab is clicked. Note: `use-corrections.ts` was previously fixed to use `result.data.items` but the crash persists — may be a different root cause now (component rendering error, or the API endpoint itself returning an error).
- **Root Cause**: Previously identified as API response format mismatch in `use-corrections.ts` (now fixed to use `result.data.items`). Current crash may have a different cause — possibly the API endpoint returning an error, or a component rendering issue triggered by the response data.
- **Related Story**: E5d-5
- **Suggested Story Title**: Fix corrections tab crash — 500 error persists after data mapping fix
- **Also blocks**: Journey 11 (Create Knowledge Article from a Correction) — entire flow depends on Corrections tab loading successfully

## Missing: AI-generated article seed data for confirmation flow testing
- **Journey**: Journey 5: Confirm an AI-Generated Knowledge Article, Step 2
- **Expected**: At least one unconfirmed AI-generated article should be visible with "Needs Review" amber badge and confidence < 0.8, so the confirmation workflow can be tested
- **Actual**: All 12 articles in the database are admin-uploaded (source=ADMIN_UPLOADED) with isConfirmed=true and confidence=1.0 (100%). Pending Reviews KPI shows "0 — All articles confirmed". No "Needs Review" badges appear anywhere.
- **Related Story**: E5d-2 (AI article generation) / E5d-5 (Knowledge management UI)
- **Suggested Story Title**: Add E2E seed data with AI-generated unconfirmed articles for confirmation flow testing

## Bug: Delete article shows error toast instead of success toast with Undo
- **Journey**: Journey 6: Delete a Knowledge Article with Undo, Step 4
- **Expected**: After clicking "Deactivate" in the confirmation dialog, the article should be removed from the list (optimistic update) and a success toast should appear showing '"[article title]" deactivated' with an "Undo" button and 5-second countdown
- **Actual**: The API DELETE call returns HTTP 204 (No Content) correctly, but the frontend's `apiDelete` function attempts to parse the empty 204 response body as JSON, causing the mutation's `onError` handler to fire. An error toast appears with "Server returned non-JSON response (HTTP 204)" in red. The article remains in the list because the optimistic update is rolled back on error. The undo flow is never triggered.
- **Root Cause**: The shared API client's delete function does not handle 204 No Content responses — it unconditionally calls `response.json()` on the response body. For DELETE endpoints that correctly return 204 with no body, the function should check `response.status === 204` and skip JSON parsing.
- **Related Story**: E5d-5
- **Suggested Story Title**: Fix apiDelete to handle HTTP 204 No Content responses without JSON parsing error

## Bug: Delete training example fails to remove card from list (same HTTP 204 bug)
- **Journey**: Journey 8: Create, Edit, and Delete Training Examples, Step 11
- **Expected**: After confirming deletion, the training example card should be removed from the list
- **Actual**: Delete API returns HTTP 204 (No Content), frontend mutation's onError fires with "Server returned non-JSON response (HTTP 204)" error toast (red). Card remains visible in the list because optimistic update is rolled back.
- **Root Cause**: Same root cause as Journey 6 delete bug — the shared `apiDelete` function unconditionally calls `response.json()` on 204 responses. This affects all delete operations across the knowledge management feature (articles, training examples, corrections, etc.).
- **Related Story**: E5d-5
- **Suggested Story Title**: (Same fix as Journey 6) Fix apiDelete to handle HTTP 204 No Content responses

## Missing: Platform-suggested knowledge articles not seeded for accept/reject flow testing
- **Journey**: Journey 12: Accept a Suggested Knowledge Article from Platform, Step 1
- **Expected**: Suggested tab should display platform-suggested knowledge articles with category badges (Best Practice/Help/Default Config/Skill Update), content preview, version indicator, publishedAt date, and Accept/Reject/Edit&Accept buttons
- **Actual**: Suggested tab shows empty state: "You're all caught up — No new suggestions from the vendor." No suggested articles exist in the database for the tenant.
- **Related Story**: E5d-4 (Cross-Tenant Intelligence — platform knowledge distribution)
- **Suggested Story Title**: Add E2E seed data with platform-suggested knowledge articles for accept/reject flow testing

## Bug: Total Articles KPI shows 0 while article list shows 3 articles
- **Journey**: Journey 16: Stats Panel KPIs and Pending Reviews Navigation, Step 2
- **Expected**: Total Articles KPI card should display the correct count of knowledge articles and include a segmented mini-bar showing breakdown by source (Admin/AI/Platform/Corrections)
- **Actual**: Total Articles KPI displays "0" but the Knowledge Articles tab below shows 3 articles under "Business Processes" category. The source breakdown mini-bar is not rendered — no segmented bar is visible on the card. The KPI count is likely reading from a stats API endpoint that returns stale or zero data, while the article list reads from a separate articles endpoint.
- **Related Story**: E5d-5
- **Suggested Story Title**: Fix Total Articles KPI count to match actual article count and add source breakdown mini-bar

## Missing: Platform-suggested knowledge articles not seeded — reject and edit-accept flows untestable
- **Journey**: Journey 13: Reject and Edit-Accept Suggested Knowledge, Step 1
- **Expected**: Suggested tab should display at least 2 platform-suggested articles so that one can be rejected and another can be edit-accepted. Cards should show Reject, Accept, and Edit & Accept buttons.
- **Actual**: Suggested tab shows empty state: "You're all caught up — No new suggestions from the vendor." The backend API endpoint `/ai/knowledge-articles/suggested` does not exist in the API routes — no route handler is registered. The frontend hooks and UI components (reject confirmation dialog, edit-accept dialog with category remapping) are fully implemented but cannot be exercised without both: (1) the backend endpoint, and (2) seed data with platform-suggested articles.
- **Related Story**: E5d-4 (Cross-Tenant Intelligence — platform knowledge distribution)
- **Suggested Story Title**: Implement suggested knowledge API endpoints (list, accept, reject, accept-edited) and seed test data

## Bug: Deactivated article not removed from list despite successful toast (Journey 8)
- **Journey**: Journey 8: Delete (Soft-Delete) Knowledge Article with Undo, Step 4
- **Expected**: After clicking "Deactivate" and the success toast appearing ('"PO Approval Workflow Guide" deactivated' with Undo button), the article card should be removed from the list via optimistic update. The category article count should decrease.
- **Actual**: The success toast fires correctly (green checkmark, article title, Undo button visible), but the article card remains in the list. The category still shows "(12 articles)" and all 3 visible cards are unchanged. The delete mutation's onSuccess fires (toast proves it), but the query cache invalidation or optimistic update does not remove the card from the rendered list. Note: the HTTP 204 JSON parsing bug documented in Journey 6 may have been partially fixed (toast now fires via onSuccess, not onError), but the list invalidation is still broken.
- **Related Story**: E5d-5
- **Suggested Story Title**: Fix article list cache invalidation after successful deactivation — card not removed from UI

## Missing: Platform API not running — Journey 19 blocked
- **Journey**: Journey 19: Platform Intelligence Dashboard Overview, Step 1
- **Expected**: Platform Admin login at http://localhost:5112 should authenticate against Platform API on port 5101 and redirect to the dashboard, allowing verification of the AI Intelligence page with KPIs, sections, and FAB
- **Actual**: Login fails with "Network error. Please check your connection." because the Platform API (port 5101) is not running. The Vite dev proxy at /api/v1 forwards to localhost:5101, which is offline. All 3 steps of this journey are blocked.
- **Related Story**: E5d-6 (Platform Intelligence Dashboard)
- **Suggested Story Title**: Ensure Platform API dev server is started alongside platform-admin for E2E testing

## Bug: Platform API auth routes return 404 — Journey 20 blocked
- **Journey**: Journey 20: Feature Gaps Analysis and Insight Status Management, Step 1 (login)
- **Expected**: POST /admin/auth/login on Platform API (port 5101) should authenticate the platform admin user and return JWT tokens, allowing the test to proceed to the Intelligence dashboard and Feature Gaps section
- **Actual**: Platform API is running on port 5101 (health endpoint /admin/monitoring/health returns 200 OK), but POST /admin/auth/login returns HTTP 404 with `{"success":false,"error":{"code":"NOT_FOUND","message":"Route not found"}}`. The auth routes plugin (`platformAuthRoutesPlugin`) is registered in `app.ts` at line 119 with prefix `/admin/auth`, and the login handler is defined in `platform-auth.routes.ts` at line 70, but the route is not reachable. All 4 steps of this journey are blocked because login cannot succeed.
- **Root Cause**: The `platformAuthRoutesPlugin` uses `fastify-plugin` (`fp()`) which breaks Fastify encapsulation. It declares a dependency on `platform-jwt-verify`, but the route registration appears to silently fail — possibly a plugin ordering or encapsulation issue with the prefix registration. The health routes (registered without `fp()` or with different encapsulation) work correctly.
- **Related Story**: E5d-6 (Platform Intelligence Dashboard) / Platform API infrastructure
- **Suggested Story Title**: Fix Platform API auth routes not registering — POST /admin/auth/login returns 404

## Missing: Workflow Opportunities and Default Optimisation sections (blocked by login)
- **Journey**: Journey 21: Workflow Opportunities and Default Optimisation Insights, Steps 1-4
- **Expected**: Navigate to /intelligence, verify Workflow Opportunities section with action dropdowns (Review, Dismiss, Create Automation Suggestion), verify Default Optimisation section with adoption percentages, progress bars, and Make Default button, then click Make Default to transition insight to ACTIONED status
- **Actual**: Cannot reach /intelligence page because Platform Admin login fails with "Route not found" (same root cause as documented above). All 4 steps blocked.
- **Related Story**: E5d-6 (Platform Intelligence Dashboard)
- **Suggested Story Title**: Fix Platform API auth routes not registering — POST /admin/auth/login returns 404 (same as above)

## Bug: Feature Gaps, Workflow Opportunities, Default Optimisation sections crash with error boundaries
- **Journey**: Journey 22: Platform Dashboard — Feature Gaps, Workflow Opportunities, Default Optimisation, Steps 2-6
- **Expected**: All three insight sections should render with data: Feature Gaps with severity badges (HIGH/MEDIUM/LOW), status dropdowns; Workflow Opportunities with tenant percentages and action dropdowns; Default Optimisation with adoption progress bars and Make Default buttons
- **Actual**: Auth bypass via fetch mock + Vite module import works — page loads and KPIs render correctly. However, all three insight sections crash into error boundary states showing "Failed to load [Section Name]" with Retry buttons. No insight data, badges, dropdowns, or buttons are rendered. Console errors:
  1. `extractModule` in `insight-helpers.ts:4` — calls `.match()` on undefined (Feature Gaps, Default Optimisation)
  2. `StatusBadge` in `workflow-opportunities-section.tsx:223` — calls `.toLowerCase()` on undefined (Workflow Opportunities)
  3. `extractModuleFromSkillKey` in `skill-effectiveness-table.tsx:38` — calls `.split()` on undefined (Skill Effectiveness)
- **Root Cause**: The section components expect insight data fields that are undefined in the API response. Helper functions (`extractModule`, `StatusBadge`) lack null guards and crash on undefined input. Even with mock data including `module` and `status` fields, components use different extraction paths (e.g. extracting from `description` or `metadata` via regex rather than reading `module` directly).
- **Related Story**: E5d-6 (Platform Intelligence Dashboard)
- **Suggested Story Title**: Fix null-safety in insight section components — extractModule, StatusBadge, extractModuleFromSkillKey crash on undefined fields

## Missing: Industry Breakdown with Comparison Mode (blocked by login)
- **Journey**: Journey 23: Industry Breakdown with Comparison Mode, Steps 1-4
- **Expected**: Navigate to /intelligence, select Construction from industry dropdown to see 4 sub-panels (Top Query Categories, Most-Used Skills, Common Correction Types, Tenant Count), enable Compare Industries toggle, select Retail as second industry for side-by-side comparison
- **Actual**: Cannot reach /intelligence page because Platform Admin login fails with "Route not found" (same root cause as documented in Journey 20). All 4 steps blocked.
- **Related Story**: E5d-6 (Platform Intelligence Dashboard)
- **Suggested Story Title**: Fix Platform API auth routes not registering — POST /admin/auth/login returns 404 (same as above)

## Missing: Platform-suggested knowledge articles not seeded — accept flow untestable (Journey 15)
- **Journey**: Journey 15: Suggested Knowledge — Accept Platform Suggestion, Step 1
- **Expected**: Suggested tab should display platform-suggested knowledge articles with Accept, Edit & Accept, and Reject buttons, allowing the accept flow to be tested (creating a local copy with PLATFORM_SUGGESTED source and confidence 0.9)
- **Actual**: Suggested tab shows empty state: "You're all caught up — No new suggestions from the vendor." Same root cause as Journeys 12 and 13 — no platform-suggested articles exist in the database. The backend API endpoint for suggested articles and/or seed data is missing.
- **Related Story**: E5d-4 (Cross-Tenant Intelligence — platform knowledge distribution)
- **Suggested Story Title**: (Same as Journey 12/13) Add E2E seed data with platform-suggested knowledge articles and implement suggested knowledge API endpoints

## Missing: Platform-suggested knowledge articles not seeded — reject flow untestable (Journey 16)
- **Journey**: Journey 16: Suggested Knowledge — Reject Platform Suggestion, Step 2
- **Expected**: Suggested tab should display platform-suggested articles with Reject buttons, allowing the reject confirmation dialog flow to be tested
- **Actual**: Suggested tab shows empty state: "You're all caught up — No new suggestions from the vendor." Same root cause as Journeys 12, 13, and 15 — no platform-suggested articles exist in the database.
- **Related Story**: E5d-4 (Cross-Tenant Intelligence — platform knowledge distribution)
- **Suggested Story Title**: (Same as Journey 12/13/15) Add E2E seed data with platform-suggested knowledge articles and implement suggested knowledge API endpoints

## Missing: Platform-suggested knowledge articles not seeded — edit & accept flow untestable (Journey 17)
- **Journey**: Journey 17: Suggested Knowledge — Edit & Accept with Category Remap, Step 2
- **Expected**: Suggested tab should display platform-suggested articles with Edit & Accept buttons, allowing the edit form dialog to open pre-filled with platform article content, category remapped from platform to tenant taxonomy, so admin can modify content/category before accepting
- **Actual**: Suggested tab shows empty state: "You're all caught up — No new suggestions from the vendor." Same root cause as Journeys 12, 13, 15, and 16 — no platform-suggested articles exist in the database.
- **Related Story**: E5d-4 (Cross-Tenant Intelligence — platform knowledge distribution)
- **Suggested Story Title**: (Same as Journey 12/13/15/16) Add E2E seed data with platform-suggested knowledge articles and implement suggested knowledge API endpoints

## Blocked: Industry Breakdown & Correction Patterns — authentication prevents testing
- **Journey**: Journey 24: Platform Dashboard — Industry Breakdown & Correction Patterns, Steps 1-6
- **Expected**: Authenticate to Platform Admin, navigate to /intelligence, verify Industry Breakdown section with industry selector (All/Construction/Retail/Manufacturing/Professional Services/Other), sub-panels with data; Correction Patterns with category tabs, skill filter, Create Article buttons; Publish Knowledge side panel pre-filled from correction context
- **Actual**: Cannot reach /intelligence dashboard. Three blocking issues:
  1. `tryBootstrapAuth()` calls `fetch('/api/v1/admin/auth/refresh')` during TanStack Router's `beforeLoad`, but the fetch mock installed via `page.addInitScript` does not intercept this call (no mock log appears, despite the mock being confirmed active for other calls like auth/login)
  2. `PlatformLogin.handleSubmit()` calls `store.login(user, accessToken)` after successful form login but does NOT call `router.navigate()` — user stays on /login after successful auth
  3. `window.location.assign('/intelligence')` causes full page reload which resets in-memory zustand auth store, requiring tryBootstrapAuth again (which fails per bug #1)
- **Related Story**: E5d-6 (Platform Intelligence Dashboard)
- **Suggested Story Title**: Fix Platform Admin post-login navigation and auth bootstrap for E2E testability

## Missing: Platform Admin seed user cannot log in due to MFA enforcement
- **Journey**: Journey 21: Platform Intelligence Dashboard — App Shell & KPIs, Step 1
- **Expected**: Log in to Platform Admin (port 5112) with seed credentials (admin@nexa-platform.local / platform-admin-dev), then navigate to /intelligence to verify dashboard shell, KPIs, and data controls
- **Actual**: Login succeeds (credentials accepted) but server returns 403 "MFA required for PLATFORM_ADMIN accounts. Please set up MFA before logging in." The seed user in `apps/platform-api/prisma/seed.ts` has `mfaEnabled: false`, but business rule BR-PLT-018 requires MFA for PLATFORM_ADMIN accounts. All 3 journey steps blocked — cannot reach the intelligence dashboard.
- **Related Story**: E5d-6 (Platform Intelligence Dashboard)
- **Suggested Story Title**: Fix Platform Admin seed data to enable MFA for dev/test login (or bypass MFA in dev mode)

## Bug: Skill Effectiveness module filter broken due to case mismatch
- **Journey**: Journey 23: Platform Dashboard — Skill Effectiveness Table, Step 5
- **Expected**: Selecting "Finance" from module filter should show only Finance-module skills (invoice_categorisation, payment_matching, expense_classification, tax_calculation)
- **Actual**: Table shows "Showing 0 skills in Finance" — no rows displayed. Root cause: `extractModuleFromSkillKey()` at line 68 of `skill-effectiveness-table.tsx` returns `prefix.toUpperCase()` (e.g. "FINANCE"), but the filter compares with `MODULE_OPTIONS` values which are title case (e.g. "Finance"). The strict equality comparison `=== moduleFilter` at line 286 always fails.
- **Related Story**: E5d-6
- **Suggested Story Title**: Fix case mismatch in Skill Effectiveness module filter comparison

## Missing: Platform Intelligence Dashboard sidebar does not collapse at tablet/mobile viewports
- **Journey**: Journey 28: Platform Intelligence Dashboard — Responsive Layout, Steps 1-2
- **Expected**: At 768px (tablet), sidebar should collapse or show as hamburger menu. At 375px (mobile), sidebar should be fully hidden with a hamburger toggle.
- **Actual**: Sidebar remains fully visible at both 768px and 375px viewports. At mobile width, the sidebar takes up approximately 60% of viewport width, leaving the main content area extremely cramped. The page title "AI Intelligence" is truncated/cut off at 375px.
- **Related Story**: E5d-6
- **Suggested Story Title**: Implement responsive sidebar collapse for Platform Intelligence Dashboard at tablet and mobile breakpoints

## Missing: KPI cards do not reflow to 2-column grid at tablet viewport
- **Journey**: Journey 28: Platform Intelligence Dashboard — Responsive Layout, Step 1
- **Expected**: KPI cards should display in a 2-column grid at 768px tablet viewport (instead of 4-column desktop layout)
- **Actual**: KPI cards stack into a single vertical column at tablet width rather than adopting a 2-column grid layout. The layout jumps from 4-column (desktop) directly to 1-column (tablet) with no intermediate breakpoint.
- **Related Story**: E5d-6
- **Suggested Story Title**: Add responsive grid breakpoints for KPI cards (2-col at tablet, 1-col at mobile)

## Missing: Mobile accordion layout for dashboard sections not implemented
- **Journey**: Journey 28: Platform Intelligence Dashboard — Responsive Layout, Step 2
- **Expected**: At 375px mobile viewport, dashboard sections (Feature Gaps, Workflow Opportunities, Default Optimisation, Skill Effectiveness, Industry Breakdown) should render as collapsible accordions with only Summary Panel expanded by default. Table rows should display in card format.
- **Actual**: Sections render with collapsible headers (dropdown arrows visible) but no proper accordion `data-state` attributes are present (0 accordion elements detected). Summary panel does not auto-expand while others stay collapsed. No card-format rendering for table data at mobile.
- **Related Story**: E5d-6
- **Suggested Story Title**: Implement mobile-first accordion layout for Platform Intelligence Dashboard sections
