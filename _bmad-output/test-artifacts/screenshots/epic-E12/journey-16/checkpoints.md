# Journey 16: Deactivate a Template and Show Inactive Templates — Visual Checkpoints

## CP-1: Template list loaded with target template visible
- **When**: After navigating to /settings/document-templates and list loads
- **Screenshot file**: step-1-template-list-with-cloned-template.png
- **What to look for**: Template list loaded. 'E2E Cloned Invoice Template' card visible in the SALES_INVOICE group with green 'Active' badge. Page layout correct (T7 Settings).

## CP-2: Deactivation confirmation dialog
- **When**: After clicking Deactivate in the overflow menu (before confirming)
- **Screenshot file**: step-2-deactivate-confirmation-dialog.png
- **What to look for**: Confirmation dialog visible with title 'Deactivate Template'. Description asks to confirm deactivation of 'E2E Cloned Invoice Template'. Red 'Deactivate' button and 'Cancel' button visible. Background dimmed by overlay.

## CP-3: Template deactivated — success toast and removed from list
- **When**: After confirming deactivation
- **Screenshot file**: step-3-template-deactivated-success.png
- **What to look for**: Success toast visible (e.g. 'Template deactivated'). 'E2E Cloned Invoice Template' no longer visible in the active template list. SALES_INVOICE group template count reduced.

## CP-4: Show Inactive toggled — inactive template visible
- **When**: After clicking 'Show Inactive' toggle
- **Screenshot file**: step-4-showing-inactive-templates.png
- **What to look for**: 'E2E Cloned Invoice Template' visible again with gray 'Inactive' badge (bg-gray-100 text-gray-500). 'Show Inactive' button now reads 'Showing Inactive' with purple background. Template card visually distinct from active templates.

## CP-5: Overflow menu shows Activate option for inactive template
- **When**: After opening overflow menu on the inactive template
- **Screenshot file**: step-5-activate-option-in-menu.png
- **What to look for**: Overflow menu open on the deactivated template. 'Activate' option visible in green text (instead of red 'Deactivate'). Power icon next to Activate text.
