# Visual Checkpoint Manifest — Journey 23
## RBAC — Viewer Cannot Access Chat or Predictions

### Checkpoint 1: Dashboard with Daily Briefing visible for VIEWER
- **When**: After Step 3 — login as VIEWER, redirected to dashboard
- **Screenshot file**: `step-4-viewer-dashboard-briefing-visible.png`
- **What to look for**: Dashboard loaded. Daily Briefing section is visible and populated with content — this confirms VIEWER has permission for ai.briefing (VIEWER minimum). Greeting visible. Briefing items displayed.

### Checkpoint 2: Chat toggle restricted for VIEWER
- **When**: After Step 5 — clicking Chat toggle button as VIEWER
- **Screenshot file**: `step-5-chat-restricted-for-viewer.png`
- **What to look for**: Either: (a) Chat toggle button is disabled or hidden entirely, (b) Co-Pilot drawer opens but shows a permission error like "You do not have permission to use the AI assistant", or (c) Chat input is disabled. The key assertion: VIEWER cannot use ai.chat (STAFF minimum required). No functional chat input should be available.

### Checkpoint 3: Predictions page permission denied for VIEWER
- **When**: After Step 6 — navigating to /ai/predictions/cash-flow as VIEWER
- **Screenshot file**: `step-6-predictions-permission-denied.png`
- **What to look for**: Either: (a) redirected to a 403/permission denied page, (b) page loads but shows "You do not have permission to access AI predictions" error, or (c) the prediction form/content is completely absent. VIEWER lacks ai.predictions (MANAGER minimum). No crash or blank screen — graceful denial.
