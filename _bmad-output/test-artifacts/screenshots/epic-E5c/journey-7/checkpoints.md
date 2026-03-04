# Journey 7: Prompt Variable Autocomplete and Test Rendering — Visual Checkpoints

## Checkpoint 1: Prompt Editor Page Loaded
- **When**: After navigating to prompt editor page (step 2)
- **Screenshot file**: step-2-prompt-editor-loaded.png
- **What to look for**: Prompt editor page with metadata section (name, category, description, active toggle), system prompt textarea with monospace font, user template textarea, version sidebar on right. Concept D purple theme.

## Checkpoint 2: Variable Autocomplete Dropdown
- **When**: After typing '{{' in system prompt textarea (step 4)
- **Screenshot file**: step-4-variable-autocomplete-dropdown.png
- **What to look for**: Autocomplete dropdown/popover visible below cursor position showing variables grouped by source type — System variables (today, currentUser.name, company.name, company.baseCurrency, etc.) with colored badges (blue for System, green for DB Fields, amber for Page Fields). Each variable shows name in monospace + display name. Keyboard navigable list.

## Checkpoint 3: Variable Inserted
- **When**: After selecting 'company.baseCurrency' from autocomplete (step 5)
- **Screenshot file**: step-5-variable-inserted.png
- **What to look for**: The text '{{company.baseCurrency}}' inserted at cursor position in the system prompt textarea. Autocomplete dropdown should be closed.

## Checkpoint 4: Test Prompt Panel Open
- **When**: After clicking 'Test Prompt' button (step 6)
- **Screenshot file**: step-6-test-prompt-panel-open.png
- **What to look for**: Right-side sheet/panel open showing input fields for each bound variable (with monospace labels and source type badges), a 'Render' button, and an empty output area. Panel should have proper Concept D styling.

## Checkpoint 5: Rendered Prompt Output
- **When**: After clicking 'Render' button (step 7)
- **Screenshot file**: step-7-rendered-prompt-output.png
- **What to look for**: Rendered system prompt and user template displayed in monospace font cards with green left border. Variables should be replaced with sample/default values. If any unresolved variables exist, an amber warning should be visible with the unresolved count. Resolved variables shown as a definition list below.
