# Journey 18: Support Console Tenant Search — Visual Checkpoints

## Checkpoint 1: Support Console Initial State
- **When**: After navigating to /support
- **Screenshot**: `01-support-console-loaded.png`
- **What to look for**: Search bar with search icon at top, type filter dropdown showing "All", empty state message "Search for tenants by name, code, email, or ID" in the results area, "Recent Impersonation Sessions" section below

## Checkpoint 2: Search Results Loaded
- **When**: After typing "acme" in search and waiting for debounced results
- **Screenshot**: `02-search-results-acme.png`
- **What to look for**: Results table populated with matching tenants, columns: Name, Code, Status (badge), Plan, Billing (badge), Last Activity, Match. Each row has "View" and "Impersonate" action buttons. Result count shown at bottom. Loading skeletons replaced by actual data

## Checkpoint 3: Email Filter Applied
- **When**: After changing type filter to "Email" and searching "user@acme-corp.com"
- **Screenshot**: `03-email-filter-results.png`
- **What to look for**: Type filter dropdown showing "Email", search input shows "user@acme-corp.com", results (if any) matching by email. Match column should show "email" if results exist

## Checkpoint 4: Tenant Detail After View Click
- **When**: After clicking "View" on first result
- **Screenshot**: `04-tenant-detail-from-support.png`
- **What to look for**: Navigated to tenant detail page (/tenants/{id}), tenant information visible, tabs present

## Checkpoint 5: Support Console Reloaded with Sessions
- **When**: After navigating back to /support
- **Screenshot**: `05-support-console-sessions.png`
- **What to look for**: Support Console reloaded, "Recent Impersonation Sessions" section visible with table headers: Admin, Tenant, Reason, Started, Ended/Expired, Status, Actions. Either session rows or "No impersonation sessions in the last 30 days" message
