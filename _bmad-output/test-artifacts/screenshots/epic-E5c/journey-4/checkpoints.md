# Journey 4: Model List Search and Delete Guard — Visual Checkpoints

## Checkpoint 1: Search Filters Model List
- **When:** After step 2 — typing "opus" into the search input
- **Screenshot file:** step-2-search-filtered-opus.png
- **What to look for:** Search input shows "opus" text, model list is filtered to show only claude-opus-4-6 row, other models are hidden. Table maintains correct column layout.

## Checkpoint 2: Overflow Menu Actions
- **When:** After step 4 — clicking the overflow (⋮) menu on the claude-opus-4-6 row
- **Screenshot file:** step-4-overflow-menu-open.png
- **What to look for:** Dropdown menu visible with three actions: "Edit" (pencil icon), "Deactivate" or "Activate" (power icon), and "Delete" (trash icon, red text). Menu is positioned near the row.

## Checkpoint 3: Delete Confirmation Dialog
- **When:** After step 5 — clicking "Delete" from the overflow menu
- **Screenshot file:** step-5-delete-confirmation-dialog.png
- **What to look for:** AlertDialog modal visible with title "Delete Model", description warning about irreversibility, model name displayed in mono font on muted background, Cancel and red Delete buttons.

## Checkpoint 4: Delete Blocked Error Toast
- **When:** After step 6 — confirming the delete of a model referenced by agents
- **Screenshot file:** step-6-delete-blocked-error-toast.png
- **What to look for:** Error toast visible indicating the model cannot be deleted because it is referenced by agents. Model should still appear in the list (not deleted). The error message should mention agent references.
