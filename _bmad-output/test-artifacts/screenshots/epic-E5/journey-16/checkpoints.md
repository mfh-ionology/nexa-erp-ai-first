# Visual Checkpoint Manifest — Journey 16: View Daily Briefing as Finance Manager

## Checkpoint 1: Dashboard Loaded with Daily Briefing Section
- **When**: After step 1 — navigating to "/" as Finance Manager
- **Screenshot file**: `step-1-dashboard-with-briefing.png`
- **What to look for**:
  - Dashboard page loaded with a prominent Daily Briefing section
  - Personalised greeting at the top (e.g., "Good morning, [Name]" or "Good afternoon, [Name]") based on time of day
  - 1-2 sentence summary overview below the greeting
  - Role-specific categories for Finance Manager visible: "Pending Approvals", "Overdue Invoices", "Cash Position", "Upcoming Payment Runs", "Anomaly Alerts"
  - Each category has item cards with data
  - A subtle "cached at" timestamp or "Refresh" button is visible
  - No error messages or broken layout

## Checkpoint 2: Briefing Item Card Detail with Metric and Actions
- **When**: After step 3 — verifying a briefing item card shows metric, delta, and action buttons
- **Screenshot file**: `step-3-briefing-item-card-detail.png`
- **What to look for**:
  - At least one briefing item card visible with: title (bold), description text, metric value (e.g., "£12,400")
  - Delta/trend indicator: green up arrow for positive, red down arrow for negative, with percentage (e.g., "+12% vs last month")
  - Comparison period label (e.g., "vs last month")
  - Action buttons at bottom of card: primary actions like "Chase", "Review", "Approve", or "Approve All"
  - Entity link present for one-click navigation to relevant list/page

## Checkpoint 3: Navigation After Clicking Briefing Action Button
- **When**: After step 6 — clicking an action button on a briefing item (e.g., "Review" on overdue invoices)
- **Screenshot file**: `step-6-action-navigation-result.png`
- **What to look for**:
  - Navigation occurred — user is on a relevant page (e.g., Invoices list with overdue filter, or approval queue)
  - Breadcrumb or page title confirms the destination
  - Page content is relevant (e.g., filtered list of overdue invoices)
  - Demonstrates actionable links from the briefing work correctly
  - No error messages or broken navigation
