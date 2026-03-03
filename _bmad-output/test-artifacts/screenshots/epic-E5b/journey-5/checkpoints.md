# Visual Checkpoint Manifest — Journey 5: Edit an Existing Memory

## Checkpoint 1: Memory Page Loaded
- **When**: After navigating to /ai/memory and waiting for data to load
- **Screenshot file**: `step-1-memory-page-loaded.png`
- **What to look for**:
  - Light purple (#f4f2ff) background
  - "My Memory" page title with Brain icon
  - Settings panel visible at top (Enable AI Memory toggle, category checkboxes)
  - Memory cards visible below, grouped by category with count badges
  - Cards have 12px border-radius, category badges (coloured), source badges

## Checkpoint 2: Edit Dialog Open
- **When**: After clicking the Edit (pencil icon) button on the first memory card
- **Screenshot file**: `step-2-edit-dialog-open.png`
- **What to look for**:
  - Dialog overlay covering the page
  - Dialog heading "Edit Memory"
  - Textarea pre-filled with the current memory content
  - Cancel and Save buttons visible in dialog footer
  - Save button styled with purple (#7c3aed) background
  - Dialog has step-in animation, rounded corners

## Checkpoint 3: Memory Updated Successfully
- **When**: After clearing textarea, typing new content, and clicking Save
- **Screenshot file**: `step-4-memory-updated-toast.png`
- **What to look for**:
  - Dialog has closed (no overlay visible)
  - Memory card content updated to show "Updated preference: Always use Net 60 payment terms"
  - Green/success toast notification visible with text "Memory updated"
  - Card still shows correct category badge and source badge
  - No error messages or broken layout
