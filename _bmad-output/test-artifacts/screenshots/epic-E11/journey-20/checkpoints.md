# Visual Checkpoints — Journey 20: Responsive Mobile Card Layout

## Checkpoint 1: Mobile Tasks Page — Card Layout
- **When**: After navigating to /tasks with 375x812 viewport
- **Screenshot**: `step-1-mobile-tasks-card-layout.png`
- **What to look for**: Table hidden (sm:block), card layout visible instead. Each task rendered as a rounded-xl card with status icon, title, priority badge, status label, due date. Header stacks vertically. #f4f2ff background. Status chip tabs visible and usable. '+ Create Task' button visible.

## Checkpoint 2: Mobile Detail Sheet — Full Width
- **When**: After clicking a task card to open the detail sheet
- **Screenshot**: `step-2-mobile-detail-sheet.png`
- **What to look for**: TaskDetailSheet takes full width on mobile (w-full). Contains task title, status actions, description, priority, due date, assignees, linked record section. Sheet overlay covers the page.

## Checkpoint 3: Status Cycling on Mobile Card
- **When**: After clicking status icon on a mobile task card
- **Screenshot**: `step-3-mobile-status-cycle.png`
- **What to look for**: Status icon changed (e.g. grey Circle -> blue CircleDot), detail sheet did NOT open (stopPropagation working). Card still visible, status updated inline.
