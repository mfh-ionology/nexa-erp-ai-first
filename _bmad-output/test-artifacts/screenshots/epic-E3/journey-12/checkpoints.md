# Visual Checkpoint Manifest — Journey 12: Audit Log Rejects Unauthenticated Requests

## Journey Summary
Verify that accessing the audit log without authentication redirects to login or shows a 401 error.

## Checkpoints

### Checkpoint 1: Unauthenticated access to audit log
- **When**: After navigating to /system/audit-log without being logged in (Step 1)
- **Screenshot file**: step-1-unauthenticated-audit-redirect.png
- **What to look for**:
  - Login page is displayed (redirect from /system/audit-log) OR an error page showing 'Unauthorized' / '401' message
  - Audit log data table is NOT visible
  - No audit records, filter controls, or pagination are exposed
  - URL should reflect either /login (redirect) or /system/audit-log with an error state
