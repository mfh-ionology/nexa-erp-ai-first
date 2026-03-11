# Journey 13: Clone an Existing Template — Visual Checkpoints

## CP-1: Template list loaded
- **When**: After navigating to /settings/document-templates and list loads
- **Screenshot file**: step-1-template-list-loaded.png
- **What to look for**: Template list visible with grouped accordion sections. 'E2E Test Invoice Template' card visible in SALES_INVOICE group with Active badge.

## CP-2: Overflow menu open on E2E Test Invoice Template
- **When**: After clicking the three-dot menu on the E2E Test Invoice Template card
- **Screenshot file**: step-2-overflow-menu-open.png
- **What to look for**: Dropdown menu visible with options: Edit, Preview, Clone, Set as Default, Deactivate. Clone option clearly visible.

## CP-3: Clone editor form pre-populated
- **When**: After clicking Clone in the overflow menu
- **Screenshot file**: step-3-clone-editor-form.png
- **What to look for**: Editor form visible with 'Clone Template' heading. Document Type shows 'Sales Invoice' and IS ENABLED (not disabled). Name field pre-populated with 'E2E Test Invoice Template (Copy)'. HTML Template textarea pre-populated with source template HTML. isDefault checkbox unchecked. Branding toggles match source template.

## CP-4: Name field updated
- **When**: After clearing and filling in 'E2E Cloned Invoice Template'
- **Screenshot file**: step-4-name-updated.png
- **What to look for**: Name input field shows 'E2E Cloned Invoice Template'. Rest of form still intact with pre-populated values.

## CP-5: Clone saved successfully
- **When**: After clicking Create Template (save) button and returning to list
- **Screenshot file**: step-5-clone-saved-success.png
- **What to look for**: Template list visible. SALES_INVOICE group should contain the new 'E2E Cloned Invoice Template'. Success toast may be visible. The clone should show Active badge, no Default badge.
