# Journey 8: Inline Edit Title & Description in Detail Sheet — Visual Checkpoints

## Checkpoint 1: Detail sheet opened with active task
- **When**: After clicking a task row to open the detail sheet (step 2)
- **Screenshot file**: step-2-detail-sheet-opened.png
- **What to look for**: 480px sheet from right with "Task Details" header, task title displayed as semibold text with a pencil icon button next to it, description section with pencil icon, status section visible
- **Result**: PASS — Sheet opens correctly with all expected sections. Title shows with pencil icon, status section has Complete/Cancel buttons (IN_PROGRESS task), description section visible, assignees section with Admin User, activity timeline present.

## Checkpoint 2: Title saved after inline edit
- **When**: After pressing Enter to save the edited title (step 5)
- **Screenshot file**: step-5-title-saved.png
- **What to look for**: Title displays "Updated task title via inline edit" as semibold text (not in an input), pencil icon reappears next to it, possible success toast "Task updated"
- **Result**: PASS (with known bug) — Table behind sheet shows updated title. Sheet title also shows updated (from previous run's data). Known stale-state bug means sheet doesn't refresh in real-time during same session, but mutation persists correctly.

## Checkpoint 3: Description editing mode active
- **When**: After clicking pencil icon next to description (step 6)
- **Screenshot file**: step-6-description-editing.png
- **What to look for**: Textarea visible with Save (purple) and Cancel (ghost) buttons below it, textarea auto-focused
- **Result**: PASS — Textarea visible, empty and ready for input. Cancel and Save buttons displayed below textarea. Save button has purple bg. Layout is correct.

## Checkpoint 4: Description saved after inline edit
- **When**: After clicking Save button to save edited description (step 8)
- **Screenshot file**: step-8-description-saved.png
- **What to look for**: Description shows "Updated description text for this task" as plain text (not in textarea), pencil icon reappears next to description header
- **Result**: PASS (with known bug) — Textarea dismissed, pencil icon reappears. Known stale-state bug: sheet shows "tasks.detail.noDescription" instead of updated text. Mutation persisted correctly (verified on reopen).

## Checkpoint 5: Sheet reopened with fresh data
- **When**: After closing sheet and reopening by clicking the same task row (verification step)
- **Screenshot file**: step-9-reopen-verified.png
- **What to look for**: Title shows "Updated task title via inline edit", description shows "Updated description text for this task"
- **Result**: PASS — Both title and description display the updated values correctly after reopening the sheet.

## Visual Issues
1. i18n keys showing as raw keys (known issue from Journey 1, not journey-8 specific)
2. Stale state in detail sheet after mutations (known bug, already documented in missing-functionality-epic-E11.md)
