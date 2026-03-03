# Journey 3: Model Business Rules Enforcement — Visual Checkpoints

## Checkpoint 1: Model List with Default Badge
- **When**: After step 1 — navigating to /ai/admin/models
- **Screenshot file**: `step-1-model-list-with-default.png`
- **What to look for**: Model Registry heading visible. Table shows seeded models (claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5). One model has a purple "Default" badge. Active/Inactive status indicators visible. Concept D styling with purple theme.

## Checkpoint 2: Default Model Deactivation Error
- **When**: After step 4 — attempting to save default model with Active toggled off
- **Screenshot file**: `step-4-deactivation-error.png`
- **What to look for**: Error toast or inline error message visible explaining that the default model cannot be deactivated. The form should still show the model. No navigation should have occurred.

## Checkpoint 3: New Model Created Successfully
- **When**: After step 7 — saving new "Fallback Test A" model
- **Screenshot file**: `step-7-model-created.png`
- **What to look for**: Success toast "Model created successfully" visible. Page navigated to model edit form showing "Fallback Test A" as the heading. Form fields populated with the saved data.

## Checkpoint 4: Fallback Model Set on Fallback Test A
- **When**: After step 10 — saving fallback-test-a with fallback set to claude-opus-4-6
- **Screenshot file**: `step-10-fallback-saved.png`
- **What to look for**: Model updated successfully. Advanced tab still active. Fallback Model dropdown shows claude-opus-4-6 selected.

## Checkpoint 5: Circular Fallback Error
- **When**: After step 15 — attempting to save claude-opus-4-6 with fallback set to fallback-test-a (circular chain)
- **Screenshot file**: `step-15-circular-fallback-error.png`
- **What to look for**: Error toast or inline error about circular fallback chain detected. The save should be rejected. Form still shows the claude-opus-4-6 model with the attempted fallback.
