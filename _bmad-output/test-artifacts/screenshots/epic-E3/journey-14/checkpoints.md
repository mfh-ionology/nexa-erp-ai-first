# Visual Checkpoint Manifest — Journey 14: Admin Navigates to Dead Letter Queue

## Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: `step-1-login-page.png`
- **What to look for**: Login form visible with email input, password input, and Sign In button. No error messages.

## Checkpoint 2: Dashboard After Login
- **When**: After clicking Sign In and successful authentication (Step 3)
- **Screenshot file**: `step-3-dashboard-loaded.png`
- **What to look for**: Dashboard/main app loaded. Sidebar visible with System module section. User is authenticated (no login form). Look for Dead Letter Queue link in sidebar navigation.

## Checkpoint 3: Dead Letter Queue Page
- **When**: After clicking Dead Letter Queue link in sidebar (Step 4)
- **Screenshot file**: `step-4-dlq-page-loaded.png`
- **What to look for**: Dead Letter Queue page with:
  - Page title/heading indicating "Dead Letter Queue"
  - Filter controls (Event Name filter, Reprocessed status filter)
  - Data table with columns: ID, Event Name, Error, Retry Count, Original Timestamp, Reprocessed, Actions
  - If no failed events exist, an empty state message should be shown
  - No error messages or unauthorized notices
