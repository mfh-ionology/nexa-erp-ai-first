# Missing Functionality - Epic E2b

> Auto-generated during frontend E2E testing

## Missing: Frontend web application (Vite + React app shell)
- **Journey**: Admin Login and Permission-Driven Sidebar (j01), Step 1
- **Expected**: Navigating to http://localhost:5173/login should load a login page with email/password fields and Sign In button
- **Actual**: net::ERR_CONNECTION_REFUSED — apps/web is a stub with no Vite dev server, no React components, no routing, no login page
- **Related Story**: NEW
- **Suggested Story Title**: Build web app shell with Vite, React Router, and login page

## Missing: Login page with authentication form
- **Journey**: Admin Login and Permission-Driven Sidebar (j01), Step 1-3
- **Expected**: Login page with email input, password input, Sign In button that authenticates against the API and redirects to dashboard
- **Actual**: No frontend exists — apps/web/src/index.ts is an empty export stub
- **Related Story**: NEW
- **Suggested Story Title**: Implement login page with JWT authentication flow

## Missing: App shell with permission-driven sidebar navigation
- **Journey**: Admin Login and Permission-Driven Sidebar (j01), Step 3-5
- **Expected**: After login, dashboard loads with sidebar showing System module items (Users, Company Profile, Resource Registry, Access Groups) driven by GET /system/my-permissions
- **Actual**: No frontend exists — no app shell, no sidebar, no dashboard
- **Related Story**: NEW
- **Suggested Story Title**: Build app shell with permission-driven sidebar navigation using my-permissions API

## Missing: Resource Registry page (/system/resources)
- **Journey**: View System Resource Registry (j02), Steps 1-7
- **Expected**: T1 Entity List page at /system/resources displaying all registered system resources in a table with columns (Code, Name, Module, Type, Sort Order). Read-only page (no [+ New] button). Includes module filter dropdown, type filter dropdown, and search input for filtering resources.
- **Actual**: No frontend exists — apps/web is a stub. ERR_CONNECTION_REFUSED on page.goto('/login') in prerequisite step.
- **Related Story**: E2b-1
- **Suggested Story Title**: Implement Resource Registry list page (T1 Entity List) with filters and search

## Missing: Resource Registry module filter
- **Journey**: View System Resource Registry (j02), Step 5
- **Expected**: Module filter dropdown on Resource Registry page that filters table by module (e.g. "system")
- **Actual**: No frontend exists
- **Related Story**: E2b-1
- **Suggested Story Title**: Add module and type filter dropdowns to Resource Registry page

## Missing: Resource Registry search
- **Journey**: View System Resource Registry (j02), Step 7
- **Expected**: Search input on Resource Registry page that filters resources by matching code, name, or description (e.g. searching "access" shows only access-groups resources)
- **Actual**: No frontend exists
- **Related Story**: E2b-1
- **Suggested Story Title**: Add search input to Resource Registry page with client-side filtering

## Missing: Access Groups list page (/system/access-groups)
- **Journey**: View Access Group List with Pre-Built Groups (j03), Steps 1-7
- **Expected**: T1 Entity List page at /system/access-groups displaying all 12 pre-built system access groups in a table with columns (Code, Name, Description, System badge, Active Users, Created). Includes [+ New Access Group] button and search input. All pre-built groups should show a "System" badge/indicator.
- **Actual**: No frontend exists — apps/web is a stub. ERR_CONNECTION_REFUSED on page.goto('/login') in prerequisite step.
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement Access Groups list page (T1 Entity List) with system badges and search

## Missing: Access Groups system badge indicator
- **Journey**: View Access Group List with Pre-Built Groups (j03), Step 5
- **Expected**: Each pre-built system access group row displays a "System" badge/indicator showing isSystem: true
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Display system badge on pre-built access groups in list view

## Missing: Access Groups search/filter
- **Journey**: View Access Group List with Pre-Built Groups (j03), Steps 6-7
- **Expected**: Search input on Access Groups page that filters groups by matching code, name, or description (e.g. searching "manager" shows FINANCE_MANAGER, SALES_MANAGER, PURCHASE_MANAGER, HR_MANAGER). Clearing search restores all 12 groups.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Add search input to Access Groups page with client-side filtering

## Missing: Access Group create form (/system/access-groups/new)
- **Journey**: Create a Custom Access Group (j04), Step 2
- **Expected**: Clicking [+ New Access Group] navigates to /system/access-groups/new with a T7 Settings template in create mode showing empty form fields: Code (text input), Name (text input), Description (textarea)
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement Access Group create form page (T7 Settings template)

## Missing: Access Group creation flow with save and redirect
- **Journey**: Create a Custom Access Group (j04), Steps 3-4
- **Expected**: Filling in code (QA_TESTER), name (QA Tester), description and clicking [Save Settings] creates the access group via POST /system/access-groups (201 response). Shows success toast "Access group created" and redirects to the detail page for the new group showing code (read-only), name, description, and empty permission matrix.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement Access Group create/save flow with API integration and success feedback

## Missing: Access Group list reflects newly created groups
- **Journey**: Create a Custom Access Group (j04), Step 5
- **Expected**: After creating QA_TESTER, navigating back to /system/access-groups shows 13 groups (12 pre-built + QA_TESTER). QA_TESTER row has no System badge (isSystem: false) and user count showing 0.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Access Group list page fetches and displays all groups including newly created custom groups

## Missing: Duplicate access group code rejection (409 Conflict) in create form
- **Journey**: Create Access Group with Duplicate Code is Rejected (j05), Steps 1-3
- **Expected**: Navigating to /system/access-groups/new, filling in a duplicate code (QA_TESTER), and clicking [Save Settings] should display a 409 Conflict error toast or inline error showing "Access group code already exists for this company". The form should remain on the create page, allowing the user to correct the code and retry.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login'). The entire web application (login, routing, access group pages, form validation, error handling) does not exist yet.
- **Related Story**: E2b-2
- **Suggested Story Title**: Handle 409 Conflict errors in Access Group create form with user-friendly error display

## Missing: Access Group detail page with permission matrix (/system/access-groups/:id)
- **Journey**: View Access Group Detail with Permission Matrix (j06), Steps 1-6
- **Expected**: Clicking a group row in the Access Groups list navigates to /system/access-groups/:id — a T7 Settings page showing breadcrumb (System > Access Groups > Full Access), group title, Active status badge, [Save Settings] button, system group banner for isSystem groups. The page displays the group's permission matrix as a checkbox grid (columns: canAccess, canNew, canView, canEdit, canDelete) with resources grouped by module. For FULL_ACCESS, all 30 checkboxes (6 resources x 5 permissions) should be checked. A Field Overrides section is visible with a resource selector dropdown.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement Access Group detail page (T7 Settings) with permission matrix grid and field overrides panel

## Missing: Permission matrix checkbox grid
- **Journey**: View Access Group Detail with Permission Matrix (j06), Steps 4-5
- **Expected**: Permission matrix shows a checkbox grid with columns (canAccess, canNew, canView, canEdit, canDelete) and rows for each resource, grouped by module. For FULL_ACCESS, all checkboxes are checked. System module expanded showing 6 resources: User Management, User Detail, Company Profile, Resource Registry, Access Group List, Access Group Detail.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Build permission matrix component with module-grouped checkbox grid

## Missing: Field Overrides panel on Access Group detail page
- **Journey**: View Access Group Detail with Permission Matrix (j06), Step 6
- **Expected**: Field Overrides section visible on the Access Group detail page with a resource selector dropdown. For FULL_ACCESS, no overrides are configured (empty state).
- **Actual**: No frontend exists
- **Related Story**: E2b-5
- **Suggested Story Title**: Build field overrides panel with resource selector and visibility controls

## Missing: Access Group metadata edit flow (name and description)
- **Journey**: Edit Access Group Name and Description (j07), Steps 1-5
- **Expected**: Admin navigates to /system/access-groups, clicks QA_TESTER row to open its detail page, edits the Name field to "QA Testing Team" and Description to "Updated description for the QA testing access group", clicks [Save Settings] button. The API returns 200 with a success toast "Access group updated", the page reflects the updated name and description. Navigating back to the list shows the updated name "QA Testing Team" in the QA_TESTER row.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login'). The entire web application (login, routing, access group pages, detail form editing, save functionality) does not exist yet.
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement Access Group metadata editing (name/description) on detail page with save and list refresh

## Missing: Access Group detail page form fields (name, description editable)
- **Journey**: Edit Access Group Name and Description (j07), Steps 2-3
- **Expected**: The Access Group detail page (/system/access-groups/:id) should have editable Name and Description form fields for custom (non-system) groups. The Code field should be read-only after creation. Fields should be clearable and fillable for editing.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Access Group detail page with editable metadata form fields

## Missing: Access Group save with success toast and in-place refresh
- **Journey**: Edit Access Group Name and Description (j07), Step 4
- **Expected**: Clicking [Save Settings] on the Access Group detail page sends a PATCH/PUT request to the API, displays a success toast "Access group updated", and the page heading/title updates to reflect the new name without full page reload.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement save flow for Access Group metadata with toast feedback and optimistic UI update

## Missing: Permission matrix editing on Access Group detail page (interactive checkboxes)
- **Journey**: Configure Permission Matrix for Custom Group (j08), Steps 2-8
- **Expected**: The Access Group detail page shows an interactive permission matrix checkbox grid for each resource. Admin can check/uncheck individual permissions (canAccess, canNew, canView, canEdit, canDelete) per resource. For a newly created custom group (QA_TESTER), all checkboxes start unchecked. Clicking checkboxes toggles them in the UI before saving.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement interactive permission matrix checkbox grid with toggle support on Access Group detail page

## Missing: Permission matrix save with replace-all semantics
- **Journey**: Configure Permission Matrix for Custom Group (j08), Step 9
- **Expected**: Clicking [Save Settings] on the permission matrix sends PUT /access-groups/:id/permissions with the full set of selected permissions (replace-all semantics). Shows success toast "Permissions updated". The checkbox state is retained after save.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Wire permission matrix save to PUT API endpoint with replace-all semantics and success toast

## Missing: Permission matrix persistence verification (reload retains checked state)
- **Journey**: Configure Permission Matrix for Custom Group (j08), Steps 10-11
- **Expected**: After saving permissions, navigating back to the access group list and re-clicking the QA_TESTER row reloads the detail page from the API. The permission matrix should show the same 6 checkboxes checked (canAccess+canView on users.list, users.detail, company-profile.detail) — confirming data was persisted via the API.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Verify permission matrix loads persisted data from GET /access-groups/:id on detail page render

## Missing: Field Overrides panel with resource selector and empty state
- **Journey**: Configure Field-Level Visibility Overrides (j09), Step 3
- **Expected**: On the Access Group detail page (/system/access-groups/:id), a "Field Overrides" section/tab is present. Clicking it reveals a panel with a "Select Resource" dropdown and an empty state (no overrides configured yet for new/default groups).
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-5
- **Suggested Story Title**: Implement Field Overrides panel with resource selector dropdown and empty state display

## Missing: Field override configuration — set field visibility per resource
- **Journey**: Configure Field-Level Visibility Overrides (j09), Steps 4-6
- **Expected**: After selecting a resource (e.g. system.company-profile.detail) in the Field Overrides panel, a table of available fields appears. Each field has a visibility dropdown with options (VISIBLE, READ_ONLY, HIDDEN). Admin sets vatNumber to HIDDEN and registrationNumber to READ_ONLY. The overrides are reflected in the UI with correct dropdown selections.
- **Actual**: No frontend exists
- **Related Story**: E2b-5
- **Suggested Story Title**: Build field override table with per-field visibility dropdowns (VISIBLE, READ_ONLY, HIDDEN)

## Missing: Field override save via PUT API with success feedback
- **Journey**: Configure Field-Level Visibility Overrides (j09), Step 7
- **Expected**: Clicking [Save Settings] sends PUT /access-groups/:id/field-overrides with the configured overrides. Success toast "Field overrides updated" appears. The override table retains the HIDDEN and READ_ONLY settings after save.
- **Actual**: No frontend exists
- **Related Story**: E2b-5
- **Suggested Story Title**: Wire field override save to PUT /access-groups/:id/field-overrides with success toast and state retention

## Missing: User list page (/system/users) with navigable user rows
- **Journey**: Assign Access Groups to a User (j10), Step 1
- **Expected**: Navigating to /system/users loads a T1 Entity List page displaying all users in a table. The table should show user email, name, role, and be clickable to navigate to user detail pages.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: NEW
- **Suggested Story Title**: Implement User list page (T1 Entity List) with clickable rows for user detail navigation

## Missing: User detail page (/system/users/:id) with Access Groups assignment panel
- **Journey**: Assign Access Groups to a User (j10), Steps 2-3
- **Expected**: Clicking a user row (e.g. sales@nexa-test.co.uk) in the user list navigates to /system/users/:id — a T2 Record Detail page showing user info (email, role) and an Access Groups assignment panel. The panel should display currently assigned groups (e.g. SALES_STAFF) as tags/chips with assignedBy and assignedAt metadata.
- **Actual**: No frontend exists
- **Related Story**: E2b-3
- **Suggested Story Title**: Implement User detail page (T2 Record Detail) with Access Groups assignment panel showing current group assignments

## Missing: Access Group multi-select assignment on User detail page
- **Journey**: Assign Access Groups to a User (j10), Steps 4-5
- **Expected**: The Access Groups assignment panel includes a multi-select dropdown or combobox that shows all available access groups. Admin can select multiple groups (e.g. both SALES_STAFF and QA_TESTER) before saving. The selector should support adding/removing groups with the replace-all pattern.
- **Actual**: No frontend exists
- **Related Story**: E2b-3
- **Suggested Story Title**: Implement Access Group multi-select component on User detail page for replace-all group assignment

## Missing: Save access group assignments with PUT API and success toast
- **Journey**: Assign Access Groups to a User (j10), Step 6
- **Expected**: Clicking the "Save" button for access group assignments sends PUT /system/users/:id/access-groups with the selected group IDs. The API returns 200, and a success toast "Access groups updated" appears. The panel refreshes to show both SALES_STAFF and QA_TESTER as assigned groups with assignedBy and assignedAt timestamps.
- **Actual**: No frontend exists
- **Related Story**: E2b-3
- **Suggested Story Title**: Wire access group assignment save to PUT /system/users/:id/access-groups with success feedback and timestamp display

## Missing: Access group assignment persistence (reload verification)
- **Journey**: Assign Access Groups to a User (j10), Steps 7-8
- **Expected**: After saving group assignments, navigating back to /system/users and re-clicking the sales user row reloads the user detail page from the API. The Access Groups panel should show both SALES_STAFF and QA_TESTER still assigned, confirming the PUT replace-all assignment was persisted to the database.
- **Actual**: No frontend exists
- **Related Story**: E2b-3
- **Suggested Story Title**: Verify user access group assignments persist and load correctly on User detail page re-render

## Missing: Assign zero access groups rejected with 422 error on User detail page
- **Journey**: Assign Zero Access Groups Rejected (j11), Steps 1-4
- **Expected**: On the User detail page (/system/users/:id), admin removes all access group tags/chips from the sales user and clicks Save. The PUT /system/users/:id/access-groups with an empty array should return 422 Business Rule Violation. The UI should display an error toast or inline error message "At least one access group is required". The form should remain on the same page, and the previous access group assignments should remain intact.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login'). The entire web application (login, routing, user detail page, access group assignment panel, removal UI, error handling) does not exist yet.
- **Related Story**: E2b-3
- **Suggested Story Title**: Handle 422 validation error when saving empty access group assignments on User detail page

## Missing: Access group tag/chip removal UI on User detail page
- **Journey**: Assign Zero Access Groups Rejected (j11), Step 3
- **Expected**: The Access Groups assignment panel on the User detail page should provide a way to remove individual access group tags/chips (e.g. X button on each chip, or deselecting from a multi-select dropdown). Removing all groups should leave an empty selection state.
- **Actual**: No frontend exists
- **Related Story**: E2b-3
- **Suggested Story Title**: Implement removable access group tags/chips with empty state display on User detail page

## Missing: Permission-driven sidebar navigation hides unauthorized pages
- **Journey**: Verify Permission Enforcement - Limited User Denied Access (j12), Steps 3-4
- **Expected**: After logging in as sales@nexa-test.co.uk (SALES_STAFF group), the sidebar should NOT show "Resource Registry" or "Access Groups" links because SALES_STAFF lacks canAccess permission on system.resources.list and system.access-groups.list. The sidebar should be built from GET /system/my-permissions response, showing only pages the user has canAccess=true for.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-4
- **Suggested Story Title**: Implement permission-driven sidebar that hides menu items based on canAccess permissions from my-permissions API

## Missing: Access denied page for unauthorized direct navigation
- **Journey**: Verify Permission Enforcement - Limited User Denied Access (j12), Steps 5-6
- **Expected**: When a user without canAccess permission on system.resources.list navigates directly to /system/resources, the app should display an access denied / 403 Forbidden message or redirect to an unauthorized page. Same behavior for /system/access-groups. The user should NOT see the page content — only an error message explaining they lack permission.
- **Actual**: No frontend exists — no route guards, no permission checks, no access denied page component
- **Related Story**: E2b-4
- **Suggested Story Title**: Implement client-side route guards with access denied page for unauthorized navigation attempts

## Missing: Most-permissive-wins permission resolution driving sidebar and page access
- **Journey**: Verify Most-Permissive-Wins Permission Resolution (j13), Steps 1-5
- **Expected**: Sales user (sales@nexa-test.co.uk) has two access groups: SALES_STAFF (limited permissions) and QA_TESTER (canAccess+canView on system.users.list, system.users.detail, system.company-profile.detail). After login, the sidebar should show "Users" link because the union of permissions across both groups resolves canAccess=true for system.users.list via QA_TESTER. Clicking "Users" should load the user list page successfully (not 403).
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login'). The entire web application (login, routing, permission-driven sidebar, most-permissive-wins resolution) does not exist yet.
- **Related Story**: E2b-4
- **Suggested Story Title**: Implement most-permissive-wins permission resolution in sidebar and route guards using my-permissions API

## Missing: Permission-driven UI element visibility (canNew hides create buttons)
- **Journey**: Verify Most-Permissive-Wins Permission Resolution (j13), Step 6
- **Expected**: On the User list page, the [+ New User] button should be HIDDEN when the user's resolved permissions have canNew=false for system.users.list. QA_TESTER only grants canAccess+canView, not canNew. SALES_STAFF also doesn't grant canNew. So the union still results in canNew=false, and the button should not appear.
- **Actual**: No frontend exists
- **Related Story**: E2b-4
- **Suggested Story Title**: Hide create/edit/delete buttons based on canNew/canEdit/canDelete permission flags from resolved permissions

## Missing: Company Profile page with field-level visibility enforcement (/system/company-profile)
- **Journey**: Verify Field-Level Visibility in API Response (j14), Step 1
- **Expected**: Sales user (with QA_TESTER group granting canAccess+canView on system.company-profile.detail) navigates to /system/company-profile. The page should load the company profile form. Fields with HIDDEN override (vatNumber) should be completely absent from the rendered page. Fields with READ_ONLY override (registrationNumber) should be visible but non-editable (disabled/readonly attribute).
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-5
- **Suggested Story Title**: Implement Company Profile page with field-level visibility enforcement (HIDDEN removes fields, READ_ONLY disables them)

## Missing: HIDDEN field override removes field from rendered page
- **Journey**: Verify Field-Level Visibility in API Response (j14), Step 2
- **Expected**: When the API response includes _fieldMeta with vatNumber marked as HIDDEN (or the field is stripped from the response entirely by the field-filter hook), the Company Profile page should not render a "VAT Number" label or input field. The layout should not show a blank gap where the field would have been.
- **Actual**: No frontend exists
- **Related Story**: E2b-5
- **Suggested Story Title**: Frontend field-level visibility: strip HIDDEN fields from form rendering based on _fieldMeta or absent fields

## Missing: READ_ONLY field override renders field as non-editable
- **Journey**: Verify Field-Level Visibility in API Response (j14), Step 3
- **Expected**: When the API response includes _fieldMeta with registrationNumber marked as READ_ONLY, the Company Profile page should render the registrationNumber field as visible but non-editable — using disabled/readonly HTML attributes, greyed-out styling, or rendering as plain text instead of an input.
- **Actual**: No frontend exists
- **Related Story**: E2b-5
- **Suggested Story Title**: Frontend field-level visibility: render READ_ONLY fields as non-editable with visual distinction

## Missing: SUPER_ADMIN login and full sidebar access bypass
- **Journey**: SUPER_ADMIN Bypasses All Permission Checks (j15), Steps 1-3
- **Expected**: SUPER_ADMIN user (superadmin@nexa-test.co.uk) logs in and sees the dashboard with a full sidebar showing ALL System module items (Users, Company Profile, Resource Registry, Access Groups) regardless of access group assignments. SUPER_ADMIN bypass means isSuperAdmin=true in the my-permissions API response, and the frontend should show all menu items without checking individual canAccess flags.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-4
- **Suggested Story Title**: Implement SUPER_ADMIN sidebar bypass — show all menu items when isSuperAdmin is true

## Missing: SUPER_ADMIN access to Resource Registry and Access Groups pages
- **Journey**: SUPER_ADMIN Bypasses All Permission Checks (j15), Steps 4-5
- **Expected**: SUPER_ADMIN can navigate to /system/resources and /system/access-groups without any 403 or access denied response. Route guards should check isSuperAdmin flag and bypass all permission checks for SUPER_ADMIN role users.
- **Actual**: No frontend exists
- **Related Story**: E2b-4
- **Suggested Story Title**: Implement SUPER_ADMIN route guard bypass for all protected pages

## Missing: SUPER_ADMIN bypasses field-level visibility filtering on Company Profile
- **Journey**: SUPER_ADMIN Bypasses All Permission Checks (j15), Step 6
- **Expected**: SUPER_ADMIN navigates to /system/company-profile and ALL fields are visible and fully editable — including vatNumber and registrationNumber which would be HIDDEN/READ_ONLY for users with QA_TESTER group field overrides. The API returns all fields without _fieldMeta restrictions for SUPER_ADMIN, and the frontend renders them as normal editable fields.
- **Actual**: No frontend exists
- **Related Story**: E2b-5
- **Suggested Story Title**: SUPER_ADMIN bypasses field-level visibility — all fields visible and editable on Company Profile page

## Missing: My Permissions page (/system/my-permissions)
- **Journey**: Verify My Permissions Endpoint Data (j16), Step 4
- **Expected**: Navigating to /system/my-permissions loads a page or developer info panel displaying the current user's resolved permissions. For the admin user, this should show: role (ADMIN), isSuperAdmin (false), accessGroups list including FULL_ACCESS, permissions object with all system resources having all flags true, and enabledModules including "system".
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-4
- **Suggested Story Title**: Implement My Permissions page showing resolved permission data from GET /system/my-permissions API

## Missing: My Permissions data display (role, access groups, enabled modules)
- **Journey**: Verify My Permissions Endpoint Data (j16), Step 5
- **Expected**: The My Permissions page should display the user's role (ADMIN), their assigned access groups (FULL_ACCESS), and enabled modules (system) in a structured, readable format — whether as a formatted card view, table, or JSON display.
- **Actual**: No frontend exists
- **Related Story**: E2b-4
- **Suggested Story Title**: Display role, access groups, and enabled modules on My Permissions page

## Missing: Access Group detail page for system groups with system group banner and overflow menu
- **Journey**: System Access Group Cannot Be Deleted (j17), Step 2
- **Expected**: Clicking the READ_ONLY row in the Access Groups list navigates to /system/access-groups/:id — a T7 Settings page showing a system group banner ("This is a system access group — code cannot be changed and it cannot be deleted"), the group code READ_ONLY (read-only), name "Read Only", and Active status badge.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-2
- **Suggested Story Title**: Display system group banner on Access Group detail page for isSystem groups with code protection

## Missing: Overflow menu with disabled Deactivate option for system access groups
- **Journey**: System Access Group Cannot Be Deleted (j17), Steps 3-4
- **Expected**: On the Access Group detail page for a system group (isSystem: true), clicking the "More Actions" overflow menu button reveals a menu with a "Deactivate" option that is disabled/greyed out. The disabled option should have a tooltip explaining "System access groups cannot be deactivated". This prevents admin users from accidentally deleting pre-built groups.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement overflow menu on Access Group detail page with disabled Deactivate for system groups

## Missing: Access group removal from user via multi-select on User detail page
- **Journey**: Soft-Delete Custom Access Group (j18), Steps 1-4
- **Expected**: On the User detail page for sales@nexa-test.co.uk, admin removes QA_TESTER from the access group multi-select (keeping only SALES_STAFF) and saves. The PUT /system/users/:id/access-groups request replaces the full assignment with only SALES_STAFF. Success toast "Access groups updated" appears, and QA_TESTER is no longer shown in the assignment panel.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-3
- **Suggested Story Title**: Support access group removal via multi-select replace-all pattern on User detail page

## Missing: Custom access group deactivation via overflow menu with confirmation dialog
- **Journey**: Soft-Delete Custom Access Group (j18), Steps 5-9
- **Expected**: On the Access Group detail page for a custom group (QA_TESTER/QA Testing Team, isSystem: false), admin clicks the "More Actions" overflow menu, selects the enabled "Deactivate" option. A confirmation dialog appears asking "Are you sure you want to deactivate QA Testing Team?" with Confirm/Cancel buttons. Clicking Confirm sends DELETE /system/access-groups/:id (soft-delete, 204 response), shows success toast "Access group deactivated", and redirects to /system/access-groups where QA_TESTER is no longer visible (isActive filter defaults to true).
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login').
- **Related Story**: E2b-2
- **Suggested Story Title**: Implement custom access group deactivation flow with confirmation dialog and soft-delete API call

## Missing: Deactivated access groups hidden from active list (isActive filter)
- **Journey**: Soft-Delete Custom Access Group (j18), Step 9
- **Expected**: After deactivating QA_TESTER, the /system/access-groups list page (which defaults to showing only isActive=true groups) should no longer display QA_TESTER. The soft-deleted group remains in the database but is filtered out of the default view.
- **Actual**: No frontend exists
- **Related Story**: E2b-2
- **Suggested Story Title**: Access Groups list page filters by isActive=true by default, hiding deactivated groups

## Missing: Company Profile overflow menu with Export Config and Import Config options
- **Journey**: Export and Import Permission Configuration (j20), Steps 1-2
- **Expected**: On the Company Profile page (/system/company-profile), a "More Actions" overflow menu button is present. Clicking it reveals a dropdown with "Export Config" and "Import Config" options for exporting/importing the company's permission configuration as JSON.
- **Actual**: No frontend exists — apps/web is a stub with no Vite dev server, no React components, no routing. ERR_CONNECTION_REFUSED on page.goto('/login'). The entire web application (login, routing, company profile page, overflow menu, export/import actions) does not exist yet.
- **Related Story**: E2b-6
- **Suggested Story Title**: Add Export Config and Import Config options to Company Profile overflow menu

## Missing: Export permission configuration as JSON (GET /system/company-profile/export-defaults)
- **Journey**: Export and Import Permission Configuration (j20), Steps 3-4
- **Expected**: Clicking "Export Config" triggers GET /system/company-profile/export-defaults, which returns a JSON payload containing version, exportedAt, exportedFrom (company name), resources array, accessGroups array with permissions and fieldOverrides, vatCodes, paymentTerms, numberSeries, currencies. The frontend should display this in a preview dialog or initiate a download.
- **Actual**: No frontend exists and the API endpoint does not exist (no export-defaults route found in apps/api/src)
- **Related Story**: E2b-6
- **Suggested Story Title**: Implement export permission configuration API endpoint and frontend preview/download dialog

## Missing: Import permission configuration dialog with dry-run toggle
- **Journey**: Export and Import Permission Configuration (j20), Steps 5-6
- **Expected**: Clicking "Import Config" opens an import dialog/modal with a JSON textarea or file upload area, a dry-run toggle checkbox, and an Import button. The dialog allows admin to paste previously exported JSON and preview changes before applying.
- **Actual**: No frontend exists
- **Related Story**: E2b-6
- **Suggested Story Title**: Implement Import Config dialog with JSON input, dry-run toggle, and Import button

## Missing: Dry-run import with DRY_RUN status result (POST /system/company-profile/import-defaults)
- **Journey**: Export and Import Permission Configuration (j20), Step 7
- **Expected**: Submitting the import with dry-run enabled sends POST /system/company-profile/import-defaults with dryRun:true. The API returns status: "DRY_RUN" with summary counts (resources created/updated, access groups created/updated, permissions set) and no warnings. The frontend displays these results without persisting any changes.
- **Actual**: No frontend exists and the API endpoint does not exist
- **Related Story**: E2b-6
- **Suggested Story Title**: Implement dry-run import API endpoint and display DRY_RUN results in the import dialog

## Missing: Actual import with APPLIED status result
- **Journey**: Export and Import Permission Configuration (j20), Steps 8-9
- **Expected**: Unchecking dry-run and clicking Import sends POST /system/company-profile/import-defaults with dryRun:false. The API returns status: "APPLIED" with summary counts and empty warnings array. The frontend displays these results, confirming the permission configuration was re-applied successfully (round-trip fidelity).
- **Actual**: No frontend exists and the API endpoint does not exist
- **Related Story**: E2b-6
- **Suggested Story Title**: Implement actual import flow with APPLIED status result display confirming round-trip fidelity

## Missing: Access Group detail page with permission matrix editing (for cache invalidation flow)
- **Journey**: Verify Cache Invalidation After Permission Change (j21), Steps 1-5
- **Expected**: Admin navigates to /system/access-groups, clicks SALES_STAFF row, sees permission matrix with checkboxes for each resource. Admin checks canAccess and canView for system.resources.list and saves. A success toast "Permissions updated" appears, and the backend fires an accessGroup.updated event to invalidate the permission cache for all users in that group.
- **Actual**: No frontend exists — apps/web is a stub with no pages, routing, or components
- **Related Story**: E2b-2, E2b-4
- **Suggested Story Title**: Build Access Group detail page with interactive permission matrix and save functionality

## Missing: Login page with user switching and permission-driven sidebar (for cache invalidation verification)
- **Journey**: Verify Cache Invalidation After Permission Change (j21), Steps 6-9
- **Expected**: After admin modifies SALES_STAFF permissions, logging in as the sales user should immediately reflect the updated permissions. The sidebar (built from GET /system/my-permissions) should now show "Resource Registry" link, and navigating to /system/resources should load successfully — proving the permission cache was invalidated by the accessGroup.updated event and the user gets fresh permissions.
- **Actual**: No frontend exists — cannot verify cache invalidation via the UI
- **Related Story**: E2b-4
- **Suggested Story Title**: Implement login flow and permission-driven sidebar to verify real-time cache invalidation after permission changes

## Missing: Permission revert flow (admin restores original SALES_STAFF permissions)
- **Journey**: Verify Cache Invalidation After Permission Change (j21), Steps 10-17
- **Expected**: Admin logs back in, navigates to SALES_STAFF detail page, unchecks canAccess and canView for system.resources.list, and saves to restore original state. This is a cleanup step ensuring the test is idempotent.
- **Actual**: No frontend exists — cannot perform the revert operation via the UI
- **Related Story**: E2b-2
- **Suggested Story Title**: Access Group permission matrix supports toggling (checking/unchecking) permissions with save and cache invalidation
