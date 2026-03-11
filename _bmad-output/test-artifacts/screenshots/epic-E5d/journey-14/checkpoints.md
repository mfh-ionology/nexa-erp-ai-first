# Visual Checkpoints — Journey 14: Create Knowledge Article from Correction

## Checkpoint 1: Corrections Tab Loaded
- **When**: After navigating to /ai/admin/knowledge#corrections and tab loads
- **Screenshot file**: `step-1-corrections-tab-loaded.png`
- **What to look for**: Corrections tab is active, correction cards visible with grouped accordion layout, each card shows original response (italic), corrected response, type badge, and "Create Article" button with BookPlus icon

## Checkpoint 2: Article Form Dialog Pre-filled
- **When**: After clicking "Create Article" on a correction card
- **Screenshot file**: `step-2-article-form-prefilled.png`
- **What to look for**: Dialog titled "Create Knowledge Article" is open, title field pre-filled with "From correction: ..." (first 80 chars of corrected response), content textarea pre-filled with full corrected response, category select pre-mapped from correction type

## Checkpoint 3: Article Created Success
- **When**: After clicking Create Article button in dialog
- **Screenshot file**: `step-3-article-created-success.png`
- **What to look for**: Success toast visible with message "Knowledge article created from correction", dialog closed, user back on corrections tab
