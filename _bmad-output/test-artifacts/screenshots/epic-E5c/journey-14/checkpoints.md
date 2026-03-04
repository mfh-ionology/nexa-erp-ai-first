# Journey 14: Automation Chain Configuration and Notifications — Visual Checkpoints

## Checkpoint 1: Automation list page loaded
- **When**: After step 1 — navigating to /ai/admin/automations
- **Screenshot file**: `step-1-automation-list-loaded.png`
- **What to look for**: Automations list heading visible, 'Weekly PO Review' automation visible in the list (created by journey 12 or seed data), 'Daily AR Aging Summary' also visible

## Checkpoint 2: Automation builder opened for Weekly PO Review
- **When**: After step 2 — clicking on 'Weekly PO Review' row
- **Screenshot file**: `step-2-automation-builder-opened.png`
- **What to look for**: Automation builder form loaded in edit mode, name field pre-filled with 'Weekly PO Review', Basic Configuration and Trigger Configuration sections visible

## Checkpoint 3: Chain configuration expanded
- **When**: After step 3 — enabling chain toggle
- **Screenshot file**: `step-3-chain-config-expanded.png`
- **What to look for**: Chain configuration section expanded with dropdown showing other active automations (e.g. 'Daily AR Aging Summary'), current automation ('Weekly PO Review') excluded from dropdown list

## Checkpoint 4: Notification configuration expanded
- **When**: After step 5 — enabling notification toggle
- **Screenshot file**: `step-4-notification-config-expanded.png`
- **What to look for**: Notification section visible with channel options (In-App, Email), notify on success toggle (default true), notify on failure toggle (default true)

## Checkpoint 5: Automation saved with chain and notification config
- **When**: After step 7 — clicking Save
- **Screenshot file**: `step-5-automation-saved-success.png`
- **What to look for**: Success toast visible confirming automation updated, chain and notification configuration persisted in the form
