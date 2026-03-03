# Visual Checkpoint Manifest — Journey 4: Search and Filter Memories

## Checkpoint 1: Memory page loaded with all memories
- **When**: After Step 1 — navigate to /ai/memory and wait for page load
- **Screenshot file**: `step-1-memory-page-loaded.png`
- **What to look for**: Memory page fully loaded with Concept D styling (light purple #f4f2ff background). Search input visible with "Search memories..." placeholder. Category filter pills visible (Preferences, Instructions, Workflows, Decisions, Entity Context). Memory cards displayed in grouped sections with count badges. No loading skeletons.

## Checkpoint 2: Search results filtered by "invoice"
- **When**: After Step 2 — type "invoice" in search input and wait for deferred filter
- **Screenshot file**: `step-2-search-filtered-invoice.png`
- **What to look for**: Search input shows "invoice" text. Only memory cards whose content contains "invoice" (case-insensitive) are visible. Other cards/sections are hidden. Category section headers may still show but with reduced counts or hidden entirely if no matches in that category.

## Checkpoint 3: Combined search + category filter
- **When**: After Step 3 — click Preferences filter pill while "invoice" search is active
- **Screenshot file**: `step-3-category-plus-search.png`
- **What to look for**: Preferences filter pill is active (purple bg, white text, aria-pressed="true"). Only memories in the Preferences category that also contain "invoice" are shown. Other category sections hidden.

## Checkpoint 4: Category filter only (search cleared)
- **When**: After Step 4 — clear search text, Preferences filter still active
- **Screenshot file**: `step-4-category-filter-only.png`
- **What to look for**: Search input is empty. Preferences filter pill still active (purple). All Preferences memories visible (no longer filtered by "invoice"). Other category sections still hidden.

## Checkpoint 5: Empty state for no-match search
- **When**: After Step 5 — type "zzzznonexistent" in search input
- **Screenshot file**: `step-5-empty-state-no-results.png`
- **What to look for**: Empty state message "No memories match your search" visible in a card/container. A "clear" link/button present below the message. No memory cards visible. Search input shows "zzzznonexistent".
