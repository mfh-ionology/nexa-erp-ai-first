# Visual Checkpoints — Journey 9: Status Tab Filtering

## Checkpoint 1: Initial page load with All tab active
- **When**: After navigating to /tasks (Step 1)
- **Screenshot file**: step-1-all-tab-active.png
- **What to look for**: My Tasks page loaded, "All" tab has purple bg-[#7c3aed] with white text, other tabs are secondary/grey. Table shows all tasks (mixed statuses). Tab counts visible in parentheses.

## Checkpoint 2: Open tab selected — only OPEN tasks shown
- **When**: After clicking Open tab (Step 2)
- **Screenshot file**: step-2-open-tab-filtered.png
- **What to look for**: "Open" tab now has purple bg, "All" tab reverted to grey. Table rows should only show tasks with grey Circle status icons and "Open" status labels. No IN_PROGRESS or COMPLETED tasks visible.

## Checkpoint 3: In Progress tab selected — only IN_PROGRESS tasks shown
- **When**: After clicking In Progress tab (Step 3)
- **Screenshot file**: step-3-in-progress-tab-filtered.png
- **What to look for**: "In Progress" tab has purple bg. Table rows show blue CircleDot icons and "In Progress" labels. No OPEN or COMPLETED tasks visible.

## Checkpoint 4: Overdue tab selected — only overdue tasks shown
- **When**: After clicking Overdue tab (Step 4)
- **Screenshot file**: step-4-overdue-tab-filtered.png
- **What to look for**: "Overdue" tab has purple bg. Table rows show tasks with red-tinted due dates. Overdue badge (AlertTriangle) may be visible. Only tasks with dueDate < today and status OPEN/IN_PROGRESS shown.
