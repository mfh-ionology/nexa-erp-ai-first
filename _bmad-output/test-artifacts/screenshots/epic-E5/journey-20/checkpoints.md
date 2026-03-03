# Visual Checkpoints — Journey 20: AI Service Degradation — Graceful Error Handling

## Checkpoint 1: Dashboard loads with AI degraded
- **When**: After Step 1 — navigate to "/" with AI Gateway unreachable
- **Screenshot file**: step-1-dashboard-ai-degraded.png
- **What to look for**:
  - Dashboard page loaded successfully — sidebar, navigation, top header all present
  - Traditional UI elements are fully functional (not broken by AI unavailability)
  - Daily Briefing section may show a graceful error state: "AI service temporarily unavailable" or empty with a "Retry" button
  - No crash, no blank screen, no unhandled JS error overlays
  - Page layout intact — no broken layout from missing AI components

## Checkpoint 2: Graceful error when sending chat message with AI down
- **When**: After Step 4 — send a chat message while AI Gateway is unreachable
- **Screenshot file**: step-4-chat-error-graceful.png
- **What to look for**:
  - User message "Hello, can you help me?" visible on the right side of conversation
  - Instead of an AI response, a user-friendly error message card is shown on the left
  - Error message should say something like "AI service is temporarily unavailable" — no stack traces, no technical jargon
  - Error has an appropriate icon (warning/info)
  - No crash, no blank screen, no unhandled errors
  - Chat input remains usable (not broken/frozen)

## Checkpoint 3: Traditional invoice list page fully functional despite AI being down
- **When**: After Step 5 — navigate to "/ar/invoices" with AI still degraded
- **Screenshot file**: step-5-invoices-page-functional.png
- **What to look for**:
  - Invoice list page loaded successfully with data table, headers, filters, pagination
  - Traditional UI elements all work — data loads, columns visible, action buttons present
  - Page is fully functional despite AI service being unavailable
  - Confirms IMP-006: AI degradation does not break traditional UI
  - No error banners blocking the page content (AI-related warnings are OK if subtle)
