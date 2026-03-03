# Missing Functionality - Epic E3b

> Auto-generated during frontend E2E testing

## Missing: Platform Admin Portal Frontend Application
- **Journey**: j01-platform-admin-login-mfa, Step 1
- **Expected**: Platform Admin Portal frontend should be running at http://localhost:5173 (or :5174 per test plan) with a login page at /login featuring PLATFORM ADMIN branding, dark sidebar theme, email/password fields, and Sign In button
- **Actual**: No frontend application exists. Connection refused (ERR_CONNECTION_REFUSED) on both ports. The test plan prerequisites explicitly state: "The Platform Admin Portal frontend does not exist yet — it is planned for Epic E13b."
- **Related Story**: NEW (Epic E13b)
- **Suggested Story Title**: Build Platform Admin Portal — Login Page with MFA Flow

## Missing: Platform Admin Login Page with MFA Verification
- **Journey**: j01-platform-admin-login-mfa, Steps 2-3
- **Expected**: After entering email/password and clicking Sign In, an MFA verification screen should appear with a 6-digit TOTP code input and Verify button
- **Actual**: No login page or MFA flow exists — entire Platform Admin Portal frontend is missing
- **Related Story**: NEW (Epic E13b)
- **Suggested Story Title**: Implement Platform Admin MFA Login Flow (email + password + TOTP)

## Missing: Platform Admin Dashboard
- **Journey**: j01-platform-admin-login-mfa, Step 5
- **Expected**: After successful MFA verification, user should be redirected to Platform Admin dashboard with dark sidebar navigation (Tenants, Plans, Users, Monitoring), user identity display, and PLATFORM_ADMIN role badge
- **Actual**: No dashboard exists — entire Platform Admin Portal frontend is missing
- **Related Story**: NEW (Epic E13b)
- **Suggested Story Title**: Build Platform Admin Dashboard with Sidebar Navigation

## Missing: MFA Error Handling for Invalid TOTP Code
- **Journey**: j02-platform-admin-login-wrong-mfa, Steps 3-5
- **Expected**: After entering valid credentials and reaching the MFA verification screen, submitting an invalid TOTP code (e.g., "000000") should display an error message ("Invalid MFA code" or "Authentication failed"), keep the user on the MFA verification screen, and prevent access to the dashboard
- **Actual**: No frontend application exists — entire Platform Admin Portal frontend is missing (planned for Epic E13b). Cannot test MFA error handling.
- **Related Story**: NEW (Epic E13b)
- **Suggested Story Title**: Implement MFA Error Handling — Invalid TOTP Code Rejection with Error Display

## Missing: PLATFORM_ADMIN Without MFA Login Blocked (BR-PLT-018)
- **Journey**: j03-platform-admin-no-mfa-blocked, Steps 1-3
- **Expected**: When a PLATFORM_ADMIN user without MFA enabled (noomfa@nexa-platform.local) attempts to login, the server should return a 403 error and the frontend should display an error message: "MFA required for PLATFORM_ADMIN accounts. Please set up multi-factor authentication." The user should remain on the login page with no access to the dashboard.
- **Actual**: No frontend application exists — entire Platform Admin Portal frontend is missing (planned for Epic E13b). Connection refused at localhost:5173. Cannot test BR-PLT-018 MFA enforcement.
- **Related Story**: NEW (Epic E13b)
- **Suggested Story Title**: Implement Login Rejection for PLATFORM_ADMIN Without MFA (BR-PLT-018 Enforcement)
