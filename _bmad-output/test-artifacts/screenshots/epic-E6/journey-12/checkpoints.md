# Visual Checkpoint Manifest — Journey 12: Configure Access Group Permission Matrix

## Checkpoint 1: Permission Matrix Loaded
- **When**: After navigating to the TEST_SALES_REP detail page and verifying the Permissions tab is active (step 3)
- **Screenshot file**: step-3-permission-matrix-loaded.png
- **What to look for**: Permission matrix visible with collapsible module groups. Each module card should show a chevron, module name, resource count in parentheses, and 5 "Select All" checkboxes across the header row (Access, New, View, Edit, Delete). Column headers visible below module header. All checkboxes should be unchecked since this is a new group with no permissions.

## Checkpoint 2: Sales Module Expanded
- **When**: After expanding the Sales module group (step 4)
- **Screenshot file**: step-4-sales-module-expanded.png
- **What to look for**: Sales module section expanded showing individual resources (Quotes, Sales Orders, Delivery Notes). Each resource row has the resource name on the left and 5 checkboxes (Access, New, View, Edit, Delete) on the right. All checkboxes should be unchecked.

## Checkpoint 3: Select All Access Applied to Sales
- **When**: After clicking the "Select All Access" checkbox on the Sales module header (step 5)
- **Screenshot file**: step-5-select-all-access-sales.png
- **What to look for**: All checkboxes in the "Access" column for Sales resources are now checked. Other permission columns (New, View, Edit, Delete) remain unchecked. The "Select All Access" checkbox in the Sales module header should show as fully checked (not indeterminate).

## Checkpoint 4: Permissions Saved Successfully
- **When**: After clicking "Save Permissions" and receiving the success toast (step 8)
- **Screenshot file**: step-8-permissions-saved-toast.png
- **What to look for**: Green/success toast visible with text "Permissions saved successfully". The Save Permissions button should return to a disabled state (no unsaved changes). The checkbox states should be retained: all Sales Access checked, plus View and Edit checked for Sales Orders.
