# Visual Checkpoint Manifest — Journey 21

**Journey**: j21-prediction-degradation-503 — Prediction Endpoints Return 503 When AI Degraded
**Description**: When AI service is unavailable, verify prediction pages (cash flow, anomaly, duplicate) show appropriate 503 error states with user-friendly messages and no crash.

---

## Checkpoint 1: Cash Flow Forecast 503 Error State

- **When**: After step 3 — clicking "Generate Forecast" when AI Gateway is unreachable
- **Screenshot file**: `step-3-cashflow-503-error.png`
- **What to look for**:
  - Cash flow forecast page is still rendered (no crash/blank screen)
  - Instead of forecast results, a user-friendly error message is displayed
  - Error message contains text like "AI prediction service is temporarily unavailable" or "forecast engine is currently offline"
  - No stack traces, no technical error codes, no raw 503 response shown to user
  - A "Retry" button may be present
  - The page layout is intact — form fields are still visible above the error
  - No Vite error overlay or crash overlay

## Checkpoint 2: Anomaly Detection 503 Error State

- **When**: After step 5 — clicking "Run Scan" when AI Gateway is unreachable
- **Screenshot file**: `step-5-anomaly-503-error.png`
- **What to look for**:
  - Anomaly detection page is still rendered (no crash/blank screen)
  - Graceful error message displayed, same pattern as cash flow page
  - Error text like "AI prediction service is temporarily unavailable"
  - No technical jargon or stack traces
  - Page remains navigable — sidebar/header still functional
  - Consistent error handling pattern across both prediction pages
