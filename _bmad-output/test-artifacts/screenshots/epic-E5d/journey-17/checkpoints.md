# Journey 17: Suggested Knowledge — Edit & Accept with Category Remap

## Visual Checkpoints

### Checkpoint 1: Suggested tab loaded
- **When**: After navigating to /ai/admin/knowledge#suggested and activating Suggested tab
- **Screenshot file**: step-1-suggested-tab-loaded.png
- **What to look for**: Knowledge Management page with Suggested tab active, suggestion cards visible with Edit & Accept buttons, or empty state if no suggestions available

### Checkpoint 2: Edit form dialog opened
- **When**: After clicking "Edit & Accept" on a suggested article
- **Screenshot file**: step-2-edit-form-dialog.png
- **What to look for**: Modal/dialog form pre-filled with platform article content. Editable title, content, and category fields visible. Category should be remapped from platform taxonomy (e.g., BEST_PRACTICE) to tenant taxonomy (e.g., BUSINESS_PROCESS). Form should have Save/Accept button

### Checkpoint 3: Form modified with new content and category
- **When**: After modifying content text and changing category dropdown
- **Screenshot file**: step-3-form-modified.png
- **What to look for**: Content field shows customised text, category dropdown changed to INDUSTRY_RULES or similar tenant category. Save button should be enabled

### Checkpoint 4: Save success — article accepted
- **When**: After clicking Save to accept the modified article
- **Screenshot file**: step-4-save-success.png
- **What to look for**: Success toast message visible (e.g., "Article accepted" or "Knowledge article created"), suggestion card removed from Suggested tab list, count reduced or empty state shown
