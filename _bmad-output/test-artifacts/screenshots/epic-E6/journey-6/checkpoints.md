# Visual Checkpoint Manifest — Journey 6: User Menu and Sign Out

## Checkpoint 1: Authenticated Dashboard
- **When**: After login completes and dashboard loads (pre-condition for the journey)
- **Screenshot file**: `step-1-authenticated-dashboard.png`
- **What to look for**:
  - Dashboard page visible with heading
  - App shell present: sidebar on left, header bar at top
  - User avatar visible in top-right corner of header with initials "AD" (Admin Demo)
  - No login form visible

## Checkpoint 2: User Dropdown Menu Open
- **When**: After clicking the user avatar button in the header
- **Screenshot file**: `step-2-user-menu-open.png`
- **What to look for**:
  - Dropdown menu visible anchored to the avatar
  - User's full name "Admin Demo" displayed at top of dropdown
  - Role and email shown below the name (e.g. "ADMIN · admin@nexa-test.com")
  - Separator line after user info
  - "My Profile" menu item with User icon
  - "Preferences" menu item with Settings icon
  - Separator line before sign out
  - "Sign Out" menu item with LogOut icon
  - Menu items should be clickable/hoverable

## Checkpoint 3: Redirected to Login After Sign Out
- **When**: After clicking "Sign Out" menu item
- **Screenshot file**: `step-3-signed-out-login-page.png`
- **What to look for**:
  - Login page displayed with "Welcome back" heading
  - Email and password fields visible
  - "Sign In" button visible
  - NO sidebar visible (app shell gone)
  - NO header bar with user avatar
  - Session fully cleared — page looks like an unauthenticated visit
