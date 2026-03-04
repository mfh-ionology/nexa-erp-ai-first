# Visual Checkpoints — Journey 14: Edit Role Defaults as Admin

## Checkpoint 1: Role Defaults Section Loaded
- **When**: After navigating to /system/notification-preferences as SUPER_ADMIN
- **Screenshot file**: `step-1-role-defaults-section-loaded.png`
- **What to look for**: Page has "Notification Preferences" heading. Below personal preferences, the "Role Defaults" section is visible with purple shield icon, "Role Defaults" title, role selector dropdown showing "STAFF", and a "Save Role Defaults" button (disabled). Matrix grid shows toggle switches for the STAFF role.

## Checkpoint 2: Toggle Changed — Dirty State
- **When**: After clicking an email toggle in the Role Defaults matrix (step 3)
- **Screenshot file**: `step-3-toggle-changed-dirty-state.png`
- **What to look for**: One toggle in the Role Defaults matrix has been flipped. An amber alert triangle icon appears next to the role selector. The "Save Role Defaults" button is now enabled (purple background, clickable).

## Checkpoint 3: Save Successful — Clean State
- **When**: After clicking "Save Role Defaults" (step 4)
- **Screenshot file**: `step-4-save-successful-clean.png`
- **What to look for**: Success toast visible ("Role defaults saved successfully"). Amber dirty indicator is gone. Save button returns to disabled state. The toggled switch retains its new position.

## Checkpoint 4: Role Selector Dropdown Open
- **When**: After clicking the role selector dropdown (step 5)
- **Screenshot file**: `step-5-role-selector-dropdown-open.png`
- **What to look for**: Select dropdown is open showing five role options: SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER.

## Checkpoint 5: Role Switched to MANAGER
- **When**: After selecting "MANAGER" from the dropdown (step 6)
- **Screenshot file**: `step-6-role-switched-to-manager.png`
- **What to look for**: Role selector now shows "MANAGER". Matrix grid has reloaded with MANAGER's role defaults (toggles may differ from STAFF). Save button is disabled (no changes made for MANAGER).
