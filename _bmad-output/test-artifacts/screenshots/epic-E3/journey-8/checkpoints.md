# Visual Checkpoint Manifest — Journey 8: Apply Multiple Filters Simultaneously

## Journey: j08-audit-log-combined-filters
**Description**: Apply entityType, action, and date range filters together. Verify the intersection of all filters is applied correctly.

---

### Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button. No error messages.

### Checkpoint 2: Dashboard After Login
- **When**: After clicking Sign In and being redirected to dashboard (Step 3)
- **Screenshot file**: step-3-dashboard-loaded.png
- **What to look for**: Dashboard loaded with app shell. Sidebar visible with System module section containing Audit Log link.

### Checkpoint 3: Audit Log Page Default View
- **When**: After navigating to /system/audit-log (Step 4)
- **Screenshot file**: step-4-audit-log-default.png
- **What to look for**: Audit log page loaded with filter controls (Entity Type, Action, User, Date Range). Data table visible with columns: Timestamp, Entity Type, Entity ID, Action, User, AI Action. Records present in the table.

### Checkpoint 4: Combined Filters Applied
- **When**: After setting entityType=User, action=LOGIN, dateFrom/dateTo to today and clicking Apply Filters (Step 6)
- **Screenshot file**: step-6-combined-filters-applied.png
- **What to look for**: All visible rows show entityType=User AND action=LOGIN AND timestamps from today (2026-02-21). Total count reflects the combined filter. Filter controls show the selected values. No rows with other entity types or actions visible.
