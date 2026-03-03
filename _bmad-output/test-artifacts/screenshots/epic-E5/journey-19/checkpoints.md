# Journey 19 — HTTP Fallback When WebSocket Unavailable

## Visual Checkpoints

### Checkpoint 1: HTTP Fallback Response Received (Step 4)
- **When**: After clicking Send button with WebSocket blocked — AI response arrives via HTTP POST
- **Screenshot file**: step-4-http-fallback-response.png
- **What to look for**:
  - User message "What is my cash position today?" visible on the right side of the conversation
  - AI response visible on the left side — appeared all at once (not streamed token-by-token)
  - The response contains cash position information or a meaningful answer
  - No visible error messages or broken UI state
  - Optionally, a subtle connection-mode indicator showing "HTTP mode" or a fallback badge
  - Chat input field is cleared and ready for the next message
  - No WebSocket error banners blocking the conversation
  - The overall Co-Pilot drawer layout is intact — header, conversation area, input area all functional
