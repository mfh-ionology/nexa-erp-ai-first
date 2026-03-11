# Visual Checkpoint Manifest — Journey 6: Suspend an Active Tenant

## CP1: Tenant detail page loaded (ACTIVE status)
- **When**: After navigating to tenant detail page (Step 1)
- **Screenshot file**: `01-tenant-detail-active.png`
- **What to look for**: Tenant detail page loaded with green ACTIVE status badge next to tenant name, Suspend button visible in action bar (destructive/red variant), Impersonate button visible (amber)

## CP2: Suspend confirmation dialog opened
- **When**: After clicking Suspend button (Step 2)
- **Screenshot file**: `02-suspend-dialog-opened.png`
- **What to look for**: Modal dialog with title "Suspend Tenant", description mentioning 30-second propagation, Reason textarea visible with required asterisk, destructive "Suspend Tenant" confirm button visible but DISABLED (reason is empty)

## CP3: Confirm button disabled without reason
- **When**: After attempting to click disabled confirm button (Step 3)
- **Screenshot file**: `03-confirm-button-disabled.png`
- **What to look for**: Confirm button still disabled (opacity-50), reason textarea still empty, dialog still open

## CP4: Tenant suspended successfully
- **When**: After entering reason and clicking confirm (Step 5)
- **Screenshot file**: `04-tenant-suspended-success.png`
- **What to look for**: Success toast "Tenant suspended" visible, status badge changed from green ACTIVE to red/orange SUSPENDED, action bar now shows "Reactivate" button instead of "Suspend", "Archive" button may also be visible
