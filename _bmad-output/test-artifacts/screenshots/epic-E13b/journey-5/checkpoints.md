# Journey 5: Tenant Detail Page with 7 Tabs — Visual Checkpoints

## CP1: Tenant detail page loaded after clicking first ACTIVE tenant
- **When**: After step 2 — click first ACTIVE tenant row in tenant list
- **Screenshot file**: `01-tenant-detail-page-loaded.png`
- **What to look for**: Breadcrumb showing "Platform Admin > Tenants > {displayName}", tenant name as h1 heading with StatusBadge (green ACTIVE), 7 tab navigation items visible: Overview, Modules & Flags, Users, AI Usage, Billing, Diagnostics, Audit. Overview tab should be active by default.

## CP2: Action bar buttons for ACTIVE tenant
- **When**: After step 4 — verify action bar buttons
- **Screenshot file**: `02-action-bar-buttons.png`
- **What to look for**: Action bar with "Suspend" button (destructive/red style) and "Impersonate" button (amber accent). Tenant status badge should show green ACTIVE. No "Reactivate" or "Archive" buttons visible (those only appear for SUSPENDED tenants).

## CP3: Audit tab content
- **When**: After step 9 — click Audit tab
- **Screenshot file**: `03-audit-tab-content.png`
- **What to look for**: Audit tab is selected/active, content area shows audit log entries filtered for this tenant (table or list), or a placeholder/empty state with "View full audit log" link. The other 6 tabs should not be showing their content.
