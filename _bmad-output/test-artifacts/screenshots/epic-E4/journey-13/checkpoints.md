# Visual Checkpoint Manifest — Journey 13: Permission Denied Shows Translated FORBIDDEN Error

## Journey Summary
Login as a VIEWER role user and attempt to create a user (a restricted action). Verify the permission denied error message is the translated string from errors.json FORBIDDEN key, not a raw translation key.

---

## Checkpoint 1: Viewer Dashboard After Login
- **When**: After step 3 — Sign In button clicked, viewer user logged in
- **Screenshot file**: `step-3-viewer-dashboard-after-login.png`
- **What to look for**:
  - Dashboard/home page loaded successfully for the viewer user
  - Sidebar navigation visible (may show limited options based on VIEWER permissions)
  - No error messages from login — login succeeded
  - All text in English, no raw i18n keys visible

## Checkpoint 2: Permission Denied Error on Create Attempt
- **When**: After step 5 — Create button clicked (or restricted action attempted)
- **Screenshot file**: `step-5-permission-denied-error.png`
- **What to look for**:
  - Error message visible: "You do not have permission to perform this action"
  - The message comes from errors.json FORBIDDEN key (translated, not raw key)
  - No raw key "errors:FORBIDDEN" visible anywhere on the page
  - Error is displayed as a toast, alert, or inline message — not a crash/500 page
  - If Create button is hidden for VIEWER, the test navigates to /system/users/new to trigger error

## Checkpoint 3: No Raw Translation Keys on Page
- **When**: After step 7 — Final verification of page content
- **Screenshot file**: `step-7-no-raw-keys-final.png`
- **What to look for**:
  - Page does not contain "errors:FORBIDDEN" raw key anywhere
  - Page does not contain any other raw i18n namespace prefixes (errors:, common:, validation:)
  - UI is clean and all strings are properly translated English text
