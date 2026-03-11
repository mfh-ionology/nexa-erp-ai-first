# Visual Checkpoints — Journey 8: Soft-Delete Knowledge Article

## Checkpoint 1: Knowledge Articles Tab Loaded
- **When:** After navigating to /ai/admin/knowledge#articles and waiting for articles to render (Step 1)
- **Screenshot file:** step-1-articles-tab-loaded.png
- **What to look for:** Knowledge Management heading visible, Knowledge Articles tab active (data-state="active"), article cards in category-grouped accordion sections, stats panel above tabs

## Checkpoint 2: Overflow Menu Open with Delete Option
- **When:** After clicking the three-dot overflow button (aria-label="Article actions") on an article card (Step 2)
- **Screenshot file:** step-2-overflow-menu-open.png
- **What to look for:** DropdownMenu visible with Edit and Delete menu items. Delete has red text (#dc2626) and Trash2 icon. May also show Confirm option if article is unconfirmed

## Checkpoint 3: Deactivate Confirmation Dialog
- **When:** After clicking Delete from the overflow menu (Step 2)
- **Screenshot file:** step-3-delete-confirmation-dialog.png
- **What to look for:** AlertDialog with title "Deactivate Knowledge Article?", description about deactivation, Cancel button and red Deactivate button (#dc2626). Background dimmed/overlay

## Checkpoint 4: After Deactivation — Toast with Undo
- **When:** After clicking the Deactivate button in confirmation dialog (Step 3)
- **Screenshot file:** step-4-after-delete-undo-toast.png
- **What to look for:** Success toast showing '"<article title>" deactivated' with Undo action button (5-second duration). Article removed from visible list or moved to inactive state
