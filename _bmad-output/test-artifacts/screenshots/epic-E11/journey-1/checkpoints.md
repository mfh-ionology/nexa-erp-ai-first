# Visual Checkpoints — Journey 1: My Tasks Page Shell & Navigation

## Checkpoint 1: Page Initial Load
- **When**: After navigating to /tasks and waiting for content to load
- **Screenshot file**: step-1-page-initial-load.png
- **What to look for**:
  - CheckSquare icon + "My Tasks" breadcrumb at top
  - "My Tasks" h1 heading in serif font
  - Purple "+ Create Task" button (bg-[#7c3aed]) top-right
  - 4 status chip tabs: All (count), Open (count), In Progress (count), Overdue (count)
  - "All" tab active with purple background and white text
  - Search input with magnifying glass icon
  - Priority dropdown filter
  - #f4f2ff light purple page background
  - animate-fade-in-up animations applied

## Checkpoint 2: Task Table Structure
- **When**: After verifying table is rendered with headers and rows
- **Screenshot file**: step-4-table-with-headers.png
- **What to look for**:
  - Table visible with rounded-xl border, bg-card, custom shadow
  - Column headers: checkbox, status icon col, Task, Priority, Status, Due, Record, Assignees
  - Header row has subtle background tint
  - Task rows visible with data (or empty state if no tasks)
  - Proper column alignment and spacing

## Checkpoint 3: Sidebar Navigation Entry
- **When**: After verifying sidebar contains My Tasks entry
- **Screenshot file**: step-2-sidebar-my-tasks.png
- **What to look for**:
  - Sidebar visible on left
  - "My Tasks" nav item in the Main section
  - CheckSquare icon next to the label
  - Active state (purple bg + white text) since we're on /tasks
