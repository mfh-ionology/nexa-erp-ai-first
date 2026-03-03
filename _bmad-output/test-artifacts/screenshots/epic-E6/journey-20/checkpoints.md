# Visual Checkpoints — Journey 20: Export Company Configuration as JSON

## Checkpoint 1: Company Profile Page Loaded
- **When**: After navigating to /system/companies and page renders
- **Screenshot file**: step-1-company-profile-page.png
- **What to look for**: Company Profile page with company name as title ("Demo Company" or "Company Profile"). Breadcrumbs showing "System > Company Profile". Overflow menu button (three dots / MoreHorizontal icon) visible in the action bar area. Placeholder card with "Company settings will be available here in a future update." text.

## Checkpoint 2: Overflow Menu Open
- **When**: After clicking the overflow menu (More actions) button
- **Screenshot file**: step-2-overflow-menu-open.png
- **What to look for**: Dropdown menu visible with "Data" section label. Two menu items: "Export Config" (with Download icon) and "Import Config" (with Upload icon). Menu aligned to the right side.

## Checkpoint 3: Export Preview Dialog
- **When**: After clicking "Export Config" menu item, dialog opens with preview data loaded
- **Screenshot file**: step-3-export-dialog-preview.png
- **What to look for**: Dialog titled "Export Company Configuration" with description text about downloading config. Preview card showing 2-column grid with entity type counts: Access Groups, Permissions, Field Overrides, VAT Codes, Payment Terms, Number Series, Currencies — each with a numeric count. "Cancel" (ghost) and "Download JSON" (primary) buttons in footer.

## Checkpoint 4: Export Success — Toast and Dialog Closed
- **When**: After clicking "Download JSON" button
- **Screenshot file**: step-4-export-success-toast.png
- **What to look for**: Success toast message "Configuration exported successfully" visible (green/success styling). Export dialog should be closed. Company Profile page visible again behind. Browser download should have been triggered for a company-defaults-*.json file.
