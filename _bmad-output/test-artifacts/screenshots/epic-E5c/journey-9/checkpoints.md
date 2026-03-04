# Journey 9: Agent List Search and Edit — Visual Checkpoints

## Checkpoint 1: Agent List Page Loaded
- **When**: After navigating to /ai/admin/agents
- **Screenshot**: `step-1-agent-list-page.png`
- **What to look for**: Agent list table visible with columns (Name, Display Name, Model, Prompt, Tools, Routing Tags, Max Turns, Status). Search input visible at top. "New" button visible. Seeded agents listed in table rows.

## Checkpoint 2: Search Results Filtered
- **When**: After typing "ar-collector" in search input and waiting for debounce
- **Screenshot**: `step-2-search-results-filtered.png`
- **What to look for**: Table filtered to show only agents matching "ar-collector". The test agent row visible with correct display name, model info, and tool count. Other non-matching agents should be hidden.

## Checkpoint 3: Agent Edit Form Loaded
- **When**: After clicking the agent row to open edit form
- **Screenshot**: `step-3-agent-edit-form.png`
- **What to look for**: Agent edit form with tabs (Main, Tools, Guardrails, Triggers). Page header shows agent display name. Form fields pre-populated with the agent's current data. Save and Delete buttons visible in action bar.

## Checkpoint 4: Display Name Updated and Saved
- **When**: After changing display name and clicking Save
- **Screenshot**: `step-4-agent-updated-success.png`
- **What to look for**: Success toast "Agent updated successfully" visible. Page heading updated to show new display name "AR Collection Specialist Agent". Form reflects the updated value.
