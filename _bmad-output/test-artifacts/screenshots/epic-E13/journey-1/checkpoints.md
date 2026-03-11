# Visual Checkpoints — Journey 1: Navigate to Print Preferences Page

## Checkpoint 1: Dashboard with Sidebar
- **When**: After step 1 — navigate to /
- **Screenshot file**: `step-1-dashboard-with-sidebar.png`
- **What to look for**:
  - App shell loaded with sidebar visible on the left
  - Dashboard content area loaded
  - Sidebar shows navigation groups (Main, Operations, etc.)
  - System/Admin section visible in sidebar navigation
- **Result**: PASS — Dashboard loaded correctly. Sidebar visible with all navigation groups: MAIN, OPERATIONS, OTHER, AI, AI ADMINISTRATION, COMMUNICATIONS, ADMINISTRATION. Concept D purple styling applied. Dashboard shows "Good evening, Admin" greeting.

## Checkpoint 1b: Sidebar Scrolled to Bottom
- **When**: After step 2 — sidebar scrolled to show all items
- **Screenshot file**: `step-2-sidebar-scrolled.png`
- **What to look for**:
  - All sidebar navigation groups visible
  - Print Preferences link present in sidebar
- **Result**: FAIL — Sidebar scrolled to bottom shows ADMINISTRATION section ending with Settings, Users, Access Groups. NO "Print Preferences" link exists anywhere in the sidebar. The COMMUNICATIONS section contains Notification Preferences and Email Templates. Print Preferences was never added to app-sidebar.tsx NAV_GROUPS.

## Checkpoint 2: Print Preferences Page Loaded
- **When**: After step 6 — verify page description text
- **Screenshot file**: `step-6-print-preferences-page.png`
- **What to look for**:
  - Page title "Print Preferences" visible as heading
  - Breadcrumbs showing "System > Print Preferences"
  - Description text "Configure how documents are handled after saving" below header
  - Preference table card with document type rows visible
  - Purple-themed Concept D styling: #f4f2ff background, 12px radius card
  - Action bar with disabled "Save Preferences" button and "Reset to Defaults" button
  - Sidebar still visible with active state indication
- **Result**: NOT REACHED — Test failed at step 3 because the sidebar link does not exist. Page content could not be verified through the specified navigation flow.
