# Journey 10 — Search and Filter Skills: Visual Checkpoints

## Checkpoint 1: Skills Page Loaded
- **When**: After step 1 — navigate to /ai/skills and wait for data to load
- **Screenshot file**: step-1-skills-page-loaded.png
- **What to look for**: Skills page with Concept D styling (light purple background), search input visible at top, module filter dropdown next to it, at least one module accordion section expanded showing skill cards with trigger phrase badges and status indicators

## Checkpoint 2: Search Results for "invoice"
- **When**: After step 2 — type "invoice" in search input and wait for 300ms debounce
- **Screenshot file**: step-2-search-results-invoice.png
- **What to look for**: Only skills matching "invoice" in name, description, or trigger phrases are visible. Non-matching skills and empty module groups should be hidden. Search input shows "invoice" text. If no skills match "invoice", the empty search state should be visible instead.

## Checkpoint 3: Module Filter Applied
- **When**: After step 3 — select "Views & Navigation" from module dropdown (with search cleared or combined)
- **Screenshot file**: step-3-module-filter-views.png
- **What to look for**: Only skills from the "Views & Navigation" module are displayed. Module dropdown shows the selected module name. Other module accordion sections should not be visible.

## Checkpoint 4: Empty State — No Search Results
- **When**: After step 4 — type "zzzznonexistent" in search input
- **Screenshot file**: step-4-empty-state-no-results.png
- **What to look for**: Empty state container visible with Zap icon, text "No skills match your search", and a "Clear" link/button to reset filters. No skill cards visible. Search input shows "zzzznonexistent".
