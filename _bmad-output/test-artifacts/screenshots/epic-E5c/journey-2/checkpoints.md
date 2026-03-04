# Visual Checkpoint Manifest — Journey 2: Create a New AI Model

## Checkpoint 1: Model Registry List Page
- **When**: After navigating to /ai/admin/models (Step 1)
- **Screenshot file**: step-1-model-registry-list.png
- **What to look for**: T1 Entity List page showing at least 3 seeded models (claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5). Columns visible: Name (mono font), Provider (badge), Model ID, Max Tokens, Cost/M, Routing Tags (purple badges), Status (green dot), Default flag. Concept D purple theme with #f4f2ff background. "New" button visible in action bar.

## Checkpoint 2: Model Creation Form (Primary Tab)
- **When**: After clicking "New" button and form loads (Step 3)
- **Screenshot file**: step-3-new-model-form.png
- **What to look for**: "New Model" heading, breadcrumbs showing "AI Administration > Model Registry > New Model". Primary tab active by default. Form fields visible: Name, Display Name, Provider, Model ID, Max Input Tokens, Max Output Tokens, Cost per Million Input/Output. Save and Cancel buttons in action bar.

## Checkpoint 3: Advanced Tab with Routing Tags
- **When**: After filling Advanced tab fields (Step 6)
- **Screenshot file**: step-6-advanced-tab-filled.png
- **What to look for**: Advanced tab active. "standard" and "vision" routing tags shown as purple pill badges with X remove buttons. Capabilities JSON textarea with mono font showing {"vision": true, "structured_output": true}. Fallback Model dropdown showing a selected fallback. Config textarea visible.

## Checkpoint 4: Model Created Successfully
- **When**: After clicking Save (Step 7)
- **Screenshot file**: step-7-model-created-toast.png
- **What to look for**: Success toast with text "Model created successfully" visible. Page may show model detail or redirect to list. All saved values should be reflected.

## Checkpoint 5: Updated Model List
- **When**: After navigating back to /ai/admin/models (Step 8)
- **Screenshot file**: step-8-model-list-with-new.png
- **What to look for**: Model list now shows 4+ models. New "test-gpt-4o" row visible with "openai" provider badge, "standard" and "vision" routing tag purple badges, Active status (green dot). The 3 original seeded models still present.
