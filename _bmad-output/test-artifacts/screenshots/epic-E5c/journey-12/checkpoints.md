# Visual Checkpoint Manifest — Journey 12: Automation Run Now & Real-Time Status

## Checkpoint 1: Automation List Page Loaded
- **When:** After navigating to /ai/admin/automations
- **Screenshot file:** step-1-automation-list.png
- **What to look for:** Automation list page with "Automations" heading, table with at least the seeded "Daily AR Aging Summary" automation visible. Columns: Name, Trigger, Schedule, Steps, Last Run, Last Run Time, Active toggle, Actions.

## Checkpoint 2: Run Now Confirmation Dialog
- **When:** After clicking "Run Now" from the overflow menu for "Daily AR Aging Summary"
- **Screenshot file:** step-2-run-now-dialog.png
- **What to look for:** Dialog titled "Run Automation" with description "Are you sure you want to run this automation now? It will execute immediately." Automation name displayed in monospace. "Cancel" and "Run Now" buttons visible, Run Now button in purple (#7c3aed).

## Checkpoint 3: Automation Triggered Toast
- **When:** After clicking "Run Now" confirm button in the dialog
- **Screenshot file:** step-3-automation-triggered.png
- **What to look for:** Toast notification indicating automation was started. Dialog should have closed. Automation list may show updated "Last Run" status.

## Checkpoint 4: Automation Runs List Page
- **When:** After navigating to /ai/admin/automations/runs
- **Screenshot file:** step-4-runs-list.png
- **What to look for:** "Automation Runs" page heading. Table showing the newly triggered run at or near the top. Columns visible: Automation name, Trigger badge, Triggered By (should show manual user), Started At, Duration, Status badge, Tokens (mono), Cost (mono). The new run should show a status of Running/Completed/Pending.

## Checkpoint 5: Run Detail Page
- **When:** After clicking on the newly created run row
- **Screenshot file:** step-5-run-detail.png
- **What to look for:** Run detail page with: run ID in header (e.g. "Run abc12345"), status badge, "Triggered by" info showing manual trigger, metrics cards row (Total Tokens, Total Cost, Steps X/Y, Duration), step timeline section with status indicators. Purple-themed Concept D styling.
