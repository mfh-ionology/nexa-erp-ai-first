# Visual Checkpoints — Journey #13: Verify Most-Permissive-Wins Permission Resolution

## Context
Sales user has SALES_STAFF + QA_TESTER groups. QA_TESTER grants canAccess+canView on system.users.list/detail
and system.company-profile.detail. SALES_STAFF does not grant these. The union should give the user access
to Users pages. However, canNew should remain false (neither group grants it).

## Checkpoints

### Checkpoint 1: Sales user dashboard after login
- **When**: After step 3 — Sign In button clicked, dashboard loaded
- **Screenshot file**: `step-3-sales-dashboard-after-login.png`
- **What to look for**: Dashboard loaded with sidebar visible. "Users" link should appear in the System section of the sidebar (granted by QA_TESTER's canAccess on system.users.list via most-permissive-wins). Resource Registry and Access Groups may or may not be visible depending on SALES_STAFF permissions.

### Checkpoint 2: Users list page accessible
- **When**: After step 5 — Clicked "Users" sidebar link, user list page loads
- **Screenshot file**: `step-5-users-list-accessible.png`
- **What to look for**: User list page loads successfully (NOT a 403/access denied page). Table of users should be visible. This confirms most-permissive-wins resolved canAccess=true from QA_TESTER group.

### Checkpoint 3: No "New User" button visible
- **When**: After step 6 — Verify [+ New User] button is hidden
- **Screenshot file**: `step-6-no-new-user-button.png`
- **What to look for**: User list page is displayed but there is NO [+ New User] button visible anywhere. canNew is false for system.users.list in both SALES_STAFF and QA_TESTER groups, so the button should be hidden. The page should only show read/view capabilities.
