# Visual Checkpoint Manifest — Journey #1: Platform Admin Login with MFA

Journey ID: j01-platform-admin-login-mfa
Priority: critical
Related Stories: E3b-1
Acceptance Criteria: E3b.1-AC2

## Checkpoints

### Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**:
  - Login page renders with PLATFORM ADMIN branding (distinct from ERP login)
  - Dark sidebar theme visible
  - Email and password input fields present
  - "Sign In" button visible and enabled
  - No error messages displayed
  - Professional, polished appearance

### Checkpoint 2: MFA Verification Screen
- **When**: After entering credentials and clicking Sign In (Step 3)
- **Screenshot file**: step-3-mfa-verification.png
- **What to look for**:
  - MFA verification screen displayed (login form transitions to MFA step)
  - 6-digit TOTP code input field visible
  - "Verify" button present
  - Instructional message: "Enter the code from your authenticator app" or similar
  - No error messages
  - User cannot access dashboard yet (still on auth flow)

### Checkpoint 3: Dashboard After Successful Login
- **When**: After entering valid TOTP code and clicking Verify (Step 5)
- **Screenshot file**: step-5-dashboard-loaded.png
- **What to look for**:
  - Platform Admin dashboard loaded successfully
  - Dark sidebar navigation visible with sections: Tenants, Plans, Users, Monitoring
  - User identity displayed in top bar (admin@nexa-platform.local)
  - PLATFORM_ADMIN role badge visible
  - No login form visible (fully authenticated)
  - Dashboard content/summary widgets rendered
