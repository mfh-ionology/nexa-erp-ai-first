# Visual Checkpoint Manifest — Journey 5: Sidebar Navigation Shows Translated Module Names

## Checkpoint 1: Post-Login Dashboard with Sidebar Navigation
- **When**: After step 3 — successful login, redirected to dashboard
- **Screenshot file**: `step-3-dashboard-sidebar-navigation.png`
- **What to look for**:
  - App shell loaded with sidebar navigation panel visible
  - Module names visible in sidebar: "Dashboard", "System", "Users", "Settings"
  - All sidebar text is human-readable English — no raw i18n keys like `navigation.dashboard`, `navigation:system`, or `navigation.users`
  - Dashboard main content area loaded (not blank/error page)
  - No error toasts or broken layout

## Checkpoint 2: Final Page State After All Verifications
- **When**: After step 8 — all text verifications complete, page still clean
- **Screenshot file**: `step-8-final-page-no-raw-keys.png`
- **What to look for**:
  - Entire page free of any raw `navigation:` namespace prefixes
  - All sidebar items still display correct English translations
  - No console errors or UI degradation from the verification steps
