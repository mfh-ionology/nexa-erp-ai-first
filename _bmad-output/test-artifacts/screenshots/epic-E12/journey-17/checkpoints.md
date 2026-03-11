# Journey 17: Reactivate a Deactivated Template — Visual Checkpoints

## CP-1: Inactive template list showing deactivated template
- **When**: After clicking "Show Inactive" toggle (Step 2)
- **Screenshot file**: step-2-inactive-list-with-deactivated-template.png
- **What to look for**: 'E2E Cloned Invoice Template' is visible in the list. It should show an 'Inactive' badge (grey). The toggle button should reflect the "Showing Inactive" state.

## CP-2: Overflow menu with Activate option
- **When**: After clicking overflow menu on inactive template card (Step 3)
- **Screenshot file**: step-3-overflow-menu-activate-option.png
- **What to look for**: Dropdown menu is visible with an 'Activate' menu item. 'Deactivate' should NOT be present since the template is already inactive.

## CP-3: Template reactivated — success toast
- **When**: After clicking Activate and operation completes (Step 4)
- **Screenshot file**: step-4-template-reactivated-success.png
- **What to look for**: Success toast visible (e.g. "Template activated"). The template should disappear from the inactive list since it is now active again.

## CP-4: Active list with reactivated template
- **When**: After toggling back to active view (Step 5)
- **Screenshot file**: step-5-active-list-with-reactivated-template.png
- **What to look for**: Active template list displayed. 'E2E Cloned Invoice Template' visible with green 'Active' badge. SALES_INVOICE group should contain the reactivated template alongside other invoice templates.
