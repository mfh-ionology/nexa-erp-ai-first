# Journey 11: Automation Chain Configuration & Notifications — Visual Checkpoints

## Checkpoint 1: Automation List Page
- **When**: After navigating to /ai/admin/automations and page loads
- **Screenshot file**: step-01-automation-list.png
- **What to look for**: Automation list page with "Automations" heading visible. "E2E Weekly Summary" row should be present (created by journey 10). Purple Concept D styling. Columns: Name, Trigger, Schedule, Steps, Last Run, Active toggle.

## Checkpoint 2: Edit Page Loaded
- **When**: After clicking "E2E Weekly Summary" row to open the edit form
- **Screenshot file**: step-02-edit-page-loaded.png
- **What to look for**: Automation form page with heading showing "E2E Weekly Summary" or "Edit Automation". Status badge (Active/Inactive). Basic Configuration, Trigger Configuration, Steps, Chain Configuration, Notifications, and Budget & Limits cards visible. Cancel, Delete, Run Now, Save buttons in action bar.

## Checkpoint 3: Chain Toggle Enabled with Target Selected
- **When**: After enabling "Chain to next automation" toggle and selecting "Daily AR Aging Summary"
- **Screenshot file**: step-03-chain-configured.png
- **What to look for**: "Chain to next automation" switch is ON. "Next Automation" dropdown visible showing "Daily AR Aging Summary" selected. Description text about circular chain rejection visible.

## Checkpoint 4: Notification Section Configured
- **When**: After enabling "Notify on completion" and configuring channels/toggles (test plan step 5-6)
- **Screenshot file**: step-04-notification-configured.png
- **What to look for**: "Notify on completion" switch is ON. Nested notification config visible inside dashed border: Recipients input, Channels section with "In-App" checkbox checked, "Email" checkbox unchecked, "Notify on success" switch ON, "Notify on failure" switch ON.

## Checkpoint 5: Save Success
- **When**: After clicking Save button
- **Screenshot file**: step-05-save-success.png
- **What to look for**: Success toast message (e.g. "Automation updated"). Chain configuration still visible. Notification configuration still visible. Form in saved state.
