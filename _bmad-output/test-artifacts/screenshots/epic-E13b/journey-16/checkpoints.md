# Journey 16: Vendor AI Provider Key Management — Visual Checkpoints

## Checkpoint 1: Providers Tab Loaded
- **When**: After clicking the "Providers" tab on the AI Usage page (Step 2)
- **Screenshot file**: 01-providers-tab-loaded.png
- **What to look for**: Provider list with rows for Anthropic, OpenAI, Google. Each row shows: provider name, active/inactive status badge (green dot for active, grey for inactive), masked API key (****), last used date. "Update Key" buttons and active/inactive toggle switches visible for each provider.

## Checkpoint 2: Update Key Modal Open
- **When**: After clicking "Update Key" button for Anthropic provider (Step 3)
- **Screenshot file**: 02-update-key-modal-open.png
- **What to look for**: AlertDialog modal visible with title "Update API Key — Anthropic". API Key password input field visible with "sk-..." placeholder. "Update Key" (confirm) and "Cancel" buttons visible. Background content dimmed behind modal overlay.

## Checkpoint 3: Key Updated Success
- **When**: After filling API key and clicking "Update Key" confirm button (Step 5)
- **Screenshot file**: 03-key-updated-success.png
- **What to look for**: Modal closed. Provider list refreshes. Success toast visible (if implemented). Anthropic row should still show masked API key (****) indicating key is present.

## Checkpoint 4: Provider Toggle State Changed
- **When**: After toggling active/inactive switch for a provider (Step 6)
- **Screenshot file**: 04-provider-toggled.png
- **What to look for**: The toggled provider's status badge should reflect the new state (Active→Inactive or Inactive→Active). The switch control should be in the new position. Badge colour should change (green→grey or grey→green).
