# Journey 1: Login with Platform Credentials and MFA — Visual Checkpoints

## Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (step 1)
- **Screenshot**: `01-login-page-loaded.png`
- **What to look for**:
  - Purple "N" logo mark visible at top
  - "Platform Admin" heading text
  - "Sign in to the Nexa platform dashboard" subtitle
  - Email input field with label "Email"
  - Password input field with label "Password"
  - "Sign In" button visible and enabled
  - No error messages visible

## Checkpoint 2: Invalid Credentials Error
- **When**: After clicking Sign In with wrong password (step 3)
- **Screenshot**: `02-invalid-credentials-error.png`
- **What to look for**:
  - Error alert visible with text "Invalid email or password"
  - Error has red/error styling (bg-error-bg, text-error-foreground)
  - Sign In button re-enabled (not stuck in loading)
  - Email and password fields still populated

## Checkpoint 3: MFA Challenge Displayed
- **When**: After clicking Sign In with correct password (step 5)
- **Screenshot**: `03-mfa-challenge-displayed.png`
- **What to look for**:
  - MFA Code input field appears with label "MFA Code"
  - Input has monospace tracking-widest styling
  - Placeholder shows "000000"
  - Submit button text changed to "Verify & Sign In"
  - No error messages visible (previous error cleared)

## Checkpoint 4: Dashboard After Successful Login
- **When**: After clicking Verify & Sign In with valid TOTP code (step 7)
- **Screenshot**: `04-dashboard-after-login.png`
- **What to look for**:
  - URL changed to / (dashboard)
  - Dark sidebar visible with "PLATFORM ADMIN" branding text
  - Purple "N" logo in sidebar
  - Dashboard navigation item highlighted/active with purple background
  - All navigation items visible in sidebar (Dashboard, AI Intelligence, Tenants, Plans, AI Usage, Billing, Support Console, Monitoring, Audit Log, Settings)
  - Dashboard placeholder content visible with title "Dashboard"
  - User display name shown in sidebar footer
