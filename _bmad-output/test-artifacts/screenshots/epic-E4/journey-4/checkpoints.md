# Visual Checkpoint Manifest — Journey 4
# Account Locked After Repeated Failures Shows Translated Error

## Checkpoint 1: Login Page Initial State
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page-loaded.png
- **What to look for**: Login form visible with email input, password input, and Sign In button. All labels in English, no raw i18n keys visible.

## Checkpoint 2: First Failed Login Attempt
- **When**: After first invalid login submission (Step 3)
- **Screenshot file**: step-3-first-failed-attempt.png
- **What to look for**: Error message "Invalid email or password" visible on the login form. The form should remain usable for retry.

## Checkpoint 3: Account Lockout Error
- **When**: After 6th failed login submission triggers lockout (Step 13)
- **Screenshot file**: step-13-account-locked-error.png
- **What to look for**: Error message changes from "Invalid email or password" to "Account temporarily locked due to too many failed attempts" (from errors.json ACCOUNT_LOCKED key). No raw translation key "errors:ACCOUNT_LOCKED" visible. The lockout message should be clearly visible, possibly with a different visual treatment (warning/error styling) compared to the regular invalid credentials error.

## Checkpoint 4: Final Verification State
- **When**: After verifying error text matches expected translation (Step 14)
- **Screenshot file**: step-14-final-verification.png
- **What to look for**: Page still shows the lockout error. No raw i18n keys (errors:, common:, auth:, validation:) or interpolation syntax ({{...}}) visible anywhere on the page.
