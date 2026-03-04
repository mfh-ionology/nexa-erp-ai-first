# Journey 22: Automation Active Toggle — Visual Checkpoints

## Checkpoint 1: Automation list loaded
- **When**: After navigating to /ai/admin/automations and page loads
- **Screenshot file**: step-1-automation-list-loaded.png
- **What to look for**: Automation list page with heading "Automations", at least one automation row visible ("Daily AR Aging Summary"), Active toggle switch visible in checked/on state, Concept D purple theme

## Checkpoint 2: Toggle switched off (deactivated)
- **When**: After clicking the active toggle to deactivate the automation
- **Screenshot file**: step-2-toggle-switched-off.png
- **What to look for**: Toggle switch visually in OFF state (grey/unchecked) on the automation row, no page reload occurred, optimistic update reflected immediately, no error toast

## Checkpoint 3: Toggle switched back on (reactivated)
- **When**: After clicking the toggle again to re-enable the automation
- **Screenshot file**: step-3-toggle-switched-back-on.png
- **What to look for**: Toggle switch visually in ON state (purple/checked) on the automation row, confirming round-trip optimistic mutation works both directions, no error toast
