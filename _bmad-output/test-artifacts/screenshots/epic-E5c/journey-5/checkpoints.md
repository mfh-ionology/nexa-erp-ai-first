# Journey 5: Create a New Prompt Template — Visual Checkpoints

## Checkpoint 1: Prompt Templates List Page
- **When**: After navigating to /ai/admin/prompts (Step 1)
- **Screenshot file**: `step-1-prompt-list-loaded.png`
- **What to look for**: T1 Entity List with breadcrumbs "AI Administration > Prompt Templates", search bar, category filter dropdown, Create button. Table showing at least 6 seeded prompts with columns: name (mono), category (coloured badge), version (mono "v1"), variables count, status, last updated. Concept D purple theme.

## Checkpoint 2: Prompt Editor Create Mode
- **When**: After clicking Create button (Step 3)
- **Screenshot file**: `step-3-prompt-editor-create-mode.png`
- **What to look for**: New Prompt Template heading, metadata card with Name (mono), Category dropdown, Description textarea, Active toggle. System Prompt card with textarea. User Template card with textarea. Save and Cancel buttons in action bar.

## Checkpoint 3: Form Filled Before Save
- **When**: After filling all form fields (Steps 4-6)
- **Screenshot file**: `step-6-form-filled-before-save.png`
- **What to look for**: Name field shows "test-invoice-reminder" in mono, Category shows "Automation" selected, Description populated, System prompt textarea contains {{company.name}} and {{today}} variables, User template textarea contains {{customer.name}}, {{overdueCount}}, {{reminderTone}} variables.

## Checkpoint 4: Prompt Created Successfully
- **When**: After clicking Save (Step 7)
- **Screenshot file**: `step-7-prompt-created-success.png`
- **What to look for**: Success toast visible, navigated to prompt detail/editor page showing saved data. Version sidebar showing "v1" with "Initial version" change reason. Active badge and version badge visible.

## Checkpoint 5: New Prompt in List
- **When**: After navigating back to /ai/admin/prompts (Step 8)
- **Screenshot file**: `step-8-prompt-in-list.png`
- **What to look for**: Prompt list includes "test-invoice-reminder" row with "automation" category badge, version "v1" in mono, active status indicator.
