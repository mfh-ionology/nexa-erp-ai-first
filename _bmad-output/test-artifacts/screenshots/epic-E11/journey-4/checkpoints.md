# Visual Checkpoints — Journey 4: Create Task & Add Another

## Checkpoint 1: Dialog open after clicking Create Task
- **When**: After step 2 — clicking "+ Create Task" button
- **Screenshot file**: step-2-create-dialog-open.png
- **What to look for**: Create Task dialog visible with Title input, Description textarea, Priority select (default Normal), Due Date button, Assignees field, "Create & Add Another" outline button and "Create" purple button. Dialog max-w ~560px.

## Checkpoint 2: After "Create & Add Another" — dialog stays open, fields cleared
- **When**: After step 4 — clicking "Create & Add Another" with first task title filled
- **Screenshot file**: step-4-create-and-add-another-fields-cleared.png
- **What to look for**: Dialog STILL OPEN. Title input is EMPTY (cleared). Priority reset to Normal. Success toast visible confirming "First task - review report" was created. Form ready for next entry.

## Checkpoint 3: After second task created — dialog closes, both tasks in list
- **When**: After step 6 — clicking "Create" for second task
- **Screenshot file**: step-6-both-tasks-in-list.png
- **What to look for**: Dialog DISMISSED. Task list shows both "First task - review report" and "Second task - send email" in the table. Success toast for second task creation.
