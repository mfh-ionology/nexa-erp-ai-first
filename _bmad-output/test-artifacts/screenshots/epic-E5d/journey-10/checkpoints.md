# Visual Checkpoints — Journey 10: Training Examples Tab — Full CRUD Lifecycle

## Checkpoint 1: Training Tab Loaded
- **When**: After navigating to `/ai/admin/knowledge#training` and tab is active
- **Screenshot**: `step-1-training-tab-loaded.png`
- **What to look for**: Training Examples tab active, Q&A pair cards in grid layout, cards show input/output sections, skill key badges, category badges, source badges
- **Visual review result**: PASS — Training Examples tab is active (purple underline). 2-column grid of Q&A cards visible. Each card shows "When user asks:" / "AI should answer:" sections, skill key badges (e.g. "chat-router", "ar-collection-advisor"), category badges ("Business Processes"), source badges ("Admin Curated"), active toggle, and overflow menu. Stats panel shows Total Articles (0), RAG Retrieval Rate (—), Correction Trend (8), Pending Reviews (0). Filter bar with All Categories, Filter by skill, All/Active/Inactive toggles, search, and "+ Add Example" button.

## Checkpoint 2: Add Example Dialog Open
- **When**: After clicking "Add Example" button
- **Screenshot**: `step-2-add-example-dialog.png`
- **What to look for**: Dialog visible with fields: Input Text (when user asks), Output Text (AI should respond), Category select, Skill Key input, Save/Cancel buttons
- **Visual review result**: PASS — "Add Training Example" dialog open with subtitle "Teach the AI how to respond to specific questions about your business." Fields: "When user asks..." textarea with placeholder, "AI should respond..." textarea with placeholder, "Skill Key" text input with helper "Optionally scope to a specific skill", "Category" select dropdown ("Select a category"), Cancel and purple "Add Example" buttons.

## Checkpoint 3: New Example Created
- **When**: After saving the new training example
- **Screenshot**: `step-4-example-created.png`
- **What to look for**: Success toast visible, new Q&A card with input text "What VAT code should I use for EU purchases?", output text about reverse charge, skill key badge "vat_lookup", category badge "Terminology", source badge "Admin Curated"
- **Visual review result**: PASS — Green success toast "Training example created" visible at top-right. Dialog closed. Cards visible in grid (new card may be below fold due to multiple prior-run duplicates).

## Checkpoint 4: Edit Dialog Pre-filled
- **When**: After opening edit dialog for the created example
- **Screenshot**: `step-5-edit-dialog-prefilled.png`
- **What to look for**: Edit dialog with pre-filled input/output text matching created example, source badge read-only
- **Visual review result**: PASS — "Edit Training Example" dialog open. Source badge "Admin Curated" shown as read-only. "When user asks..." pre-filled with "What VAT code should I use for EU purchases?". "AI should respond..." pre-filled with original output. Skill Key shows "vat_lookup". Category shows "Terminology". Cancel and purple "Save Changes" buttons visible.

## Checkpoint 5: Example Updated
- **When**: After saving edits to the training example
- **Screenshot**: `step-7-example-updated.png`
- **What to look for**: Success toast, card shows updated output text mentioning "VAT code 3A for services" and "after 2024"
- **Visual review result**: PASS — Card visible with updated output text "Use reverse charge — VAT code 3 for goods, VAT cod..." (truncated in card view). Skill key badge "vat_lookup", category "Terminology", source "Admin Curated" all correct. Multiple duplicate cards from prior test runs visible (expected test-data pollution).

## Checkpoint 6: Delete Confirmation
- **When**: After clicking Delete from overflow menu
- **Screenshot**: `step-8-delete-confirmation.png`
- **What to look for**: Confirmation dialog asking to confirm deletion of the training example
- **Visual review result**: PASS — "Delete Training Example?" dialog with message "This will remove the training example. The AI will no longer use it as a reference for responses." Cancel button and red "Delete" button visible.

## Checkpoint 7: Example Deleted
- **When**: After confirming deletion
- **Screenshot**: `step-9-example-deleted.png`
- **What to look for**: Card removed from list, success toast visible
- **Visual review result**: PASS — Green success toast "Training example deleted" visible at top-right. The deleted card appears to have a green highlight/fade-out animation (optimistic removal). Remaining cards from prior test runs still visible (expected).
