# Visual Checkpoint Manifest — Journey #12: Verify Permission Enforcement - Limited User Denied Access

## Journey Description
Login as the sales_staff user (SALES_STAFF group) and verify that admin-only pages
like Resource Registry and Access Groups are NOT visible in the sidebar and return
403/access denied if navigated to directly.

---

## Checkpoint 1: Sales user dashboard after login
- **When**: After step 3 — sales user logs in and dashboard loads
- **Screenshot file**: step-3-sales-dashboard-limited-sidebar.png
- **What to look for**:
  - Dashboard page loaded successfully
  - Sidebar is visible with System module section
  - Sidebar does NOT contain "Resource Registry" link
  - Sidebar does NOT contain "Access Groups" link
  - Sidebar may contain "Users" and/or "Company Profile" if SALES_STAFF+QA_TESTER grants access
  - No error messages or access denied indicators on the dashboard itself

## Checkpoint 2: Access denied when navigating to /system/resources
- **When**: After step 5 — direct navigation to /system/resources (unauthorized)
- **Screenshot file**: step-5-resources-access-denied.png
- **What to look for**:
  - Access denied / 403 Forbidden message displayed
  - User does not see the Resource Registry list page
  - May show "You do not have permission" or similar message
  - May redirect to an unauthorized/forbidden page
  - No broken layout or unhandled errors

## Checkpoint 3: Access denied when navigating to /system/access-groups
- **When**: After step 6 — direct navigation to /system/access-groups (unauthorized)
- **Screenshot file**: step-6-access-groups-access-denied.png
- **What to look for**:
  - Access denied / 403 Forbidden message displayed
  - User does not see the Access Groups list page
  - Consistent error display with the /system/resources denied page
  - No broken layout or unhandled errors
