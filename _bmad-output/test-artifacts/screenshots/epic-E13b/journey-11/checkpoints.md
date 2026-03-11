# Journey 11: Change Billing Enforcement Action — Visual Checkpoints

## Checkpoint 1: Billing Tab Loaded
- **When**: After navigating to tenant detail and clicking Billing tab (step 2)
- **Screenshot file**: `01-billing-tab-loaded.png`
- **What to look for**: Billing tab visible with two-column layout — left column shows subscription info (status, plan, subscription status), right column shows enforcement & dunning section with enforcement timeline (4-step indicator: NONE → WARNING → READ_ONLY → SUSPENDED), NONE step highlighted in green as current. "Change Enforcement" and "Change Plan" buttons visible.

## Checkpoint 2: Enforcement Timeline Verified
- **When**: After verifying the 4-step enforcement timeline exists (step 3)
- **Screenshot file**: `02-enforcement-timeline-detail.png`
- **What to look for**: 4 circles connected by arrows/lines. Labels: "None", "Warning", "Read Only", "Suspended". NONE step highlighted with green colour. Description box below showing "Normal operation — no restrictions" or similar.

## Checkpoint 3: Change Enforcement Dialog Opened
- **When**: After clicking "Change Enforcement" button (step 4)
- **Screenshot file**: `03-enforcement-dialog-opened.png`
- **What to look for**: Modal dialog with title "Change Enforcement Action", current enforcement displayed as "None". Dropdown for target action showing only valid transitions (from NONE: only "Warning" available). Reason textarea (required, empty). Optional grace period days input. Confirm button should be disabled (no action selected yet).

## Checkpoint 4: WARNING Selected with Consequence
- **When**: After selecting WARNING from dropdown and verifying consequence text (steps 5-6)
- **Screenshot file**: `04-warning-selected-consequence.png`
- **What to look for**: Dropdown showing "Warning" selected. Consequence description visible in amber/yellow colour showing text about warning banner appearing. Confirm button still disabled (reason not yet filled).

## Checkpoint 5: Enforcement Changed Successfully
- **When**: After filling reason and clicking confirm (step 8)
- **Screenshot file**: `05-enforcement-changed-success.png`
- **What to look for**: Success toast visible showing transition "NONE → WARNING" or similar. Enforcement timeline updated — WARNING step now highlighted (amber colour instead of green NONE). Dialog closed. Billing tab refreshed with new enforcement state.
