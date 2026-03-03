# Visual Checkpoint Manifest - Journey 2: Model Registry CRUD Lifecycle

## Checkpoint 1: Model List Page Loaded
- **When**: After navigating to /ai/admin/models (step 1)
- **Screenshot file**: step-1-model-list-loaded.png
- **What to look for**: T1 Entity List page with "Model Registry" heading, breadcrumbs "AI Administration > Model Registry", table with columns (Name, Provider, Model ID, Max Tokens, Cost/M In, Cost/M Out, Routing Tags, Status, Default). At least 3 seeded models visible (claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5). Purple Concept D styling.

## Checkpoint 2: New Model Form Page
- **When**: After clicking "Add Model" and form loads (step 4)
- **Screenshot file**: step-4-new-model-form.png
- **What to look for**: Form page with "New Model" heading, breadcrumbs "AI Administration > Model Registry > New Model". Primary tab visible with fields: Name, Display Name, Provider, Model ID, Max Input Tokens, Max Output Tokens, Cost fields. Save button should be disabled (form not dirty). Cancel button visible.

## Checkpoint 3: Model Created Successfully
- **When**: After clicking Save with valid form data (step 8)
- **Screenshot file**: step-8-model-created-toast.png
- **What to look for**: Success toast "Model created successfully" visible. Page should show the model detail/edit page for the newly created model. Breadcrumbs should show "AI Administration > Model Registry > Test GPT-4o".

## Checkpoint 4: Updated Model in List
- **When**: After navigating back to model list (steps 11-12)
- **Screenshot file**: step-12-model-in-list.png
- **What to look for**: Model list page showing "test-gpt-4o" row with mono font name. Updated display name "Test GPT-4o (Updated)" should be reflected. Provider should show "openai" badge.

## Checkpoint 5: Model Deleted from List
- **When**: After confirming delete and model removed (step 14)
- **Screenshot file**: step-14-model-deleted.png
- **What to look for**: Model list no longer contains "test-gpt-4o". Success toast "Model deleted successfully" visible. Seeded models (claude-opus-4-6, etc.) still present in list.
