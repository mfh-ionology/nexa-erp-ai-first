# Visual Checkpoint Manifest — Journey 19: Non-Admin User Blocked from RBAC Admin Pages

## Checkpoint 1: Staff User Dashboard After Login
- **When**: After step 3 — STAFF user logs in and is redirected to dashboard
- **Screenshot file**: step-3-staff-dashboard.png
- **What to look for**: Dashboard page loaded for STAFF user. App shell visible with sidebar and header. User is authenticated but with STAFF role (not ADMIN). No admin-only navigation items should be prominently visible.

## Checkpoint 2: 403 Access Denied on /system/resources
- **When**: After step 4 — navigate to /system/resources as STAFF user
- **Screenshot file**: step-4-resources-403.png
- **What to look for**: 403 Access Denied page. Large "403" heading visible. Message "You do not have permission to access this page" displayed. "Back to Home" link present. The Resource Registry page should NOT be visible. URL should be /403.

## Checkpoint 3: 403 Access Denied on /system/access-groups
- **When**: After step 5 — navigate to /system/access-groups as STAFF user
- **Screenshot file**: step-5-access-groups-403.png
- **What to look for**: Same 403 page as checkpoint 2. Confirms guard applies consistently to access groups route. "403" heading and denial message visible.

## Checkpoint 4: 403 Access Denied on /system/users
- **When**: After step 6 — navigate to /system/users as STAFF user
- **Screenshot file**: step-6-users-403.png
- **What to look for**: Same 403 page. Confirms guard applies to users route. "403" heading and denial message visible. "Back to Home" link present and functional.
