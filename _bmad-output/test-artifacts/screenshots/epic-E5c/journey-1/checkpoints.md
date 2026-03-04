# Visual Checkpoint Manifest — Journey 1: AI Configuration Dashboard Overview

## Checkpoint 1: Dashboard Initial Load
- **When**: After step 1 — navigate to /ai/admin and wait for data load
- **Screenshot file**: `step-1-dashboard-loaded.png`
- **What to look for**:
  - Page heading "AI Configuration" visible
  - 4 summary cards visible in a grid: Active Models, Active Agents, Active Skills, Automations
  - Each card has icon, title, value in mono font, optional subtitle
  - Concept D purple theme (#f4f2ff background)
  - No loading skeletons (data fully loaded)

## Checkpoint 2: Summary Cards Detail
- **When**: After steps 2-5 — all 4 summary cards verified
- **Screenshot file**: `step-5-summary-cards-detail.png`
- **What to look for**:
  - Active Models card: count >= 3, monthly cost subtitle in mono font
  - Active Agents card: count badge visible
  - Active Skills card: count + "across N modules" subtitle
  - Automations card: active (green badge) + paused (amber badge)

## Checkpoint 3: Token Usage Chart
- **When**: After step 6 — token usage chart section verified
- **Screenshot file**: `step-6-token-usage-chart.png`
- **What to look for**:
  - "Token Usage (Last 30 Days)" heading visible
  - Area/line chart visible OR "No token usage data" placeholder
  - Concept D card styling (12px radius, shadow)

## Checkpoint 4: Automation Health Section
- **When**: After step 7 — automation health section verified
- **Screenshot file**: `step-7-automation-health.png`
- **What to look for**:
  - "Automation Health" heading with "View All Runs" link
  - Status donut chart (or placeholder)
  - Failed Runs (24h) card
  - Upcoming Scheduled Runs list
  - Token Spend (7d) area chart

## Checkpoint 5: Model Registry Navigation
- **When**: After steps 9-10 — click Model Registry quick-nav, verify page loaded
- **Screenshot file**: `step-10-model-registry-page.png`
- **What to look for**:
  - URL is /ai/admin/models
  - "Model Registry" heading visible
  - Page content loaded (model list or heading)

## Checkpoint 6: Automations Navigation
- **When**: After steps 12-13 — click Automations quick-nav, verify page loaded
- **Screenshot file**: `step-13-automations-page.png`
- **What to look for**:
  - URL is /ai/admin/automations
  - "Automations" heading visible
  - Page content loaded
