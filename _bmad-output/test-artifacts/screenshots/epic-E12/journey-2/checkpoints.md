# Journey 2: Create a Custom Sales Invoice Template — Visual Checkpoints

## CP-1: Dashboard After Login
- **When**: After step 1 — navigating to / and authenticating
- **Screenshot**: `step-1-dashboard-loaded.png`
- **What to look for**: Application dashboard visible with sidebar navigation. Purple Concept D background (#f4f2ff). Sidebar shows navigation groups.

## CP-2: Template Editor Form Opened
- **When**: After step 2 — clicking "Add Template" button
- **Screenshot**: `step-2-template-editor-form.png`
- **What to look for**: Editor form visible with "New Template" or "Create Template" heading. Document Type dropdown, Name input, Description textarea visible. Page Settings section with page size, orientation, and margin fields. Branding section with toggle switches (Show Logo, Show Bank Details, Show VAT Number, Show Company Reg). HTML Template textarea with monospace font. Collapsible CSS/Header/Footer sections. Save ("Create Template") and Cancel buttons at bottom.

## CP-3: Form Fields Populated
- **When**: After step 3 — filling all form fields
- **Screenshot**: `step-3-form-fields-populated.png`
- **What to look for**: Document Type shows "Sales Invoice". Name field contains "E2E Test Invoice Template". Description contains test description. Page size A4, orientation portrait. Margins set (25/25/15/15). Branding toggles all enabled. HTML template textarea contains the HTML template content.

## CP-4: After Save — Success Toast and List View
- **When**: After step 6 — clicking Save/Create Template button
- **Screenshot**: `step-6-save-success-toast.png`
- **What to look for**: Success toast notification visible (e.g., "Template created successfully"). Template list view shown (returned from editor). The new "E2E Test Invoice Template" should appear in the SALES_INVOICE accordion group with green "Active" badge. No purple "Default" badge (isDefault was false).

## CP-5: Template Verified in List
- **When**: After step 7 — verifying template in SALES_INVOICE group
- **Screenshot**: `step-7-template-in-list.png`
- **What to look for**: SALES_INVOICE accordion section expanded. "E2E Test Invoice Template" card visible alongside the seeded default template. Card shows Active badge, page size (A4), and version count. Template list properly styled with Concept D design (12px border-radius cards, proper shadows).
