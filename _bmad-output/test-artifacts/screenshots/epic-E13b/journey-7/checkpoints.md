# Visual Checkpoint Manifest — Journey 7: Reactivate a Suspended Tenant

## CP1: Tenant detail page with SUSPENDED status
- **When**: After navigating to a SUSPENDED tenant's detail page (Step 1)
- **Screenshot**: `01-tenant-detail-suspended.png`
- **What to look for**:
  - Red SUSPENDED status badge visible in header area
  - "Reactivate" button visible in action bar (`data-testid="reactivate-btn"`)
  - "Archive" button visible (destructive variant)
  - Tenant name displayed in heading
  - 7-tab layout loaded (Overview tab active by default)

## CP2: Reactivate confirmation dialog opened
- **When**: After clicking the "Reactivate" button (Step 2)
- **Screenshot**: `02-reactivate-dialog-opened.png`
- **What to look for**:
  - AlertDialog visible with title "Reactivate Tenant"
  - Description text mentioning "restore full ERP access" and "entitlement cache"
  - "Reactivate" confirm button (default variant, NOT destructive red)
  - "Cancel" button visible
  - No reason textarea required (unlike Suspend dialog)

## CP3: Tenant reactivated — status changed to ACTIVE
- **When**: After confirming reactivation and API succeeds (Step 3)
- **Screenshot**: `03-tenant-reactivated-active.png`
- **What to look for**:
  - Success toast "Tenant reactivated" visible
  - Status badge changed from red SUSPENDED to green ACTIVE
  - "Reactivate" button gone, replaced by "Suspend" button
  - Dialog dismissed
  - Action bar reflects ACTIVE tenant state (Suspend + Impersonate buttons)
