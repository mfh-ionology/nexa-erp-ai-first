# Visual Checkpoint Manifest — Journey 7: Use Header Search Bar for AI Command

## Checkpoint 1: After Login — Dashboard Ready
- **When**: After login completes and dashboard loads (prerequisite)
- **Screenshot file**: `step-0-dashboard-loaded.png`
- **What to look for**: Dashboard page loaded with header bar visible. Unified search/AI input visible in header. Co-Pilot drawer is NOT open. Chat toggle button visible.

## Checkpoint 2: After Ensuring Drawer Closed
- **When**: After step 1 — ensuring Co-Pilot drawer is closed
- **Screenshot file**: `step-1-drawer-confirmed-closed.png`
- **What to look for**: Co-Pilot drawer is definitely not visible. Header search/AI input is accessible. Main content area is at full width.

## Checkpoint 3: After AI Command Submitted via Header Search
- **When**: After step 3 — typing "Show me this month's revenue" in the header search bar and pressing Enter
- **Screenshot file**: `step-3-copilot-opened-with-ai-response.png`
- **What to look for**: Co-Pilot drawer has opened from the right side. The conversation area shows the user message "Show me this month's revenue". The AI is either streaming a response or has completed a response about revenue data. This is the KEY visual verification — the unified search input successfully routed the AI command to the Co-Pilot. The header search input may have cleared after submission.

## Checkpoint 4: AI Response Complete
- **When**: After waiting for the AI response to finish streaming
- **Screenshot file**: `step-3-ai-response-complete.png`
- **What to look for**: Complete conversation in Co-Pilot drawer — user message on the right, AI response on the left. The AI response contains revenue-related content. No typing indicator visible (streaming complete). The drawer is fully rendered with no loading states.
