# Missing Functionality - Epic E3

> Auto-generated during frontend E2E testing

## Missing: Frontend Web Application (Vite dev server, React app shell)
- **Journey**: j01-admin-login-navigate-audit-log, Step 1
- **Expected**: Frontend dev server running at http://localhost:5173 serving a React SPA
- **Actual**: net::ERR_CONNECTION_REFUSED — no server listening on port 5173. The apps/web package is a stub with only an index.ts placeholder.
- **Related Story**: NEW
- **Suggested Story Title**: Bootstrap React frontend app with Vite, Tailwind CSS 4, Shadcn UI, and app shell layout

## Missing: Login Page (/login)
- **Journey**: j01-admin-login-navigate-audit-log, Step 1
- **Expected**: Login page at /login with email input, password input, and Sign In button. Should authenticate via POST /auth/login API.
- **Actual**: Page does not exist — frontend app is not built yet
- **Related Story**: NEW
- **Suggested Story Title**: Implement login page with email/password authentication and MFA support

## Missing: Dashboard / Home Page with App Shell
- **Journey**: j01-admin-login-navigate-audit-log, Step 3
- **Expected**: After successful login, redirect to dashboard with sidebar navigation containing System module links (Audit Log, Dead Letter Queue, etc.)
- **Actual**: No dashboard or app shell exists
- **Related Story**: NEW
- **Suggested Story Title**: Implement dashboard page with sidebar navigation and module-based menu

## Missing: Audit Log Page (/system/audit-log)
- **Journey**: j01-admin-login-navigate-audit-log, Step 4; j02-trigger-events-verify-audit-records, Steps 8-10
- **Expected**: Audit Log page accessible via sidebar link. Should display a filterable, cursor-paginated table of audit records with columns: Timestamp, Entity Type, Entity ID, Action, User, AI Action. Fetches data from GET /system/audit-log API. Should show event-triggered audit records (e.g., AccessGroup CREATE from access group creation, User LOGIN from authentication).
- **Actual**: Page does not exist
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log admin page with filtering, cursor pagination, and entity history view

## Missing: Access Groups Page with Create Functionality (/system/access-groups)
- **Journey**: j02-trigger-events-verify-audit-records, Steps 4-7
- **Expected**: Access Groups list page accessible via sidebar. Should have a "Create Access Group" button that opens a form with code, name, and description fields. On save, the access group is created via POST /system/access-groups API, which emits an accessGroup.created event captured by the audit trail.
- **Actual**: Page does not exist — frontend app is not built yet
- **Related Story**: NEW
- **Suggested Story Title**: Implement Access Groups list and create pages with form validation

## Missing: Event Bus → Audit Trail End-to-End UI Verification
- **Journey**: j02-trigger-events-verify-audit-records, Steps 9-10
- **Expected**: After performing actions (login, access group creation), navigate to Audit Log and verify corresponding records appear: entityType=AccessGroup/action=CREATE and entityType=User/action=LOGIN. This validates the full event bus → audit service → query API → UI display pipeline.
- **Actual**: Cannot verify — no frontend exists to display audit records
- **Related Story**: NEW
- **Suggested Story Title**: Implement audit log UI with real-time event record display and entity type/action filtering

## Missing: Audit Log Default List View with Sort Order and Pagination
- **Journey**: j03-audit-log-default-list, Steps 4-6
- **Expected**: Navigating to /system/audit-log loads the audit log table with default parameters: no filters applied, default limit of 50 records, sorted by timestamp descending (newest first). Table shows columns: Timestamp, Entity Type, Entity ID, Action, User, AI Action. Pagination controls are visible showing total count and current page. First record has the most recent timestamp.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log default list view with descending timestamp sort, cursor pagination controls, and column headers

## Missing: Audit Log Entity Type Filter
- **Journey**: j04-audit-log-filter-entity-type, Steps 4-7
- **Expected**: Audit log page at /system/audit-log has an Entity Type filter control (dropdown or combobox) that allows selecting a specific entity type (e.g., "User"). After selecting "User" and clicking "Apply Filters", the table refreshes to show only records where the Entity Type column reads "User". No records of other entity types should be visible. Pagination count reflects the filtered result count.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173. Failure screenshot shows blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log filter controls — Entity Type dropdown with apply/reset functionality

## Missing: Audit Log Action Type Filter
- **Journey**: j05-audit-log-filter-action, Steps 4-7
- **Expected**: Audit log page at /system/audit-log has an Action filter control (dropdown or combobox) that allows selecting a specific action type (e.g., "LOGIN"). After selecting "LOGIN" and clicking "Apply Filters", the table refreshes to show only records where the Action column reads "LOGIN". No records with other action types (CREATE, UPDATE, DELETE) should be visible. Pagination count reflects the filtered result count.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173. Failure screenshot shows blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log filter controls — Action type dropdown with apply/reset functionality

## Missing: Audit Log Date Range Filter
- **Journey**: j06-audit-log-filter-date-range, Steps 4-7
- **Expected**: Audit log page at /system/audit-log has date range filter controls (dateFrom and dateTo inputs, either date or datetime-local type). After setting dateFrom to 2026-02-21T00:00:00Z and dateTo to 2026-02-21T23:59:59Z and clicking "Apply Filters", the table refreshes to show only records with timestamps within that date range. All visible record timestamps should fall within the specified window. Pagination count reflects the filtered result count.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log filter controls — Date range (dateFrom/dateTo) inputs with apply/reset functionality

## Missing: Audit Log User ID Filter
- **Journey**: j07-audit-log-filter-user-id, Steps 4-6
- **Expected**: Audit log page at /system/audit-log has a User filter control (combobox/dropdown populated from user list, or text input accepting a userId UUID). After selecting or entering the admin user's ID and clicking "Apply Filters", the table refreshes to show only records where the User column matches that user. All visible rows should display the same userId. The filter works via the `userId` query parameter on GET /system/audit-log API.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173. Failure screenshot shows blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log filter controls — User ID picker/dropdown with apply/reset functionality

## Missing: Audit Log Combined Filter Support (entityType + action + date range)
- **Journey**: j08-audit-log-combined-filters, Steps 1-6
- **Expected**: Audit log page at /system/audit-log supports applying multiple filters simultaneously: entityType=User, action=LOGIN, and dateFrom/dateTo set to today (2026-02-21). After clicking "Apply Filters", the table refreshes to show only records matching the intersection of ALL three criteria — every visible row must show entityType=User AND action=LOGIN AND a timestamp from today. The combined filter is sent as query parameters to GET /system/audit-log?entityType=User&action=LOGIN&dateFrom=2026-02-21T00:00:00Z&dateTo=2026-02-21T23:59:59Z. Total count in pagination reflects the combined filter result count.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173. Failure screenshot shows blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log combined filter support — apply multiple filter criteria simultaneously with intersection logic

## Missing: Entity Change History View (/system/audit-log/:entityType/:entityId)
- **Journey**: j09-audit-log-entity-history, Steps 4-7
- **Expected**: From the Audit Log list page, each audit record row for an entity has a "View History" link/button. Clicking it navigates to an entity history view showing the full chronological audit trail for that specific entity (e.g., an AccessGroup). The view calls GET /system/audit-log/:entityType/:entityId and displays records in ascending chronological order (oldest first). Each entry shows: timestamp, action (CREATE/UPDATE/DELETE), user who made the change, and before/after data diffs. The first record should have action=CREATE. All records share the same entityType and entityId.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173. Failure screenshot shows blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Entity Change History view — chronological timeline with before/after data diffs per entity

## Missing: Audit Log Cursor-Based Pagination (Next/Previous Page)
- **Journey**: j10-audit-log-cursor-pagination, Steps 4-6
- **Expected**: Navigating to /system/audit-log?limit=5 loads the audit log table with at most 5 records per page. Pagination controls include a "Next Page" button (enabled when hasMore is true) and a "Previous Page" button (enabled when on page 2+). Clicking "Next Page" fetches the next set of records using cursor-based pagination (passing the last record's cursor to the API). Page 2 records must be different from page 1 — no duplicates across pages. Page 2's first timestamp should be earlier than page 1's last timestamp (descending sort). The API uses GET /system/audit-log?limit=5&cursor=<cursorValue>.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log cursor-based pagination with Next/Previous page navigation and limit support

## Missing: Audit Record Detail View with AI Action Fields (isAiAction, aiConfidence)
- **Journey**: j11-audit-log-ai-action-fields, Steps 4-6
- **Expected**: On the audit log page at /system/audit-log, clicking an audit record row opens a detail view (expanded row, side panel, or modal) showing all fields including: isAiAction (currently false for all records since no AI module exists), aiConfidence (null or N/A), correlationId, beforeData and afterData as formatted JSON. The isAiAction field must clearly display "false" or "No" to indicate the action was not AI-initiated. This tests E3.2-AC5 (AI action metadata fields).
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173. No screenshots could be captured at visual checkpoints.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Audit Log record detail view with expandable rows showing AI action fields, correlation ID, and before/after data diffs

## Missing: Authentication Guard — Redirect Unauthenticated Users from Protected Routes
- **Journey**: j12-audit-log-unauthorized-401, Step 1
- **Expected**: Navigating directly to /system/audit-log without being logged in should either redirect to /login or display a 401 Unauthorized error. Audit log data must NOT be visible to unauthenticated users. This tests the frontend auth guard/route protection — the backend API returns 401, and the frontend should handle it gracefully.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub. net::ERR_CONNECTION_REFUSED on localhost:5173. Failure screenshot shows blank white page (no server listening).
- **Related Story**: NEW
- **Suggested Story Title**: Implement frontend route guards — redirect unauthenticated users to /login for protected routes

## Missing: Permission-Based Route Protection — 403 Forbidden for Users Without system.audit-log.list Permission
- **Journey**: j13-audit-log-forbidden-403, Steps 1-4
- **Expected**: A sales user (sales@nexa-test.co.uk) with SALES_STAFF access group (which does NOT include system.audit-log.list permission) logs in successfully, then navigates to /system/audit-log. The frontend should either: (a) show a 403 Forbidden error page/toast with "You do not have permission to access this resource", (b) redirect to a "not authorized" page, or (c) hide the Audit Log link from the sidebar entirely. Critically, no audit log data should be visible to this user. The backend API returns 403 for this user on GET /system/audit-log, and the frontend must handle it gracefully.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no sidebar, no route protection. No screenshots could be captured at any visual checkpoint.
- **Related Story**: NEW
- **Suggested Story Title**: Implement permission-based route guards — show 403 Forbidden for users without required resource permissions (system.audit-log.list)

## Missing: Dead Letter Queue Page (/system/dead-letter-queue)
- **Journey**: j14-admin-navigate-dead-letter-queue, Steps 1-4
- **Expected**: An ADMIN user with FULL_ACCESS logs in and navigates to the Dead Letter Queue page via a sidebar link under the System section. The DLQ page should display: (a) filter controls for Event Name and Reprocessed status, (b) a data table with columns: ID, Event Name, Error, Retry Count, Original Timestamp, Reprocessed, Actions. If no failed events exist, an empty state message should be shown. The page fetches data from GET /system/dead-letter-queue API and requires the system.dead-letter-queue.list permission.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no sidebar navigation, no Dead Letter Queue page. The test failed at Step 1 (page.goto('/login')) with ERR_CONNECTION_REFUSED. Failure screenshot shows a blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Dead Letter Queue admin page with event list table, filters, and reprocess action

## Missing: Dead Letter Queue Entry Detail View (expand/click row to see full details)
- **Journey**: j15-dlq-view-failed-events, Steps 4-6
- **Expected**: On the Dead Letter Queue page at /system/dead-letter-queue, clicking a DLQ entry row opens a detail view (expanded row, side panel, or modal) showing all entry fields: Event Name (e.g., 'accessGroup.created'), Payload (formatted JSON), Error message, Stack trace (collapsible), Retry Count (3), Original Timestamp, Created At, Reprocessed status (false), and a 'Reprocess' action button. All required fields (eventName, payload, error, retryCount, originalTimestamp, reprocessed) must be present and populated with data from GET /system/dead-letter-queue/:id.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no DLQ page, no detail view. The test failed at Step 1 (page.goto('/login')) with ERR_CONNECTION_REFUSED. Failure screenshot shows a blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Dead Letter Queue entry detail view with expandable rows showing event payload, error, stack trace, retry count, and reprocess action

## Missing: Dead Letter Queue Event Name Filter
- **Journey**: j16-dlq-filter-event-name, Steps 4-6
- **Expected**: On the Dead Letter Queue page at /system/dead-letter-queue, there is an Event Name filter control (text input or dropdown). After entering "accessGroup.created" in the Event Name filter and clicking "Apply Filters", the table refreshes to show only DLQ entries where the Event Name column reads "accessGroup.created". If no matching entries exist, an empty state message is shown. The filter is sent as a query parameter to GET /system/dead-letter-queue?eventName=accessGroup.created. The Event Name filter input should retain its value after applying.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no DLQ page, no filter controls. The test failed at Step 1 (page.goto('/login')) with ERR_CONNECTION_REFUSED. Failure screenshot shows a blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Dead Letter Queue filter controls — Event Name text filter with apply/reset functionality

## Missing: Dead Letter Queue Reprocessed Status Filter
- **Journey**: j17-dlq-filter-reprocessed-status, Steps 4-8
- **Expected**: On the Dead Letter Queue page at /system/dead-letter-queue, there is a Reprocessed status filter control (dropdown or combobox with options: All, Pending/false, Reprocessed/true). After selecting "false" (pending) and clicking "Apply Filters", the table refreshes to show only DLQ entries where the Reprocessed column reads "false" or shows a "Pending" badge — all entries should have a Reprocess action button available. After changing the filter to "true" (reprocessed) and clicking "Apply Filters" again, the table refreshes to show only entries where the Reprocessed column reads "true" or shows a "Reprocessed" badge with a reprocessedAt timestamp — the Reprocess button should be disabled or hidden for these entries. The filter is sent as a query parameter to GET /system/dead-letter-queue?reprocessed=false or ?reprocessed=true.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no DLQ page, no filter controls. The test failed at Step 1 (page.goto('/login')) with ERR_CONNECTION_REFUSED. Failure screenshot shows a blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Dead Letter Queue filter controls — Reprocessed status dropdown with pending/reprocessed filtering and apply/reset functionality

## Missing: Dead Letter Queue Reprocess Entry Action (manual reprocessing with confirmation dialog)
- **Journey**: j18-dlq-reprocess-entry, Steps 1-8
- **Expected**: On the Dead Letter Queue page at /system/dead-letter-queue, each pending DLQ entry (reprocessed=false) has a "Reprocess" action button. Clicking it opens a confirmation dialog asking "Are you sure you want to reprocess this event? The event will be re-emitted through the event bus for all subscribers." Clicking "Confirm" triggers POST /system/dead-letter-queue/:id/reprocess, which re-emits the failed event. On success: (a) a success toast appears with "Event reprocessed successfully", (b) the entry's reprocessed field changes to true, (c) a reprocessedAt timestamp appears, (d) the Reprocess button is disabled or hidden for that entry. This tests E3.3-AC4 (manual reprocessing of dead-letter entries).
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no DLQ page, no reprocess action button, no confirmation dialog. The test failed at Step 1 (page.goto('/login')) with ERR_CONNECTION_REFUSED. Failure screenshot shows a blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Dead Letter Queue reprocess action — confirmation dialog, API call, success/error feedback, and entry status update

## Missing: Dead Letter Queue 409 Conflict Handling for Already-Reprocessed Entries
- **Journey**: j19-dlq-reprocess-already-processed-409, Steps 1-5
- **Expected**: On the Dead Letter Queue page at /system/dead-letter-queue?reprocessed=true, when viewing already-reprocessed entries, the UI should either: (a) disable/hide the Reprocess button for entries with reprocessed=true (preventing the action), or (b) if the button is clickable, show a 409 Conflict error toast/message reading "Dead-letter entry has already been reprocessed" after the API returns 409. The entry state should remain unchanged. This tests E3.3-AC4 (idempotent reprocessing guard).
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no DLQ page, no reprocess button, no 409 error handling. The test failed at Step 1 (page.goto('/login')) with ERR_CONNECTION_REFUSED. Failure screenshot shows a blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement Dead Letter Queue 409 conflict handling — disable reprocess button for already-reprocessed entries or show conflict error toast

## Missing: Authentication Guard — Redirect Unauthenticated Users from Dead Letter Queue Route
- **Journey**: j20-dlq-unauthorized-401, Step 1
- **Expected**: Navigating directly to /system/dead-letter-queue without being logged in should either redirect to /login or display a 401 Unauthorized error. Dead Letter Queue data must NOT be visible to unauthenticated users. This tests the frontend auth guard/route protection — the backend API returns 401, and the frontend should handle it gracefully by redirecting to the login page or showing an unauthorized message.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no route guards, no DLQ page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement frontend route guards — redirect unauthenticated users to /login for protected routes (covers both audit-log and dead-letter-queue)

## Missing: Permission-Based Route Protection — 403 Forbidden for Users Without system.dead-letter-queue.list Permission
- **Journey**: j21-dlq-forbidden-403, Steps 1-4
- **Expected**: A sales user (sales@nexa-test.co.uk) with SALES_STAFF access group (which does NOT include system.dead-letter-queue.list permission) logs in successfully, then navigates to /system/dead-letter-queue. The frontend should either: (a) show a 403 Forbidden error page/toast with "You do not have permission to access this resource", (b) redirect to a "not authorized" page, or (c) hide the Dead Letter Queue link from the sidebar entirely. Critically, no DLQ data should be visible to this user. The backend API returns 403 for this user on GET /system/dead-letter-queue, and the frontend must handle it gracefully.
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no sidebar, no route protection. No screenshots could be captured at any visual checkpoint.
- **Related Story**: NEW
- **Suggested Story Title**: Implement permission-based route guards — show 403 Forbidden for users without required resource permissions (system.dead-letter-queue.list)

## Missing: Full Audit Lifecycle End-to-End UI Flow (Create → Update → Audit Records → Entity History)
- **Journey**: j22-full-audit-lifecycle, Steps 1-14
- **Expected**: Complete audit lifecycle tested through frontend: (1) Login as admin, (2) Navigate to Access Groups page, (3) Create a new access group "LIFECYCLE_TEST" / "Lifecycle Test Group", (4) Edit the access group to rename it to "Lifecycle Test Group (Updated)", (5) Navigate to Audit Log page, (6) Filter by entityType=AccessGroup, (7) Verify CREATE and UPDATE audit records are visible for LIFECYCLE_TEST, (8) Click "View History" to see chronological entity history showing CREATE then UPDATE with before/after data diffs. This tests the full event bus → audit service → query API → UI display pipeline (E3.1-AC1, E3.2-AC1, E3.2-AC4).
- **Actual**: Cannot verify — no frontend web application exists. The apps/web package is a stub (apps/web/src/index.ts contains only a placeholder export). net::ERR_CONNECTION_REFUSED on localhost:5173 — no server listening. No login page, no dashboard, no access groups page, no audit log page, no entity history view. The test failed at Step 1 (page.goto('/login')) with ERR_CONNECTION_REFUSED. Failure screenshot shows a blank white page.
- **Related Story**: NEW
- **Suggested Story Title**: Implement full audit lifecycle UI — access group CRUD with audit log integration, entity history view, and filter-by-entity-type support
