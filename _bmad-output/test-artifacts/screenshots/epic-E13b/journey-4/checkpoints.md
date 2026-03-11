# Visual Checkpoint Manifest — Journey 4: Tenant List with Filters and Pagination

## CP1: Tenant List Page Loaded
- **When**: After navigating to /tenants and data loads
- **Screenshot file**: `01-tenant-list-page-loaded.png`
- **What to look for**: Page header "Tenants" with "+ New Tenant" button visible (PLATFORM_ADMIN), data table with columns: Name, Code, Plan, Status (colour badges), Billing, Users, Last Activity. At least one tenant row should be visible.

## CP2: Status Badges Verification
- **When**: After verifying ACTIVE (green) and SUSPENDED (red) status badges
- **Screenshot file**: `02-status-badges-visible.png`
- **What to look for**: ACTIVE badges with green styling, SUSPENDED badges with red styling. Distinct colour differentiation between statuses.

## CP3: Filtered by ACTIVE Status
- **When**: After selecting ACTIVE in the status filter dropdown
- **Screenshot file**: `03-filtered-active-only.png`
- **What to look for**: All visible tenant rows show green ACTIVE status badges only. No SUSPENDED, PROVISIONING, or other status badges visible. Filter state reflected in the dropdown.

## CP4: Filters Cleared — Full List Restored
- **When**: After clicking Clear Filters / reset button
- **Screenshot file**: `04-filters-cleared-full-list.png`
- **What to look for**: Full tenant list restored with mixed statuses (ACTIVE, SUSPENDED, etc.), filter dropdowns reset to default ("All Statuses"), search input empty.

## CP5: Navigated to Tenant Detail
- **When**: After clicking the first tenant row and navigating to the detail page
- **Screenshot file**: `05-tenant-detail-after-click.png`
- **What to look for**: URL changed to /tenants/{tenantId}, tenant detail page visible with tenant name as heading, breadcrumb showing navigation path, tabs visible.
