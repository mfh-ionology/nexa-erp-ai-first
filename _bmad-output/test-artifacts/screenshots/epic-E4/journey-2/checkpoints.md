# Visual Checkpoint Manifest — Journey 2

**Journey**: J02 — Invalid Login Shows Translated Error Message
**Description**: Submit invalid credentials and verify the error message comes from errors.json (AUTH_INVALID_CREDENTIALS), not a hardcoded string or raw translation key.

## Checkpoints

### Checkpoint 1: Login page loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page-loaded.png
- **What to look for**: Login form visible with email and password fields, Sign In button. All text in English, no raw i18n keys visible.

### Checkpoint 2: Error message after invalid login
- **When**: After clicking Sign In with invalid credentials (Step 3)
- **Screenshot file**: step-3-error-after-invalid-login.png
- **What to look for**: Error message visible on the login form showing "Invalid email or password" (or similar translated error). The error text must NOT be "errors:AUTH_INVALID_CREDENTIALS" or any raw translation key. Should be styled as an alert/error notification (red/warning color). Form fields should still be visible for retry.

### Checkpoint 3: Final state — no raw keys on page
- **When**: After all verifications complete (Step 5)
- **Screenshot file**: step-5-final-state-no-raw-keys.png
- **What to look for**: Full page screenshot confirming no raw translation keys, namespace prefixes, or template syntax ({{field}}) visible anywhere on the page. Error message still displayed with proper translated text.
