# Visual Checkpoints — Journey 19: Start an Impersonation Session

## Checkpoint 1: Tenant Detail Page Loaded
- **When**: After navigating to tenant detail page (Step 1)
- **Screenshot file**: `01-tenant-detail-loaded.png`
- **What to look for**: Tenant detail page with "Development Tenant" heading, ACTIVE status badge, action bar visible with amber "Impersonate" button (UserRoundCog icon), Suspend button, Overview tab active

## Checkpoint 2: Impersonation Dialog Opened
- **When**: After clicking the Impersonate button (Step 2)
- **Screenshot file**: `02-impersonation-dialog-opened.png`
- **What to look for**: Modal dialog with title "Impersonate Tenant", description mentioning tenant name, amber warning banner with text "You will be redirected to the tenant's ERP. All actions will be audited", reason textarea (required), duration selector defaulting to "1 hour" (60 min), "Start Impersonation" button disabled (no reason entered yet), Cancel button

## Checkpoint 3: Submit Button Disabled (Empty Reason)
- **When**: After attempting to click submit with empty reason (Step 3)
- **Screenshot file**: `03-submit-disabled-empty-reason.png`
- **What to look for**: "Start Impersonation" button still disabled, reason textarea empty, no form submission occurred

## Checkpoint 4: Form Filled and Ready
- **When**: After filling reason and selecting 30-minute duration (Step 4)
- **Screenshot file**: `04-form-filled-ready.png`
- **What to look for**: Reason textarea contains the investigation text (>10 chars), duration selector shows "30 minutes", "Start Impersonation" button now enabled (not disabled)

## Checkpoint 5: Impersonation Session Created
- **When**: After clicking "Start Impersonation" and API responds (Step 5)
- **Screenshot file**: `05-impersonation-submitted.png`
- **What to look for**: Dialog closed, success toast "Impersonation session started" visible, or the page after the dialog closes. Note: the browser will attempt to open a new tab with the ERP URL containing impersonation_token — in headless mode this may or may not be visible
