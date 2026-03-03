# Visual Checkpoints — Journey 20: Export and Import Permission Configuration

## Checkpoint 1: Overflow Menu with Export/Import Options
- **When**: After step 2 — clicking the overflow menu on company profile page
- **Screenshot file**: `step-02-overflow-menu-export-import.png`
- **What to look for**: Overflow menu is open showing 'Export Config' and 'Import Config' options. The menu should be positioned near the overflow button. Both options should be clearly labeled and clickable.

## Checkpoint 2: Export JSON Preview/Download
- **When**: After step 3 — clicking 'Export Config' option
- **Screenshot file**: `step-03-export-config-preview.png`
- **What to look for**: Export dialog or JSON preview modal showing the exported configuration. Should contain key sections: version, exportedAt, exportedFrom (company name), resources array, accessGroups array with permissions and fieldOverrides. JSON should be formatted/readable.

## Checkpoint 3: Import Dialog with Dry-Run Toggle
- **When**: After step 5 — clicking 'Import Config' option from overflow menu
- **Screenshot file**: `step-05-import-dialog.png`
- **What to look for**: Import dialog/modal with a JSON textarea or file upload area, a dry-run toggle checkbox (enabled by default or visible), and an Import button. The dialog should be clearly laid out for pasting or uploading JSON configuration.

## Checkpoint 4: Dry Run Import Results
- **When**: After step 7 — executing dry run import
- **Screenshot file**: `step-07-dry-run-results.png`
- **What to look for**: Import result display showing status: 'DRY_RUN', summary with counts (resources created/updated, access groups created/updated, permissions set). No warnings should be present. Clear indication this was a dry run and nothing was persisted.

## Checkpoint 5: Actual Import Results (Applied)
- **When**: After step 9 — executing actual import (not dry run)
- **Screenshot file**: `step-09-import-applied-results.png`
- **What to look for**: Import result display showing status: 'APPLIED', summary with created/updated counts, empty warnings array. Success indication that the permission configuration was re-applied successfully. This confirms round-trip fidelity.
