# Visual Checkpoint Manifest — Journey 5: Create New Chat Session

Journey `j05-new-chat-session` tests creating a fresh chat session after an existing conversation, verifying the conversation area clears and the AI starts fresh without prior context.

## Prerequisites

This journey requires an existing conversation in the Co-Pilot drawer (established during setup). The test logs in, opens the drawer, sends a message, waits for a reply, and then begins the actual j05 steps.

---

## Checkpoint 1: Setup Complete — Existing Conversation Established

- **When**: After setup — first message sent and AI response received (before j05 steps begin)
- **Screenshot file**: `step-setup-existing-conversation.png`
- **What to look for**:
  - Co-Pilot drawer is open on the right side
  - At least 1 user message and 1 AI response are visible in the conversation area
  - Chat input field is cleared and ready for the next message
  - This establishes the baseline: a conversation exists before we click '+ New Chat'

## Checkpoint 2: New Chat Session — Empty Conversation Area

- **When**: After Step 1 — clicking the '+ New Chat' button
- **Screenshot file**: `step-1-new-chat-empty-conversation.png`
- **What to look for**:
  - Conversation area is cleared — no messages from the previous conversation visible
  - Empty state or welcome message displayed (e.g., "How can I help you?")
  - Chat selector shows this is a new, untitled conversation (not the previous title)
  - The previous conversation should be accessible via Recent Chats dropdown (not deleted)
  - Input field placeholder reads 'Ask Nexa anything...' and is ready for typing
  - Quick prompt chips may be visible

## Checkpoint 3: Fresh AI Response — No Prior Context

- **When**: After Step 3 — sending "How many employees do we have?" and receiving the AI response
- **Screenshot file**: `step-3-fresh-response-no-prior-context.png`
- **What to look for**:
  - New conversation with exactly 2 messages: user question and AI response
  - User message on the right: "How many employees do we have?"
  - AI response on the left with grey/light background
  - AI response does NOT reference "overdue items", "company status", or anything from the previous conversation — it has started fresh
  - Chat selector title auto-generated from "How many employees..." or similar
  - No typing indicator visible (response complete)
