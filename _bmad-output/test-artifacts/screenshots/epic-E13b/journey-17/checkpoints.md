# Journey 17: Per-Tenant AI Usage and BYOK Key Management — Visual Checkpoints

## Checkpoint 1: Tenant Detail Page Loaded
- **When**: After navigating to tenant detail page via tenants list
- **Screenshot file**: `01-tenant-detail-loaded.png`
- **What to look for**: Tenant detail page with 7-tab navigation (Overview, Modules & Flags, Users, AI Usage, Billing, Diagnostics, Audit). Tenant name and status badge visible in header.

## Checkpoint 2: AI Usage Tab — KPIs and Quota
- **When**: After clicking the "AI Usage" tab
- **Screenshot file**: `02-ai-usage-tab-loaded.png`
- **What to look for**: Three KPI cards visible (Tokens Today, Tokens This Month, Cost Estimate). Quota progress bar with soft limit (amber at 80%) and hard limit (red at 100%) markers. Usage percentage displayed.

## Checkpoint 3: AI Usage Tab — Charts Section
- **When**: After scrolling down to see charts
- **Screenshot file**: `03-ai-usage-charts.png`
- **What to look for**: Daily Token Usage (30 days) area chart. Usage by Feature horizontal bar chart. Usage by Provider pie chart. Charts should show data or "No data" placeholders.

## Checkpoint 4: BYOK Section (Enterprise Only)
- **When**: After scrolling to BYOK section (if Enterprise tenant)
- **Screenshot file**: `04-byok-section.png`
- **What to look for**: BYOK vs Vendor donut chart showing token split. BYOK API Keys management section with provider name, active/inactive status, toggle switch. "Add BYOK Key" button visible.

## Checkpoint 5: Add BYOK Key Modal
- **When**: After clicking "Add BYOK Key" button
- **Screenshot file**: `05-add-byok-modal.png`
- **What to look for**: Modal with title "Add BYOK API Key". Provider dropdown selector. API Key password input field. Cancel and Add Key buttons.

## Checkpoint 6: Modal Closed
- **When**: After clicking Cancel to close modal
- **Screenshot file**: `06-modal-closed.png`
- **What to look for**: Modal dismissed. AI Usage tab content visible again. BYOK section still showing.

## Checkpoint 7: Quota Settings Editor
- **When**: After clicking "Edit Quota" button
- **Screenshot file**: `07-quota-settings-editor.png`
- **What to look for**: Inline form with three fields: Token Allowance, Soft Limit (%), Hard Limit (%). Save Changes and Cancel buttons visible. Current values pre-populated.
