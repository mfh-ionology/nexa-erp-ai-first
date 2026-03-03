# Visual Checkpoint Manifest — Journey 2: Platform Admin Login with Wrong MFA Code

## Journey Description
Verify that an incorrect TOTP code is rejected with a 401 error and the user cannot proceed to the dashboard.

---

### Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: `step-1-login-page.png`
- **What to look for**: Platform Admin Portal login page is displayed with email and password fields, a "Sign In" button, and Platform Admin branding. The page should look like a proper login form, not a 404 or blank page.

### Checkpoint 2: MFA Verification Screen Displayed
- **When**: After clicking Sign In with valid credentials (Step 3)
- **Screenshot file**: `step-3-mfa-verification-screen.png`
- **What to look for**: MFA verification step is shown with a 6-digit TOTP code input field and a "Verify" button. Message like "Enter the code from your authenticator app". The login form should be hidden or replaced by this MFA step.

### Checkpoint 3: MFA Error — Invalid Code Rejected
- **When**: After clicking Verify with wrong TOTP code "000000" (Step 5)
- **Screenshot file**: `step-5-mfa-error-invalid-code.png`
- **What to look for**: Error message displayed such as "Invalid MFA code" or "Authentication failed". The user should remain on the MFA verification screen (not redirected to dashboard). No authenticated content should be visible. The error should be clearly styled as an error (red text, error banner, or toast).
