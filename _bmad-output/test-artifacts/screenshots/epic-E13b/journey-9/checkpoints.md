# Visual Checkpoints — Journey 9: Billing Overview Dashboard with KPI Cards

## Checkpoint 1: Billing dashboard loaded
- **When**: After navigating to /billing and data loads
- **Screenshot file**: 01-billing-dashboard-loaded.png
- **What to look for**: Page header 'Billing' visible, breadcrumb 'Platform Admin > Billing', 5 KPI cards in a row (Active Tenants with grey border, Current with green border, Grace Period with amber border, Overdue with red border, Blocked with dark-red border), each card shows a count and percentage

## Checkpoint 2: Enforcement distribution section
- **When**: After verifying enforcement distribution section is visible
- **Screenshot file**: 02-enforcement-distribution-visible.png
- **What to look for**: 'Enforcement Action Distribution' heading, four horizontal bars: None (green), Warning (amber), Read Only (red), Suspended (dark red), each with a count on the right

## Checkpoint 3: Billing issues table
- **When**: After verifying the billing issues table is visible (or empty state)
- **Screenshot file**: 03-billing-issues-table.png
- **What to look for**: 'Billing Issues' heading, table with columns: Tenant, Plan, Billing Status, Dunning Level, Enforcement, Last Payment, Actions. Rows for tenants with non-CURRENT billing status. Or empty state message if all tenants are current.

## Checkpoint 4: Tenant detail after click
- **When**: After clicking a tenant name link in the billing issues table
- **Screenshot file**: 04-tenant-detail-navigation.png
- **What to look for**: URL changed to /tenants/{tenantId}, tenant detail page loaded with tenant name visible
