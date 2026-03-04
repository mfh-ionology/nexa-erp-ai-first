# Journey 19: Automation Health Dashboard and Circuit Breaker Warning — Visual Checkpoints

## Checkpoint 1: Dashboard with Automation Health Section
- **When**: After navigating to /ai/admin and page loads
- **Screenshot file**: step-1-dashboard-automation-health-section.png
- **What to look for**: AI Configuration Dashboard loaded with Automation Health section visible below the quick-nav cards. Should show a 2x2 stats grid containing: status donut chart, failed runs card, upcoming runs list, and token spend chart. Purple-themed Concept D design.

## Checkpoint 2: Token Spend Area Chart
- **When**: After verifying all health sub-components
- **Screenshot file**: step-5-token-spend-chart.png
- **What to look for**: Token spend area chart with purple gradient fill, 7-day x-axis labels, y-axis token counts. If no automation usage data, should show "No automation token usage" empty state.

## Checkpoint 3: Failed Runs Navigation
- **When**: After clicking the failed runs count card
- **Screenshot file**: step-6-failed-runs-navigation.png
- **What to look for**: Navigated to /ai/admin/automations/runs page, potentially filtered by status=FAILED and dateFrom=24h ago. Should show Automation Runs heading.

## Checkpoint 4: Circuit Breaker Warning (conditional)
- **When**: After navigating back to dashboard and checking for circuit breaker banner
- **Screenshot file**: step-8-circuit-breaker-check.png
- **What to look for**: If circuit breaker triggered: amber warning banner with AlertTriangle icon, automation name in bold, "has been paused after 3 consecutive failures" text, View Runs link, Resume button. If not triggered: clean Automation Health section without any amber warning banners.
