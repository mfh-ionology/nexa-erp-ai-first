# Journey 13: Manage Assignees in Detail Sheet — Visual Checkpoints

## Checkpoint 1: Detail Sheet with Assignees Section
- **When**: After step 2 — clicking an active task row to open the detail sheet
- **Screenshot file**: step-2-detail-sheet-assignees-section.png
- **What to look for**: 480px sheet visible from right. Assignees section shows label "ASSIGNEES", list of current assignees with purple avatar circles (bg-[#ede9fe]) showing initials, display names, X remove buttons. "+ Add" button with purple text and Plus icon visible below assignees list.

## Checkpoint 2: Add Assignee Popover Open
- **When**: After step 4 — clicking the "+ Add" assignee button
- **Screenshot file**: step-4-add-assignee-popover.png
- **What to look for**: Popover appears below the Add button containing a UserMultiSelect combobox with a search input for finding users. The popover should be 288px wide (w-72) with proper alignment.

## Checkpoint 3: After Assignee Removal
- **When**: After step 5 — clicking X to remove an assignee
- **Screenshot file**: step-5-assignee-removed.png
- **What to look for**: The removed assignee is no longer in the list. The remaining assignees (if any) still display correctly with avatars and names.
