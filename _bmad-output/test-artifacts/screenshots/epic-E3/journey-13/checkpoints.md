# Visual Checkpoint Manifest — Journey 13: Audit Log Rejects Users Without Permission

## Checkpoint 1: Sales User Login Success
- **When**: After step 3 — sales user clicks Sign In and reaches dashboard
- **Screenshot file**: `step-3-sales-user-dashboard.png`
- **What to look for**: Dashboard loaded for sales user. Sidebar visible — importantly, the Audit Log link should either be absent (permission-filtered sidebar) or present but leading to a forbidden page. The user identity shown should be the sales user, not admin.

## Checkpoint 2: Access Denied on Audit Log Navigation
- **When**: After step 4 — sales user navigates to /system/audit-log
- **Screenshot file**: `step-4-audit-log-forbidden.png`
- **What to look for**: One of the following:
  - A 403 Forbidden error page with clear messaging ("You do not have permission to access this resource" or "Forbidden")
  - A redirect to a "not authorized" page
  - An error toast/alert indicating insufficient permissions
  - **Critically**: No audit log data should be visible. The audit log table must NOT render with records.
