# Visual Checkpoint Manifest — Journey 3: PLATFORM_ADMIN Without MFA is Blocked

## Journey Summary
Verify that a PLATFORM_ADMIN account without MFA enabled is blocked from logging in per BR-PLT-018 (mandatory MFA for PLATFORM_ADMIN).

## Checkpoints

### Checkpoint 1: Login page loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: `step-1-login-page.png`
- **What to look for**: Platform Admin Portal login page with email and password fields, Sign In button. Page should be accessible and properly rendered.

### Checkpoint 2: Login blocked with MFA required error
- **When**: After clicking Sign In with no-MFA admin credentials (Step 3)
- **Screenshot file**: `step-3-mfa-required-error.png`
- **What to look for**: Error message indicating MFA is required for PLATFORM_ADMIN accounts (e.g. "MFA required for PLATFORM_ADMIN accounts. Please set up multi-factor authentication." or similar 403 error message). Login form should remain visible. User should NOT be redirected to dashboard or MFA verification screen. No authenticated content should be visible.
