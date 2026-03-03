# Visual Checkpoints — Journey 22: SUPER_ADMIN Sees All Modules and Routes

## Checkpoint 1: Post-Login Dashboard with Full Sidebar
- **When**: After Step 3 — clicking Sign In as SUPER_ADMIN
- **Screenshot file**: `step-3-superadmin-dashboard-full-sidebar.png`
- **What to look for**:
  - Authenticated dashboard page loaded (not login page)
  - Sidebar visible on left with ALL 11 module groups present:
    - System, Finance, Accounts Receivable, Accounts Payable, Sales, Purchasing, Inventory, CRM, HR & Payroll, Manufacturing, Reporting
  - No module groups hidden or missing
  - Header bar visible at top with user avatar/initials

## Checkpoint 2: Finance Journals Page Accessible
- **When**: After Step 4 — navigating to /finance/journals
- **Screenshot file**: `step-4-finance-journals-no-403.png`
- **What to look for**:
  - Page loaded successfully (not a 403 forbidden page)
  - URL is /finance/journals (not redirected to /403)
  - Finance-related content visible in main area
  - No error messages or access denied indicators

## Checkpoint 3: System Resources Page Accessible
- **When**: After Step 5 — navigating to /system/resources
- **Screenshot file**: `step-5-system-resources-page.png`
- **What to look for**:
  - Resource Registry page loaded successfully
  - Not redirected to /403
  - System module content visible
  - If page doesn't exist, note as missing feature

## Checkpoint 4: Access Groups Page Accessible
- **When**: After Step 6 — navigating to /system/access-groups
- **Screenshot file**: `step-6-access-groups-page.png`
- **What to look for**:
  - Access Groups page loaded successfully
  - All RBAC admin pages accessible to SUPER_ADMIN
  - Not redirected to /403
  - Page content visible (list of access groups or empty state)
