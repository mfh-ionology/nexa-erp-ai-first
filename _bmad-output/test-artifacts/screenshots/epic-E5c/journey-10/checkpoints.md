# Journey 10: Skill Pack Manager — View, Search, and Toggle

## Visual Checkpoints

### Checkpoint 1 — Skill Pack Manager Page Loaded
- **When:** After navigating to /ai/admin/skills (Step 1)
- **Screenshot:** `step-1-skill-pack-manager-loaded.png`
- **What to look for:** Page title "Skill Pack Manager" visible. Skills grouped in accordion sections by moduleKey (e.g., "AR", "FINANCE", "SALES"). Each module section has a purple badge with module name and skill count. First 3 accordion sections expanded by default. Skill cards visible within expanded sections showing: name (mono bold), display name, description, trigger phrases (blue pills), negative triggers (red pills), orchestration pattern badge, priority (mono), active toggle switch. Action bar with view mode toggle, Test Trigger button, Add Skill button. Search input visible.

### Checkpoint 2 — Search Results for "overdue"
- **When:** After typing "overdue" in search bar (Step 3)
- **Screenshot:** `step-3-search-filtered-overdue.png`
- **What to look for:** Search input shows "overdue" text. Skills filtered to show only those matching "overdue" in name, displayName, or description. Module groups that have no matching skills should be hidden or empty. Matching skill cards still display full card layout.

### Checkpoint 3 — Skill Deactivated with Toast
- **When:** After toggling an active skill's switch off (Step 5)
- **Screenshot:** `step-5-skill-deactivated-toast.png`
- **What to look for:** Toggle switch visually in "off" position for the toggled skill. Toast notification visible with text like "Skill {name} deactivated". Other skill cards unaffected.
