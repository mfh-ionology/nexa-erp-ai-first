# Visual Checkpoint Manifest — Journey 15: Entity Mention Trigger Word Detection in Chat

## Checkpoint 1: Co-Pilot Drawer Opened
- **When**: After step 2 — clicking the Co-Pilot toggle button in the header
- **Screenshot file**: `step-2-copilot-drawer-opened.png`
- **What to look for**:
  - Co-Pilot drawer visible on the right side of the screen (desktop: ~380px width)
  - Drawer header showing "Co-Pilot" title with close button
  - Chat message area visible (either empty state "Ask Nexa anything..." or prior messages)
  - Input area at bottom with textarea and send button
  - Quick prompts bar visible if no messages
  - Purple accent styling consistent with Concept D

## Checkpoint 2: Autocomplete Dropdown Triggered
- **When**: After step 3 — typing "open saved view ov" in the chat input
- **Screenshot file**: `step-3-autocomplete-dropdown-visible.png`
- **What to look for**:
  - Autocomplete dropdown positioned above the input area
  - Dropdown has 12px border-radius, border, card background, shadow (Concept D styling)
  - Header showing entity type (e.g. "Saved Views") with result count
  - At least one matching result row with: purple circle icon (Bookmark), display name, subtitle
  - First/highlighted result has purple highlight background (#f5f3ff)
  - Footer hint text: "Use arrow keys to navigate, Enter to select, Esc to dismiss"
  - The typed text "open saved view ov" visible in the textarea behind/below the dropdown

## Checkpoint 3: No Autocomplete for Non-Trigger Text
- **When**: After step 5 — typing "hello world" (no trigger word)
- **Screenshot file**: `step-5-no-autocomplete-for-plain-text.png`
- **What to look for**:
  - Chat input shows "hello world" text
  - NO autocomplete dropdown visible anywhere
  - Input area in normal state (no overlay, no dropdown)
  - Send button should be enabled (there is text in the input)
