# Journey 6: Prompt Test Render Panel — Visual Checkpoints

## Checkpoint 1: Prompt List Page Loaded
- **When**: After navigating to /ai/admin/prompts (Step 1)
- **Screenshot file**: step-1-prompt-list-loaded.png
- **What to look for**: T1 Entity List page with "Prompt Templates" heading. Table showing seeded prompts with columns: Name (monospace), Category (colored badge), Version, Variables count, Status (active/inactive dot), Last Updated. At least 6 seeded prompt rows visible. Purple Concept D theming with #f4f2ff background.

## Checkpoint 2: Prompt Editor Loaded
- **When**: After clicking a prompt row to open the editor (Step 2)
- **Screenshot file**: step-2-prompt-editor-loaded.png
- **What to look for**: Prompt editor page with two-column layout. Left side: metadata section (Name, Category, Description, Active toggle), System Prompt textarea, User Template textarea, Parameters JSON editor. Right side: Version sidebar with version history. Action bar with Cancel, Delete, Test Prompt (FlaskConical icon), and Save buttons. "Test Prompt" button visible in action bar.

## Checkpoint 3: Test Panel Open with Variable Fields
- **When**: After clicking "Test Prompt" button (Step 3)
- **Screenshot file**: step-3-test-panel-open.png
- **What to look for**: Slide-in sheet from right side (max-width 32rem). Variable input fields listed, each showing variable name in monospace font and source type badge (System, DB Field, etc.). "Render" button visible at bottom of panel (blue, with play icon). Fields auto-populated from the prompt's bound variables.

## Checkpoint 4: Rendered Output Displayed
- **When**: After clicking "Render" button (Step 4)
- **Screenshot file**: step-4-rendered-output.png
- **What to look for**: Output section with "Rendered System Prompt" in mono font card with green left border. "Rendered User Template" in mono font card with green left border. Variables replaced with resolved values in the rendered text. If unresolved variables exist, amber warning showing count. "Resolved Variables" table visible below the rendered outputs.
