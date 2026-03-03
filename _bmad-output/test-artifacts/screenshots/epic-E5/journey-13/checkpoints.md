# Visual Checkpoint Manifest — Journey 13: Cash Flow Forecast with Negative Balance Alert

## Checkpoint 1: Cash Flow Page Ready with Extended Forecast Form
- **When**: After login and navigation to /ai/predictions/cash-flow, form filled with extended 10-month range
- **Screenshot file**: step-1-form-filled-extended-range.png
- **What to look for**: Cash flow forecast page loaded. Form fields visible: Start Date set to 2026-03-01, End Date set to 2026-12-31. "Include Committed POs" and "Include Recurring Payments" checkboxes checked. "Generate Forecast" button enabled. This extended range (10 months) increases the likelihood of capturing a period with a projected negative balance.

## Checkpoint 2: Forecast Results with Alerts Section
- **When**: After clicking "Generate Forecast" and results load
- **Screenshot file**: step-2-forecast-results-with-alerts.png
- **What to look for**: Forecast results displayed with period-by-period data for Mar 2026 through Dec 2026. An **Alerts section** should be prominently visible above or alongside the period table. If a NEGATIVE_BALANCE alert exists: red/warning badge showing "NEGATIVE_BALANCE", affected period date range, projected shortfall amount (negative £ value e.g. "-£3,200"), descriptive message, and a suggested action (e.g. "Accelerate collections" or "Defer payments"). The affected period row in the main breakdown table should be highlighted with a warning indicator (red background, warning icon, or border).

## Checkpoint 3: Alert Card Detail Verified
- **When**: After verifying individual alert card elements
- **Screenshot file**: step-3-alert-card-detail.png
- **What to look for**: Close-up verification of alert card(s). Each alert shows: type badge (colour-coded — NEGATIVE_BALANCE in red, LOW_BALANCE in amber, COLLECTION_OPPORTUNITY in blue/green), descriptive message text, affected period date range, shortfall or threshold amount, and optional suggestedAction text. The alert card layout is clean and readable, providing actionable information at a glance.
