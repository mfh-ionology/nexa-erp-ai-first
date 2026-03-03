# Journey 5: Prompt Editor Variable Autocomplete — Visual Checkpoints

## Checkpoint 1: New Prompt Editor Page Loaded
- **When**: After navigating to `/ai/admin/prompts/new` (Step 1)
- **Screenshot file**: `step-1-new-prompt-editor-loaded.png`
- **What to look for**: New Prompt Template page loaded with heading "New Prompt Template", Name field, Category dropdown, Description textarea, System Prompt textarea with `{{` hint text, User Template textarea, Parameters section. Purple Concept D styling with #f4f2ff background.

## Checkpoint 2: Autocomplete Dropdown Appears After Typing `{{`
- **When**: After typing "Hello {{" into the System Prompt textarea (Step 4)
- **Screenshot file**: `step-4-autocomplete-dropdown-visible.png`
- **What to look for**: Autocomplete popover (role="listbox") visible near the cursor position, showing variables grouped by source type. Expect group headers like "System" with variables including `today`, `currentUser.name`, `currentUser.role`, `company.name`, `company.baseCurrency`. Each variable shows the variable name in mono font and a colored source-type badge. The active/first item should be highlighted with purple tint (#f5f3ff background).

## Checkpoint 3: Variable Inserted After Selection
- **When**: After clicking `company.name` in the autocomplete dropdown (Step 5)
- **Screenshot file**: `step-5-variable-inserted.png`
- **What to look for**: System Prompt textarea now shows "Hello {{company.name}}" with the closing `}}` auto-inserted. The autocomplete popover should be dismissed/closed. The textarea should still be focused.
