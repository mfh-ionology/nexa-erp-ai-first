# Visual Checkpoint Manifest — Journey 4: Filter Audit Log by Entity Type

## Journey ID: j04-audit-log-filter-entity-type
## Priority: high
## Related Stories: E3-2

---

### Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button. No error messages present.

### Checkpoint 2: Dashboard After Login
- **When**: After clicking Sign In (Step 3)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: Dashboard or main app shell loaded. Sidebar visible with navigation links including System section. No login error messages.

### Checkpoint 3: Audit Log Page Default View
- **When**: After navigating to /system/audit-log (Step 4)
- **Screenshot file**: step-4-audit-log-default.png
- **What to look for**: Audit log page loaded with filter controls (Entity Type, Action, User, Date Range) and a data table. Table should have audit records visible. Filter controls should be in default/unset state.

### Checkpoint 4: Filtered Audit Log — Entity Type = User
- **When**: After applying Entity Type filter and clicking Apply Filters (Step 6)
- **Screenshot file**: step-6-filtered-entity-type-user.png
- **What to look for**: Audit log table refreshed showing ONLY records where Entity Type column reads "User". No records of other entity types (AccessGroup, Company, etc.) should be visible. Pagination count reflects the filtered result count.

### Checkpoint 5: Verification — All Rows Show User
- **When**: After verifying all visible rows (Step 7)
- **Screenshot file**: step-7-verify-all-rows-user.png
- **What to look for**: Confirmation that every single row in the table has "User" in the Entity Type column. This is the final state after successful filtering.
