# Visual Checkpoint Manifest — Journey 18: Route Guard: 403 Access Denied Page

## Journey Summary
A user without finance module access navigates to a finance route and should be
redirected to the 403 Access Denied page. They then click "Back to Home" and
return to the dashboard.

## Checkpoints

### Checkpoint 1: 403 Access Denied page after navigating to guarded route
- **When**: After Step 1 — navigating to `/finance/journals` as a user WITHOUT finance module access
- **Screenshot file**: `step-1-403-access-denied.png`
- **What to look for**:
  - Page displays large "403" heading text
  - Error message: "You do not have permission to access this page"
  - Description: "You don't have permission to access this page. Your administrator can grant access through access group settings."
  - "Contact your administrator" message visible
  - "Back to Home" link/button visible
  - No broken layout, no raw error stack traces
  - The 403 page is a standalone page (no sidebar/app shell expected based on the component)

### Checkpoint 2: Dashboard after clicking "Back to Home"
- **When**: After Step 2 — clicking the "Back to Home" link on the 403 page
- **Screenshot file**: `step-2-back-to-dashboard.png`
- **What to look for**:
  - User is navigated to the home/dashboard page
  - App shell is visible (sidebar, header)
  - Dashboard heading visible
  - No error messages or broken state
