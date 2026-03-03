# Journey #8: Configure Permission Matrix for Custom Group — Visual Checkpoints

## Checkpoint 1: QA_TESTER detail page with empty permission matrix
- **When**: After clicking QA_TESTER row in access groups list (step 2)
- **Screenshot file**: step-2-qa-tester-empty-permission-matrix.png
- **What to look for**: Permission matrix with all 6 system resources visible (system.users.list, system.users.detail, system.company-profile.detail, system.resources.list, system.access-groups.list, system.access-groups.detail). All checkboxes should be unchecked — this is a newly created group with no permissions set.

## Checkpoint 2: Permission matrix with selected checkboxes
- **When**: After checking canAccess+canView on users.list, users.detail, and company-profile.detail (step 8)
- **Screenshot file**: step-8-permission-matrix-checkboxes-selected.png
- **What to look for**: Six checkboxes checked: canAccess and canView for system.users.list, system.users.detail, and system.company-profile.detail. The remaining resources (system.resources.list, system.access-groups.list, system.access-groups.detail) should remain fully unchecked.

## Checkpoint 3: Save success toast after permission update
- **When**: After clicking [Save Settings] button (step 9)
- **Screenshot file**: step-9-save-permissions-success.png
- **What to look for**: Green success toast with text like 'Permissions updated'. Permission matrix should retain the same checked state (6 checkboxes still checked).

## Checkpoint 4: Permissions persisted after page reload
- **When**: After navigating back to list and re-clicking QA_TESTER row (step 11)
- **Screenshot file**: step-11-permissions-persisted-after-reload.png
- **What to look for**: Same 6 checkboxes still checked — canAccess+canView on users.list, users.detail, and company-profile.detail. This confirms the data was persisted via the API and reloaded correctly from GET detail.
