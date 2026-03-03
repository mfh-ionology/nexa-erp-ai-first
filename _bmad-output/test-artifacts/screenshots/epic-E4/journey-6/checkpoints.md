# Visual Checkpoints — Journey 6: User List Page Uses Translated Headers and Action Buttons

## Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email/password fields and Sign In button. All text in English, no raw translation keys.

## Checkpoint 2: Dashboard After Login
- **When**: After successful login (Step 3)
- **Screenshot file**: step-3-post-login-dashboard.png
- **What to look for**: App shell loaded with sidebar navigation. Confirms login succeeded and redirect to dashboard occurred. Sidebar shows translated module names.

## Checkpoint 3: User List Page Loaded
- **When**: After navigating to /system/users (Step 4)
- **Screenshot file**: step-4-user-list-page.png
- **What to look for**: User list page with translated UI elements:
  - Page title/heading shows 'Users' (from navigation.json)
  - 'Create' button visible with translated label (from common.json)
  - Search input/button with translated placeholder/label 'Search' (from common.json)
  - Column headers in English (Name, Email, Role, Status, etc.)
  - Status column shows translated values like 'Active'/'Inactive' (not raw booleans)
  - No raw i18n namespace prefixes like 'common:' or 'navigation:' visible anywhere

## Checkpoint 4: Page Scan for Raw Keys
- **When**: After verifying all individual elements (Step 9)
- **Screenshot file**: step-9-no-raw-keys.png
- **What to look for**: Final full-page screenshot confirming no raw i18n keys visible anywhere on the user list page. Clean, professional appearance with all text properly translated.
