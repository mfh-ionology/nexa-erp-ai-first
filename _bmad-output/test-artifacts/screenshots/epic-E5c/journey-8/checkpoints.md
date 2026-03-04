# Journey 8: Create a New AI Agent — Visual Checkpoints

## Checkpoint 1: Agent List Page Loaded
- **When**: After navigating to /ai/admin/agents (Step 1)
- **Screenshot**: `step-1-agent-list-page.png`
- **What to look for**: T1 Entity List layout with seeded agents displayed in table. Columns visible: name (mono font), display name, model, prompt (mono), tool count (mono), routing tags (purple badges), max turns (mono), active status (green/grey dot). At least 10 rows of seeded agent data. "Add Agent" button visible in action bar.

## Checkpoint 2: Agent Form — Create Mode (Main Tab)
- **When**: After clicking "Add Agent" button (Step 3)
- **Screenshot**: `step-3-agent-form-create-mode.png`
- **What to look for**: Agent form page in create mode. Four tabs visible: Main, Tools, Guardrails, Triggers. Main tab active showing fields: name input, display name input, description textarea, model dropdown, prompt dropdown, routing tags (clickable badges), max turns number input, active toggle switch. Cancel and Save buttons in action bar.

## Checkpoint 3: Main Tab Filled
- **When**: After filling all Main tab fields (Step 4)
- **Screenshot**: `step-4-main-tab-filled.png`
- **What to look for**: Name field shows "test-ar-collector", display name "AR Collection Agent", description filled, model dropdown showing selected model, prompt dropdown showing selected prompt, routing tags with "standard" selected, max turns "15", active switch ON.

## Checkpoint 4: Guardrails Tab Configured
- **When**: After filling Guardrails tab fields (Step 6)
- **Screenshot**: `step-6-guardrails-configured.png`
- **What to look for**: Guardrails tab active. canRead showing blue pill tags for "customer" and "customerInvoice". canWrite showing green pill tag for "customerInvoice". requiresApproval switch toggled ON. dataScope dropdown set to "module".

## Checkpoint 5: Agent Created Successfully
- **When**: After clicking Save (Step 9)
- **Screenshot**: `step-9-agent-created-success.png`
- **What to look for**: Success toast notification visible. Page navigated to agent detail/edit page showing saved values. Agent name "test-ar-collector" and display name "AR Collection Agent" visible.
