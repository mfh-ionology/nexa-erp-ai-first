# Visual Checkpoints — Journey 16: Entity Selection & Chip Insertion

## Checkpoint 1: Co-Pilot Drawer Open
- **When**: After step 1 — clicking Co-Pilot toggle button
- **Screenshot file**: `step-1-copilot-drawer-open.png`
- **What to look for**: Co-Pilot drawer visible on right side with chat area, input with "Ask Nexa anything..." placeholder, purple send button (disabled since input is empty). Drawer has complementary role with "AI Co-Pilot assistant" label.

## Checkpoint 2: Autocomplete Dropdown Appears
- **When**: After step 2 — typing "open view us" in the chat input
- **Screenshot file**: `step-2-autocomplete-dropdown-visible.png`
- **What to look for**: Autocomplete dropdown positioned above the input area showing matching entity results. Each result should have a purple circle icon, entity display name, and optional subtitle. Footer shows keyboard navigation hint "Use arrow keys to navigate, Enter to select, Esc to dismiss". Dropdown has 12px border-radius, card-style background with border and shadow.

## Checkpoint 3: Entity Chip Inserted
- **When**: After step 3 — clicking first autocomplete result
- **Screenshot file**: `step-3-entity-chip-inserted.png`
- **What to look for**: Entity chip visible in the input area as a purple pill (bg-[#ede9fe] text-[#6d28d9]) with an icon, entity name text, and X close button. Autocomplete dropdown is dismissed. Textarea placeholder changes to "Continue typing..." and textarea is refocused. The trigger text "open view us" should be replaced by the chip.

## Checkpoint 4: Chip Plus Text Together
- **When**: After step 4 — typing additional text " please show me this view" after the chip
- **Screenshot file**: `step-4-chip-plus-text.png`
- **What to look for**: Entity chip still visible in the input area followed by the typed text. Send button should now be enabled (purple, not greyed out) since there is content to send.

## Checkpoint 5: Chip Removed
- **When**: After step 5 — clicking X close button on entity chip
- **Screenshot file**: `step-5-chip-removed.png`
- **What to look for**: Entity chip is no longer visible in the input area. The typed text " please show me this view" should remain in the textarea. Placeholder should revert to "Ask Nexa anything..." if textarea is empty, or show the remaining text.
