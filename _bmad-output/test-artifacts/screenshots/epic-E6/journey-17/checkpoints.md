# Visual Checkpoint Manifest — Journey 17: Permission-Driven Sidebar Filtering

## Checkpoint 1: Login page loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: `step-1-login-page.png`
- **What to look for**: Login page visible with email and password fields, Sign In button, Nexa branding. Card centered on screen with purple theme.

## Checkpoint 2: Dashboard with filtered sidebar after login
- **When**: After clicking Sign In as limited-user (Step 3) — this is the KEY checkpoint
- **Screenshot file**: `step-3-filtered-sidebar-after-login.png`
- **What to look for**: Dashboard/authenticated page loaded. Sidebar visible on the left showing ONLY the modules the limited user has access to (e.g., System, Sales). Critically, Finance, Manufacturing, HR, and other restricted modules should NOT be visible in the sidebar. The sidebar should show module group icons with labels.

## Checkpoint 3: Finance module confirmed absent
- **When**: After verifying Finance module is NOT in sidebar (Step 4)
- **Screenshot file**: `step-4-finance-absent-verification.png`
- **What to look for**: Full sidebar visible. No "Finance" module group anywhere. This confirms the permission filtering is working — the user does not have canAccess for the finance module so it should not appear.

## Checkpoint 4: Sales module confirmed present
- **When**: After verifying Sales module IS in sidebar (Step 5)
- **Screenshot file**: `step-5-sales-present-verification.png`
- **What to look for**: Sidebar with Sales module group visible (ShoppingCart icon + "Sales" label). The group should be clickable/expandable. This confirms the user's permitted modules are correctly displayed.
