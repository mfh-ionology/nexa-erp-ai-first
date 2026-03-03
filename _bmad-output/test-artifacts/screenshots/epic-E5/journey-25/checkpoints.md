# Visual Checkpoint Manifest — Journey 25: Cmd+K Keyboard Shortcut Opens Search/AI Input

## Checkpoint 1: After Login — Dashboard Ready, No Input Focused
- **When**: After login completes and dashboard loads (prerequisite, before Cmd+K press)
- **Screenshot file**: `step-0-dashboard-loaded.png`
- **What to look for**: Dashboard page loaded. Header bar visible with unified search/AI input. No input is focused — the search bar is in its default/resting state. The keyboard shortcut hint (Cmd+K or Ctrl+K) may be visible inside or near the search input.

## Checkpoint 2: After Cmd+K — Search Input Focused with Dropdown
- **When**: After step 2 — pressing Cmd+K (Meta+K) keyboard shortcut
- **Screenshot file**: `step-2-cmdk-search-focused.png`
- **What to look for**: Header unified search/AI input is focused with a visible cursor. The input field may be highlighted, expanded, or have an active border state. An autocomplete/command palette dropdown may have appeared below the input showing categories: entity results, page navigation, and suggested AI prompts. This confirms the keyboard shortcut successfully activated the search/AI command palette.

## Checkpoint 3: After Typing — Autocomplete Dropdown Shows Results
- **When**: After step 3 — typing "Invoice Acme" into the focused search input
- **Screenshot file**: `step-3-autocomplete-results.png`
- **What to look for**: Autocomplete dropdown visible below the search input, updated with results matching "Invoice Acme". Results should be categorised: entity matches (any invoices containing "Acme"), page navigation entries (Invoice List page), and AI prompt suggestions at the bottom (e.g., "Invoice Acme Corp" as an AI action). The dropdown clearly categorises and ranks results.
