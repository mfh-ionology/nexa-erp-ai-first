# Visual Checkpoint Manifest — Journey 6: Delete a Single Memory

## Checkpoint 1: Memory Page Loaded
- **When**: After step 1 — navigating to `/ai/memory` and waiting for data to load
- **Screenshot file**: `step-1-memory-page-loaded.png`
- **What to look for**:
  - Memory page rendered with Concept D styling (light purple #f4f2ff background)
  - At least one category section visible with memory cards
  - Category group headers with count badges showing memory counts
  - Settings panel visible at top with toggles and controls
  - No skeleton loaders remaining — data fully loaded

## Checkpoint 2: Delete Confirmation Dialog
- **When**: After step 3 — clicking the trash icon on a memory card
- **Screenshot file**: `step-3-delete-confirmation-dialog.png`
- **What to look for**:
  - AlertDialog overlay visible with semi-transparent backdrop
  - Dialog title: "Delete Memory"
  - Dialog description: "Delete this memory? This action cannot be undone."
  - Memory content excerpt visible in italics with muted background
  - Red "Delete" button (destructive styling, #dc2626)
  - "Cancel" button alongside
  - Dialog has proper border-radius matching Concept D

## Checkpoint 3: Memory Deleted Successfully
- **When**: After step 4 — clicking the Delete confirm button
- **Screenshot file**: `step-4-memory-deleted-toast.png`
- **What to look for**:
  - Delete confirmation dialog dismissed
  - The deleted memory card is no longer visible in the list
  - Success toast "Memory deleted" visible at top-right (sonner toast)
  - Category count badge decremented by 1 from previous value
  - No error messages or broken layout
  - Remaining memory cards properly laid out without gaps
