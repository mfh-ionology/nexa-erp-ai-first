# Visual Checkpoint Manifest — Journey 21: Import Configuration with Dry Run Preview

## Checkpoint 1: Import Dialog Open
- **When**: After Step 3 — clicking "Import Config" from overflow menu
- **Screenshot file**: `step-3-import-dialog-open.png`
- **What to look for**: Dialog titled "Import Company Configuration". File drop zone with dashed border visible. JSON textarea below with "OR" separator. "Dry Run" checkbox checked by default. "Import" button disabled (no data yet). "Cancel" button visible.

## Checkpoint 2: JSON Pasted, Import Button Enabled
- **When**: After Step 4 — pasting JSON into textarea
- **Screenshot file**: `step-4-json-pasted-import-enabled.png`
- **What to look for**: JSON textarea filled with configuration JSON text. Import button is now enabled (no longer greyed out/disabled). Dry Run checkbox still checked.

## Checkpoint 3: Dry Run Results Panel
- **When**: After Step 5 — clicking Import with Dry Run checked
- **Screenshot file**: `step-5-dry-run-results.png`
- **What to look for**: Results panel showing "Dry Run Preview" title. Summary table with columns: Entity Type, Created, Updated. Rows for Resources, Access Groups, Permissions, etc. "Apply" button to proceed with actual import. "Close" button to dismiss.

## Checkpoint 4: Applied Results with Success Toast
- **When**: After Step 6 — clicking Apply in dry run results
- **Screenshot file**: `step-6-import-applied-success.png`
- **What to look for**: Results panel updated to "Import Results" title. Summary shows final applied counts. Success toast "Configuration imported successfully". "Done" button visible to close dialog.
