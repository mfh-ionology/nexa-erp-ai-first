# Visual Checkpoints — Journey 15: SUPER_ADMIN Bypasses All Permission Checks

## Checkpoint 1: Dashboard with Full Sidebar After Login
- **When**: After step 3 — SUPER_ADMIN login and redirect to dashboard
- **Screenshot file**: `step-3-super-admin-dashboard-full-sidebar.png`
- **What to look for**:
  - Dashboard page loaded successfully
  - Sidebar visible with ALL System module items: Users, Company Profile, Resource Registry, Access Groups
  - No items missing — SUPER_ADMIN bypass grants access to everything
  - User identity shows superadmin@nexa-test.co.uk or "Super Admin"

## Checkpoint 2: Company Profile with All Fields Visible
- **When**: After step 6 — Navigate to /system/company-profile
- **Screenshot file**: `step-6-company-profile-all-fields-visible.png`
- **What to look for**:
  - Company profile page fully loaded
  - vatNumber field IS visible and editable (not hidden — SUPER_ADMIN skips field filtering)
  - registrationNumber field IS visible and editable (not read-only — SUPER_ADMIN skips field filtering)
  - All other fields also visible and editable
  - No field-level restrictions applied
