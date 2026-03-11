# Journey 13: Cross-Tenant AI Usage Dashboard — Visual Checkpoints

## Checkpoint 1: AI Usage page loaded with Overview tab
- **When**: After navigating to /ai-usage and page finishes loading
- **Screenshot file**: `01-ai-usage-overview-loaded.png`
- **What to look for**: Tabbed layout with 3 tabs (Overview, Alerts, Providers). Overview tab active. KPI cards visible: "Tokens Today", "Tokens This Month", "Cost Estimate (Month)". Page header shows "AI Usage". Daily usage trend area chart section visible below KPI cards. Top consumers table section visible below chart.

## Checkpoint 2: Top consumers table with tenant links
- **When**: After verifying the top consumers table content
- **Screenshot file**: `02-top-consumers-table.png`
- **What to look for**: Table with columns: #, Tenant, Code, Tokens. Rows showing tenant names as clickable links (purple/primary color). Up to 10 rows. Token values formatted (K/M suffixes).

## Checkpoint 3: Navigated to tenant detail after clicking consumer link
- **When**: After clicking a top consumer tenant name link
- **Screenshot file**: `03-tenant-detail-after-click.png`
- **What to look for**: URL changed to /tenants/{tenantId}. Tenant detail page loaded with tabs including an AI Usage tab. The tenant name from the consumers table matches the page heading.
