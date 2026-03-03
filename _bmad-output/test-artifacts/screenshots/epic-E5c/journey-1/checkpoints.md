# Visual Checkpoint Manifest — Journey 1: AI Configuration Dashboard

## Checkpoint 1: Dashboard Initial Load
- **When**: After navigating to /ai/admin and waiting for data to load
- **Screenshot file**: `step-1-dashboard-loaded.png`
- **What to look for**:
  - Page heading "AI Configuration" visible
  - 4 summary cards visible in a grid: Active Models, Active Agents, Active Skills, Automations
  - Each card has an icon, title, value in mono font, and optional subtitle
  - Purple-themed Concept D styling
  - No loading skeletons visible (data fully loaded)

## Checkpoint 2: Summary Cards Detail
- **When**: After verifying all 4 summary card contents
- **Screenshot file**: `step-5-summary-cards-detail.png`
- **What to look for**:
  - Active Models card: numeric count + monthly cost subtitle in mono font
  - Active Agents card: numeric count
  - Active Skills card: numeric count + "across N modules" subtitle
  - Automations card: total count + green "active" badge + amber "paused" badge

## Checkpoint 3: Token Usage Chart & Quick Nav
- **When**: After scrolling down to verify token usage chart and quick-nav section
- **Screenshot file**: `step-7-chart-and-quicknav.png`
- **What to look for**:
  - "Token Usage (Last 30 Days)" heading visible
  - Area chart or "No token usage data available yet" message
  - Quick navigation cards for: Model Registry, Prompt Templates, Agent Configuration, Skill Packs, Automations
  - Each nav card has icon, title, description, and arrow

## Checkpoint 4: Automation Health Section
- **When**: After scrolling to the Automation Health section at the bottom
- **Screenshot file**: `step-8-automation-health.png`
- **What to look for**:
  - "Automation Health" heading with "View All Runs" link
  - Automations by Status donut chart (or "No automations yet")
  - Failed Runs (24h) card with count or "All healthy"
  - Upcoming Scheduled Runs list
  - Token Spend (7d) area chart

## Checkpoint 5: Model Registry Navigation
- **When**: After clicking Model Registry quick-nav card
- **Screenshot file**: `step-9-model-registry-nav.png`
- **What to look for**:
  - URL changed to /ai/admin/models
  - Model Registry page content loaded (list or heading visible)

## Checkpoint 6: Prompt Templates Navigation
- **When**: After returning to dashboard and clicking Prompt Templates quick-nav card
- **Screenshot file**: `step-11-prompt-templates-nav.png`
- **What to look for**:
  - URL changed to /ai/admin/prompts
  - Prompt Templates page content loaded (list or heading visible)
