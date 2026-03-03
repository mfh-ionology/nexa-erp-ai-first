# Journey 8 — Skill Pack Manager: Grouped View & Activation Toggle

## Visual Checkpoints

### Checkpoint 1: Skill Pack Manager Initial Load
- **When**: After navigating to `/ai/admin/skills`
- **Screenshot file**: `step-1-skill-pack-manager-loaded.png`
- **What to look for**:
  - Page title "Skill Pack Manager" with breadcrumbs (AI Administration > Skill Packs)
  - Skills grouped by moduleKey in accordion sections
  - First module(s) expanded showing skill cards
  - Each skill card shows: name (monospace), displayName, description, trigger pills (blue), negative trigger pills (red), orchestration pattern badge (purple), priority (mono), active toggle switch
  - Search bar visible at top
  - "Test Trigger" and "Add Skill" buttons in action bar
  - Concept D purple styling with #f4f2ff background

### Checkpoint 2: Second Module Accordion Expanded
- **When**: After clicking second module accordion header (step 3)
- **Screenshot file**: `step-3-second-module-expanded.png`
- **What to look for**:
  - Second module section now expanded showing its skill cards
  - Module heading badge visible with module key text
  - Skill cards inside the newly expanded section

### Checkpoint 3: Skill Deactivation Toast
- **When**: After clicking active toggle to deactivate a skill (step 4)
- **Screenshot file**: `step-4-skill-deactivated-toast.png`
- **What to look for**:
  - Toast notification visible confirming skill deactivation (e.g., "Skill {name} deactivated")
  - Toggle switch in OFF position on the targeted skill card
  - Rest of the UI unchanged

### Checkpoint 4: Search Filter Results
- **When**: After typing "overdue" in search and results are filtered (step 7)
- **Screenshot file**: `step-7-search-filtered-overdue.png`
- **What to look for**:
  - Search input shows "overdue" text
  - Only skills containing "overdue" in name or description are displayed
  - Non-matching module groups hidden or empty
  - Filtered view is clearly a subset of the original skill list
