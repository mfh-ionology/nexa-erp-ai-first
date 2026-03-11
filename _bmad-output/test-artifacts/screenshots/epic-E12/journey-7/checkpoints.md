# Visual Checkpoint Manifest — Journey 7: Edit an Existing Template

## CP-1: Overflow menu on template card
- **When**: After step 2 — clicking three-dot menu on 'E2E Test Invoice Template' card
- **Screenshot**: `step-2-overflow-menu-open.png`
- **What to look for**: Dropdown menu visible with action items: Edit, Preview, Clone, Set as Default, Deactivate. Menu positioned near the overflow button. Purple-tinted styling.

## CP-2: Template editor form pre-populated
- **When**: After step 3 — clicking Edit in the overflow menu
- **Screenshot**: `step-3-editor-form-prepopulated.png`
- **What to look for**: Editor form visible with 'Edit Template' heading. Document Type dropdown showing 'Sales Invoice' and DISABLED (greyed out). Name field shows 'E2E Test Invoice Template'. Description field populated. Page settings showing A4/portrait. Branding toggles visible. HTML template textarea populated.

## CP-3: After save — success toast and list view
- **When**: After step 7 — clicking Save button
- **Screenshot**: `step-7-save-success-toast.png`
- **What to look for**: Success toast notification visible (e.g. 'Template updated successfully'). Template list view restored. 'E2E Test Invoice Template' card visible in the SALES_INVOICE group.

## CP-4: Re-opened editor showing updated values
- **When**: After step 10 — verifying updated description persisted
- **Screenshot**: `step-10-editor-updated-values.png`
- **What to look for**: Editor form re-opened showing updated description text 'Updated: Custom invoice template with enhanced styling for E2E testing'. Margins should show updated values (30/30).
