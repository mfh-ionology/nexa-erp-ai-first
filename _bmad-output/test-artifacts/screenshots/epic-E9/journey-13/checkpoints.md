# Visual Checkpoints — Journey 13: Admin Role Defaults Section Visibility

## Checkpoint 1: Staff user — Preferences page WITHOUT Role Defaults
- **When**: After step 4 — logged in as STAFF, navigated to /system/notification-preferences
- **Screenshot file**: `step-4-staff-preferences-no-role-defaults.png`
- **What to look for**:
  - Page heading "Notification Preferences" visible
  - Preference matrix with category sections and toggle switches visible
  - NO "Role Defaults" heading anywhere on the page
  - NO separator dividing personal preferences from a role defaults section
  - NO role selector dropdown (Select with "STAFF" / "MANAGER" etc.)
  - NO "Save Role Defaults" button
  - Only the personal preferences action bar (Reset to Defaults + Save)

## Checkpoint 2: Admin user — Preferences page WITH Role Defaults
- **When**: After step 8 — logged in as SUPER_ADMIN, navigated to /system/notification-preferences
- **Screenshot file**: `step-8-admin-preferences-with-role-defaults.png`
- **What to look for**:
  - Page heading "Notification Preferences" visible
  - Personal preference matrix visible (same as staff view)
  - Below the personal preferences, a visual separator
  - "Role Defaults" heading (h2) visible below the separator
  - Description text about configuring default preferences for each role
  - Role selector dropdown showing "STAFF" as the default selected role
  - "Save Role Defaults" button visible
  - A second preference matrix grid for the selected role's defaults
