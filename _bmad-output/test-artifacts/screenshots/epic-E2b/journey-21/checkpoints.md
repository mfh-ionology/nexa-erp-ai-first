# Journey #21: Verify Cache Invalidation After Permission Change — Visual Checkpoints

## Checkpoint 1: Permission Save Success Toast (Step 5)
- **When**: After admin saves canAccess+canView on system.resources.list for SALES_STAFF group
- **Screenshot file**: step-5-permissions-saved-success-toast.png
- **What to look for**: Success toast visible (e.g. "Permissions updated" or "Saved"), permission matrix shows canAccess and canView checked for system.resources.list row in SALES_STAFF detail page

## Checkpoint 2: Sales User Dashboard with Resource Registry in Sidebar (Step 8)
- **When**: After logging in as sales@nexa-test.co.uk following the permission change
- **Screenshot file**: step-8-sales-dashboard-resource-registry-visible.png
- **What to look for**: Dashboard loaded, sidebar visible with "Resource Registry" link now present — confirming the cache was invalidated and the sales user's permissions were updated immediately. Previously this link was absent for SALES_STAFF.

## Checkpoint 3: Sales User Accesses Resource Registry Page (Step 9)
- **When**: After sales user clicks "Resource Registry" sidebar link
- **Screenshot file**: step-9-resource-registry-accessible-by-sales.png
- **What to look for**: Resource Registry page loaded successfully (heading "Resource Registry" visible, table with resources displayed). No access denied or 403 error. This confirms the permission change took effect without waiting for cache TTL.
