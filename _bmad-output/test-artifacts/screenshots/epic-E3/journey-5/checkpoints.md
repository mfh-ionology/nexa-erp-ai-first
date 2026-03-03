# Visual Checkpoint Manifest — Journey 5: Filter Audit Log by Action Type

## Checkpoint 1: After Login — Dashboard Loaded
- **When**: After step 3 (click Sign In)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: Dashboard page loaded with app shell visible. Sidebar shows navigation including System section with Audit Log link. User is authenticated and redirected from login page.

## Checkpoint 2: Audit Log Page — Default View
- **When**: After step 4 (navigate to /system/audit-log)
- **Screenshot file**: step-4-audit-log-default.png
- **What to look for**: Audit log page loaded with filter controls visible. Action filter dropdown/input is present and in default/empty state. Data table shows audit records with columns including Action column.

## Checkpoint 3: After Applying LOGIN Filter — Filtered Results
- **When**: After step 6 (click Apply Filters with action=LOGIN)
- **Screenshot file**: step-6-filtered-login-actions.png
- **What to look for**: Audit log table shows only LOGIN action records. Every visible row in the Action column reads 'LOGIN'. No records with other action types (CREATE, UPDATE, DELETE) are visible. Pagination reflects the filtered count.

## Checkpoint 4: Verification — All Rows Show LOGIN
- **When**: After step 7 (verify all rows show LOGIN)
- **Screenshot file**: step-7-verify-all-rows-login.png
- **What to look for**: Final state of the filtered table confirming every row has Action=LOGIN. This serves as confirmation that the filter is working correctly and no non-LOGIN records leaked through.
