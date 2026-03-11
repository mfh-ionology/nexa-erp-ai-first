# Journey 12: Assign a New Plan to a Tenant — Visual Checkpoints

## Checkpoint 1: Plan Assignment Dialog Opened
- **When**: After step 3 — clicking "Change Plan" button in billing tab
- **Screenshot file**: `01-plan-assignment-dialog-opened.png`
- **What to look for**: Dialog titled "Change Subscription Plan" with current plan name shown (e.g. "Core (core)"), a "New Plan" dropdown defaulting to "Select a plan...", an optional reason textarea, Cancel and "Confirm Plan Change" buttons. Confirm button should be disabled (no plan selected yet).

## Checkpoint 2: Plan Comparison View
- **When**: After step 4 — selecting "Pro" plan from the dropdown
- **Screenshot file**: `02-plan-comparison-view.png`
- **What to look for**: Side-by-side comparison table visible with columns: Limit, Current, New. Rows for Max Users, Max Companies, AI Token Allowance, API Rate Limit. Increases shown in green text, decreases in red. An amber warning box about immediate effect. Confirm button still disabled (no plan selected yet is wrong — it should now be enabled since a plan is selected).

## Checkpoint 3: Reason Filled and Ready to Confirm
- **When**: After step 5 — filling in the reason field
- **Screenshot file**: `03-reason-filled-ready.png`
- **What to look for**: Reason textarea contains "Customer upgraded to Pro tier". Confirm Plan Change button is enabled/clickable.

## Checkpoint 4: Plan Changed Success
- **When**: After step 6 — clicking "Confirm Plan Change"
- **Screenshot file**: `04-plan-changed-success.png`
- **What to look for**: Success toast visible with text like "Plan changed from core to pro". Dialog should be closed. Billing tab should refresh showing the new plan name in the Subscription section.
