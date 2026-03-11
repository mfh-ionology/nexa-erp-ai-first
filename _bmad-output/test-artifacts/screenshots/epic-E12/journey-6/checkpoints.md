# Visual Checkpoint Manifest — Journey 6: Search Templates by Name

## CP-1: Full Template List Loaded
- **When**: After step 1 — navigated to /settings/document-templates
- **Screenshot file**: step-1-full-template-list.png
- **What to look for**: Document Templates page loaded with filter bar (search input, document type dropdown, Show Inactive button). Multiple accordion sections visible with template cards grouped by document type. "Add Template" button visible.

## CP-2: Search Results for "E2E"
- **When**: After step 2 — typed "E2E" in search input
- **Screenshot file**: step-2-search-e2e-results.png
- **What to look for**: Search input shows "E2E" text. Only templates matching "E2E" in name are visible. Expected: "E2E Test Invoice Template" (Sales Invoice group) and "E2E Credit Note Compact" (Credit Note group). All other seeded "Standard ..." templates hidden. Accordion sections only for matching document types.

## CP-3: Search Results for "standard" (Case-Insensitive)
- **When**: After step 3 — changed search to "standard"
- **Screenshot file**: step-3-search-standard-results.png
- **What to look for**: Search input shows "standard" text. Multiple seeded templates visible with names starting with "Standard". E2E custom templates hidden. Multiple document type groups visible since Standard templates exist for several types.

## CP-4: Search Cleared — Full List Restored
- **When**: After step 4 — cleared the search input
- **Screenshot file**: step-4-search-cleared-full-list.png
- **What to look for**: Search input is empty. Full template list restored showing all templates — both E2E custom and Standard seeded templates visible again. Same number of accordion groups as CP-1.
