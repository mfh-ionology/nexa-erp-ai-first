# Journey 3: Edit Model — Default Toggle and Business Rules — Visual Checkpoints

## Checkpoint 1: Model Edit Form Loaded
- **When**: After clicking 'test-gpt-4o' row in model list (step 2)
- **Screenshot file**: `step-2-model-edit-form.png`
- **What to look for**: Model form showing 'GPT-4o Test Model' heading, Primary tab active, all fields pre-populated with saved values (name: test-gpt-4o, provider: openai, modelId: gpt-4o-2024-08-06), Active toggle ON, Default toggle OFF

## Checkpoint 2: Default Toggle Set — Success Toast
- **When**: After saving with isDefault toggled ON (step 4)
- **Screenshot file**: `step-4-default-set-success.png`
- **What to look for**: Green success toast 'Model updated successfully' visible, model now shows purple 'Default' badge in the header area

## Checkpoint 3: Model List — Only One Default Badge
- **When**: After navigating back to model list (step 5)
- **Screenshot file**: `step-5-model-list-single-default.png`
- **What to look for**: Model list with exactly ONE purple 'Default' badge on the 'test-gpt-4o' row. Previously default model should NOT have the badge anymore.

## Checkpoint 4: Deactivate Default Model — Error Toast
- **When**: After attempting to save with isActive toggled OFF on the default model (step 8)
- **Screenshot file**: `step-8-deactivate-default-error.png`
- **What to look for**: Red error toast with message about not being able to deactivate the default model ('Cannot deactivate the default model' or similar 422 error message). The model should remain active.
