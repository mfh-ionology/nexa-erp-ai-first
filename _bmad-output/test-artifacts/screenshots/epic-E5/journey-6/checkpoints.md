# Visual Checkpoint Manifest — Journey 6: View and Resume Previous Chat Sessions

## Journey Context
This journey tests opening the Recent Chats dropdown, verifying previous conversations are listed (most recent first), selecting a previous conversation to load its messages, and resuming it with full context retention. It requires setup: creating two conversations before the actual test.

---

## Checkpoint 1: Recent Chats Dropdown Open
- **When**: After clicking the Recent Chats dropdown (Step 1), once conversations have been established
- **Screenshot file**: `step-1-recent-chats-dropdown-open.png`
- **What to look for**:
  - Dropdown list is visible and expanded
  - At least 2 conversation entries visible: the current one ('How many employees...') and the previous one ('What is the current status...')
  - Each entry shows an auto-generated title and possibly a timestamp or message count
  - Most recent conversation appears at the top of the list
  - Dropdown styling is consistent (no broken layouts, proper hover states)

## Checkpoint 2: Previous Conversation Loaded
- **When**: After clicking the previous conversation entry (Step 2), loading its full message history
- **Screenshot file**: `step-2-previous-conversation-loaded.png`
- **What to look for**:
  - Conversation area shows the full history from the earlier chat session
  - All 6 messages visible: 3 user messages (right-aligned, purple/blue) and 3 AI responses (left-aligned, grey)
  - Messages are in chronological order
  - Chat selector title reflects the loaded conversation (e.g., 'What is the current status...')
  - Conversation area is scrolled to show messages properly
  - No empty state or loading spinner remaining

## Checkpoint 3: Resumed Conversation with Context-Aware Summary
- **When**: After sending "Summarise what we discussed." and receiving the AI response (Step 4)
- **Screenshot file**: `step-4-resumed-summary-response.png`
- **What to look for**:
  - Conversation now has 8 messages total (4 user + 4 AI)
  - The latest AI response is a summary that references earlier topics: company status, overdue items, top customer
  - This proves full conversation history was loaded and the AI has cross-session context
  - No typing indicator remaining
  - Chat input is ready for the next message
  - Messages maintain proper styling throughout the longer conversation thread
