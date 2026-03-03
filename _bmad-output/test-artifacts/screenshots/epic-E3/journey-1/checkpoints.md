# Visual Checkpoints — Journey j01: Admin Login and Navigate to Audit Log

## Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input field, password input field, and a "Sign In" button. No error messages displayed. Page has proper branding/styling.

## Checkpoint 2: Dashboard After Login
- **When**: After clicking Sign In with valid credentials (Step 3)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: Dashboard page loaded. App shell visible with sidebar navigation. Sidebar contains a "System" section with links including "Audit Log". No login form visible — user is authenticated.

## Checkpoint 3: Audit Log Page
- **When**: After clicking Audit Log link in sidebar (Step 4)
- **Screenshot file**: step-4-audit-log-page.png
- **What to look for**: Audit Log page with filter controls (entity type, action, user, date range) and a data table. Table columns should include: Timestamp, Entity Type, Entity ID, Action, User, AI Action. Table should contain at least one audit record (from the login event just performed).
