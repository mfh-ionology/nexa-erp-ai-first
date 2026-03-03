# Journey 7: Agent Configuration CRUD Lifecycle — Visual Checkpoints

## Checkpoint 1: Agent List Page Loaded
- **When**: After navigating to /ai/admin/agents (Step 1)
- **Screenshot file**: step-1-agent-list-loaded.png
- **What to look for**: T1 Entity List with 'Agent Configuration' heading. Table with columns: Name (mono, bold), Display Name, Model, Prompt (mono), Tools (mono), Routing Tags (purple badges), Max Turns (mono), Status (active/inactive dot). At least 10 seeded agents visible. Search bar and "New" button in action bar. Purple-themed Concept D styling.

## Checkpoint 2: Agent Form with Tabs Visible
- **When**: After clicking "Add Agent" and verifying tabs (Steps 2-3)
- **Screenshot file**: step-3-agent-form-tabs.png
- **What to look for**: Agent form page at /ai/admin/agents/new. Tab navigation with 4 tabs: Main, Tools, Guardrails, Triggers. Main tab active showing fields: Name (mono input), Display Name, Description (textarea), Model dropdown, Prompt dropdown, Routing Tags (chip buttons), Max Turns (number input), Active toggle. Breadcrumbs: "AI Administration > Agent Registry > New Agent".

## Checkpoint 3: Main Tab Form Filled
- **When**: After filling all Main tab fields (Step 4)
- **Screenshot file**: step-4-main-tab-filled.png
- **What to look for**: Name field contains "test-e2e-agent" in mono font. Display Name "E2E Test Agent". Description filled. Model dropdown shows selected model. Prompt dropdown shows selected prompt. "standard" routing tag shown as purple badge. Max Turns shows "15". Active toggle is on.

## Checkpoint 4: Guardrails Tab Visible
- **When**: After clicking Guardrails tab (Step 7)
- **Screenshot file**: step-7-guardrails-tab.png
- **What to look for**: Guardrails tab active. Structured fields visible: Can Read (tag input with blue pills), Can Write (tag input with green pills), Require Approval toggle, Blocked Operations (tag input with red pills), Data Scope dropdown.

## Checkpoint 5: Agent Saved Successfully
- **When**: After clicking Save (Step 9)
- **Screenshot file**: step-9-agent-saved.png
- **What to look for**: No validation errors visible. Page either shows edit view of saved agent or has redirected. If on edit page, breadcrumbs should show "AI Administration > Agent Registry > E2E Test Agent". Active badge visible.

## Checkpoint 6: New Agent in List
- **When**: After navigating back to agent list and verifying new agent (Steps 10-11)
- **Screenshot file**: step-11-agent-in-list.png
- **What to look for**: Agent list page with "test-e2e-agent" visible in the table. The new agent row should show: name "test-e2e-agent" (mono, bold), display name "E2E Test Agent", model column filled, "standard" routing tag as purple badge, "15" in max turns column, Active status dot (green).
