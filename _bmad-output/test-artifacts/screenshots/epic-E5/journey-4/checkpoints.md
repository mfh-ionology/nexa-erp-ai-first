# Visual Checkpoint Manifest — Journey 4: Multi-Turn Conversation Maintains Context

## Journey Summary
After logging in and starting a first conversation (setup from j03), send follow-up messages in the same session and verify the AI maintains context from prior exchanges — demonstrating multi-turn context assembly and conversation history persistence.

---

## Checkpoint 1: First Exchange Complete (Setup)
- **When**: After sending the initial message ("What is the current status of my company?") and receiving AI response — setup prerequisite for the multi-turn test
- **Screenshot file**: `step-setup-first-exchange-complete.png`
- **What to look for**:
  - Two messages visible in conversation: user message on right, AI response on left
  - AI response is complete (no typing indicator)
  - Chat input is empty and ready for next message
  - Co-Pilot drawer is open with proper layout

## Checkpoint 2: Follow-Up Response Shows Context Retention (4 messages)
- **When**: After sending "Can you give me more details about overdue items?" and AI responds (Step 3)
- **Screenshot file**: `step-3-four-messages-context-retained.png`
- **What to look for**:
  - Conversation thread shows 4 messages: user 1, AI 1, user 2, AI 2
  - Messages in chronological order with proper styling (user = right, AI = left)
  - Second AI response references or builds upon the first exchange (context retention)
  - No typing indicator visible (streaming complete)
  - Chat input cleared and ready for next message

## Checkpoint 3: Third Exchange Shows Full Conversation Awareness (6 messages)
- **When**: After sending "Which customer owes the most?" and AI responds (Step 5)
- **Screenshot file**: `step-5-six-messages-full-context.png`
- **What to look for**:
  - Conversation thread now has 6 messages total
  - AI's third response demonstrates full conversation awareness
  - References to "overdue items" from message 2 and "company status" from message 1
  - Customer-specific information about outstanding amounts
  - Conversation area scrolled to show most recent messages
  - Proper alternating user/AI message styling maintained throughout
