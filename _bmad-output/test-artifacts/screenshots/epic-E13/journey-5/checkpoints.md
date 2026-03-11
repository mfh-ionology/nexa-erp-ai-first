# Journey 5: Admin Views and Edits Company Defaults — Visual Checkpoints

## Checkpoint 1: Admin view with Company Defaults section
- **When**: After step 4 — page loaded with admin view confirmed
- **Screenshot file**: step-4-admin-page-with-company-defaults.png
- **What to look for**:
  - Page shows two distinct sections separated by a horizontal rule
  - Top section: user preferences table with 3 columns (Document Type, Company Default, My Preference)
  - "Company Default" column header visible in user preferences table
  - Bottom section: "Company Defaults" heading with description "Set default print behaviour for all users in this company"
  - Save Company Defaults button visible but disabled (no changes yet)
  - Company defaults table shows all 14 document types with editable dropdowns
  - Purple-themed Concept D styling: #f4f2ff background, 12px radius cards

## Checkpoint 2: Unsaved changes in Company Defaults section
- **When**: After step 9 — two company defaults changed, unsaved warning visible
- **Screenshot file**: step-9-company-defaults-unsaved-changes.png
- **What to look for**:
  - Amber warning indicator with "You have unsaved changes" text in Company Defaults section
  - Save Company Defaults button now enabled (purple #7c3aed)
  - Sales Invoice dropdown in Company Defaults table shows "Auto-Download PDF"
  - Purchase Order dropdown in Company Defaults table shows "Browser Print Dialog"

## Checkpoint 3: Company defaults saved successfully
- **When**: After step 11 — company defaults saved, success toast visible
- **Screenshot file**: step-11-company-defaults-saved.png
- **What to look for**:
  - Success toast "Company print defaults saved successfully" visible
  - Save Company Defaults button returns to disabled state
  - Unsaved changes warning disappears
  - In upper user preferences table, Company Default column shows "Auto-Download PDF" for Sales Invoice and "Browser Print Dialog" for Purchase Order
