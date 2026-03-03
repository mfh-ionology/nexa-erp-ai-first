# Visual Checkpoint Manifest — Journey 3: Unauthenticated Access Redirects to Login

## Checkpoint 1: Redirect from /finance/journals to /login
- **When**: After navigating to /finance/journals without authentication
- **Screenshot file**: step-1-redirect-finance-journals-to-login.png
- **What to look for**:
  - URL should show /login (not /finance/journals)
  - Login page displayed with "Nexa" logo/branding at top
  - Card with "Welcome back" title and "Sign in to your Nexa ERP account" description
  - Email input field with "Email" label and placeholder "you@company.co.uk"
  - Password input field with "Password" label
  - "Sign In" button visible
  - NO sidebar or app shell visible (no authenticated layout)
  - Clean centered layout on background

## Checkpoint 2: Redirect from /system/resources to /login
- **When**: After navigating to /system/resources without authentication
- **Screenshot file**: step-2-redirect-system-resources-to-login.png
- **What to look for**:
  - URL should show /login (not /system/resources)
  - Same login page structure as Checkpoint 1
  - Confirms auth guard works consistently for admin routes

## Checkpoint 3: Redirect from /system/access-groups to /login
- **When**: After navigating to /system/access-groups without authentication
- **Screenshot file**: step-3-redirect-system-access-groups-to-login.png
- **What to look for**:
  - URL should show /login (not /system/access-groups)
  - Same login page structure as Checkpoint 1
  - Confirms auth guard works for all protected route types
