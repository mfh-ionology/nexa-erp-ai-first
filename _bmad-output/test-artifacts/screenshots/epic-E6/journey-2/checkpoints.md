# Visual Checkpoint Manifest — Journey 2: Login with MFA Challenge

## Checkpoint 1: Login Page Loaded
- **When**: After step 1 — navigate to /login
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login page visible with "Nexa" branding, "Welcome back" heading, email input (placeholder "you@company.co.uk"), password input (placeholder "Enter your password"), "Sign In" button enabled. Card centered on the page.

## Checkpoint 2: MFA Verification Step Visible
- **When**: After step 3 — click "Sign In" with MFA-required user credentials
- **Screenshot file**: step-3-mfa-step-visible.png
- **What to look for**: Login form replaced by MFA verification step. Card heading reads "Two-Factor Authentication". Subtitle reads "Enter the 6-digit code from your authenticator app". 6-digit TOTP code input field visible (placeholder "000000", centered text, wide letter spacing). "Verify" button visible and enabled. "Back to sign in" ghost button visible below the Verify button. No email/password fields visible.

## Checkpoint 3: Authenticated Dashboard Loaded
- **When**: After step 5 — click "Verify" after entering MFA code
- **Screenshot file**: step-5-dashboard-after-mfa.png
- **What to look for**: MFA form no longer visible. Authenticated app shell loaded with sidebar navigation on the left and header bar at the top. Dashboard content area visible. User avatar/initials in the top-right header area. No login or MFA UI elements visible.
