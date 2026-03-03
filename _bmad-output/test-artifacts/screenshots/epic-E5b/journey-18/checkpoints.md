# Visual Checkpoint Manifest — Journey 18: Entity Autocomplete Keyboard Navigation

## Checkpoint 1: Co-Pilot Drawer Opened with Autocomplete Visible
- **When**: After Step 2 — typed "open view us" and autocomplete dropdown appears
- **Screenshot file**: step-2-autocomplete-dropdown-visible.png
- **What to look for**: Autocomplete dropdown positioned above the chat input, showing matching entities for "view" trigger + "us" query. First item highlighted in light purple (#f5f3ff). Footer hint text "Use arrow keys to navigate, Enter to select, Esc to dismiss" visible. Dropdown has 12px border-radius matching Concept D.

## Checkpoint 2: ArrowDown Highlights Second Result
- **When**: After Step 3 — pressed ArrowDown key
- **Screenshot file**: step-3-arrow-down-second-item-highlighted.png
- **What to look for**: Second item in autocomplete dropdown highlighted with light purple background (#f5f3ff). First item is no longer highlighted. Visual indicator clearly shows which item is selected.

## Checkpoint 3: Entity Chip Inserted via Enter Key
- **When**: After Step 5 — pressed Enter to select highlighted entity
- **Screenshot file**: step-5-enter-key-chip-inserted.png
- **What to look for**: Autocomplete dropdown dismissed. Entity chip visible in the chat input area as a purple pill (bg-[#ede9fe] text-[#6d28d9]) with icon, entity name text, and X close button. Textarea refocused for continued typing.

## Checkpoint 4: Autocomplete Dismissed by Escape Key
- **When**: After Step 7 — pressed Escape to dismiss second autocomplete
- **Screenshot file**: step-7-escape-autocomplete-dismissed.png
- **What to look for**: Autocomplete dropdown is gone. The typed text "open saved view ov" remains in the textarea. The entity chip from Step 5 is still present. Input area shows both the chip and the remaining text.

## Checkpoint 5: Last Chip Removed by Backspace
- **When**: After Step 9 — pressed Backspace with empty textarea
- **Screenshot file**: step-9-backspace-chip-removed.png
- **What to look for**: Input area has no entity chips remaining. Textarea is empty. Ready for fresh input. Send button should be disabled (no content).
