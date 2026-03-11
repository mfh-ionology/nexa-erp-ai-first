# Visual Checkpoints — Journey 8: Set a Template as Default

## CP-1: Initial state — Standard Invoice has Default badge
- **When**: After navigating to /settings/document-templates and list loads
- **Screenshot**: `step-1-initial-default-badge.png`
- **What to look for**: 'Standard Invoice' card visible in Sales Invoice group with a purple 'Default' badge. 'E2E Test Invoice Template' card visible WITHOUT a Default badge.

## CP-2: Overflow menu open with Set as Default option
- **When**: After clicking three-dot overflow menu on 'E2E Test Invoice Template' card
- **Screenshot**: `step-3-overflow-menu-set-default.png`
- **What to look for**: Dropdown menu visible with 'Set as Default' option present. Other options (Edit, Preview, Clone) also visible.

## CP-3: After Set as Default — badge swapped
- **When**: After clicking 'Set as Default' and waiting for success
- **Screenshot**: `step-4-default-badge-swapped.png`
- **What to look for**: Success toast visible with text like 'Template updated successfully'. 'E2E Test Invoice Template' now shows purple 'Default' badge. 'Standard Invoice' no longer shows Default badge (may still show Active badge). Only one template in SALES_INVOICE group has the Default badge.
