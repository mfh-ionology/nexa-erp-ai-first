# Visual Checkpoint Manifest — Journey #17

**Journey**: j17-entity-mention-send-display — Send Message with Entity Mentions & Display in Chat
**Epic**: E5b — AI Co-Pilot Intelligence
**Related Stories**: E5b-7

---

## Checkpoint 1: Co-Pilot Drawer Open
- **When**: After step 1 — clicking Co-Pilot toggle button
- **Screenshot file**: `step-1-copilot-drawer-open.png`
- **What to look for**:
  - Co-Pilot drawer visible on the right side of the screen
  - Drawer has header with "Co-Pilot" title and close button
  - Chat area visible with message history or empty state
  - EntityMentionInput visible at the bottom with textarea and send button
  - Quick prompts row visible above the input

## Checkpoint 2: Autocomplete Dropdown Appears
- **When**: After step 2 — typing "open view us" triggers autocomplete
- **Screenshot file**: `step-2-autocomplete-dropdown.png`
- **What to look for**:
  - Autocomplete dropdown visible above the chat input
  - Dropdown has rounded-xl border, white/card background, shadow
  - Header showing entity type label and result count
  - At least one result item with purple circle icon, display name, subtitle
  - Footer hint text: "Use arrow keys to navigate, Enter to select, Esc to dismiss"
  - First item should be highlighted with light purple (#f5f3ff) background

## Checkpoint 3: Entity Chip Inserted
- **When**: After step 3 — clicking first autocomplete result inserts chip
- **Screenshot file**: `step-3-entity-chip-inserted.png`
- **What to look for**:
  - Entity chip visible in the input area (purple pill: bg-[#ede9fe] text-[#6d28d9])
  - Chip shows entity icon + entity name + X remove button
  - Autocomplete dropdown dismissed
  - Textarea refocused and ready for more typing
  - Placeholder changes to "Continue typing..."

## Checkpoint 4: Message Sent with Entity Chips
- **When**: After step 5 — clicking Send button sends message with entity mention
- **Screenshot file**: `step-5-message-sent-with-chips.png`
- **What to look for**:
  - User message bubble appears in chat (purple/primary background, right-aligned)
  - Entity chip rendered in user message using user-message variant (bg-white/20 text-white)
  - Message text "show me all records" visible after the chip
  - Input area cleared (no chips, no text) ready for next message
  - User avatar initials visible

## Checkpoint 5: Streaming Indicator
- **When**: After step 6 — while waiting for AI response
- **Screenshot file**: `step-6-streaming-indicator.png`
- **What to look for**:
  - Assistant message area with pulsing dots animation (streaming indicator)
  - AI avatar (Sparkles icon, muted background) visible on the left
  - Streaming indicator dots visible in the assistant bubble

## Checkpoint 6: Assistant Response Displayed
- **When**: After step 7 — assistant response appears in chat
- **Screenshot file**: `step-7-assistant-response.png`
- **What to look for**:
  - Assistant message bubble (light/muted background, left-aligned)
  - Response text visible addressing the user's request about the mentioned entity
  - If entity mentions present in response, they render as assistant-message variant chips (bg-[#ede9fe] text-[#6d28d9])
  - Timestamp visible below the message
  - Streaming indicator gone — replaced by actual response text
