# Visual Checkpoint Manifest — Journey 1: Login with Email and Password

## Checkpoint 1: Login Page Loaded
- **When:** After navigating to `/` and being redirected to `/login` (Step 1)
- **Screenshot file:** `step-1-login-page.png`
- **What to look for:**
  - Login card centered on the page
  - "Nexa" app name and "ERP" tagline visible at top of card
  - "Welcome back" heading visible
  - "Sign in to your Nexa ERP account" description text
  - Email input field with placeholder "you@company.co.uk"
  - Password input field with placeholder "Enter your password"
  - "Remember me" checkbox (unchecked)
  - "Sign In" button (full width, enabled)
  - Purple/brand theme applied (primary color on button)
  - No error messages visible

## Checkpoint 2: Dashboard After Login
- **When:** After clicking "Sign In" with valid credentials and being redirected to dashboard (Step 3)
- **Screenshot file:** `step-3-dashboard-loaded.png`
- **What to look for:**
  - URL has changed from `/login` to `/` (authenticated root)
  - App shell layout visible: header bar at top (h-14), sidebar on left (w-64)
  - "Dashboard" heading visible in main content area
  - Header contains: search area, notification bell icon, user avatar on far right
  - User avatar shows initials (coloured circle with letters)
  - Sidebar shows navigation links for enabled modules
  - No login form visible (confirms redirect away from login page)
  - No error toasts or broken layout elements

## Checkpoint 3: User Avatar Verified
- **When:** After verifying the user avatar element is present in header (Step 4)
- **Screenshot file:** `step-4-user-avatar-verified.png`
- **What to look for:**
  - User avatar clearly visible in top-right corner of header
  - Avatar shows user initials (e.g., "AD" for admin user)
  - Avatar has purple/primary background color with light text
  - Avatar is a clickable element (cursor pointer)
  - Overall authenticated state is confirmed by the presence of the full app shell
