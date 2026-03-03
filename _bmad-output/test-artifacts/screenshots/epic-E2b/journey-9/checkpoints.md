# Visual Checkpoint Manifest — Journey #9: Configure Field-Level Visibility Overrides

## Checkpoint 1: Field Overrides Panel (Empty State)
- **When**: After clicking on Field Overrides section/tab on QA_TESTER detail page (Step 3)
- **Screenshot file**: `step-3-field-overrides-empty-panel.png`
- **What to look for**:
  - Field Overrides panel or section is visible
  - A "Select Resource" dropdown/combobox is present
  - No overrides are configured yet (empty state message or empty table)
  - The panel is clearly distinguishable from the permission matrix section

## Checkpoint 2: Field Overrides Configured (Before Save)
- **When**: After setting vatNumber=HIDDEN and registrationNumber=READ_ONLY (Step 6)
- **Screenshot file**: `step-6-field-overrides-configured.png`
- **What to look for**:
  - Field override table/list shows two entries
  - vatNumber row with visibility set to "HIDDEN"
  - registrationNumber row with visibility set to "READ_ONLY"
  - Dropdown selectors visible for each field's visibility level
  - The selected resource "system.company-profile.detail" is shown in the resource selector

## Checkpoint 3: Save Success
- **When**: After clicking Save Settings (Step 7)
- **Screenshot file**: `step-7-field-overrides-saved-success.png`
- **What to look for**:
  - Success toast message visible (e.g. "Field overrides updated" or similar)
  - Field override table still shows the two configured overrides (vatNumber=HIDDEN, registrationNumber=READ_ONLY)
  - No error messages present
  - Page remains on the access group detail view
