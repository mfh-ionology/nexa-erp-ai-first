# Visual Checkpoints: Journey 11 — Access Group Create - Duplicate Code Error

## Checkpoint 1: Create Access Group Form Loaded
- **When**: After navigating to `/system/access-groups/new` (Step 1)
- **Screenshot file**: `step-1-create-form-loaded.png`
- **What to look for**: Create Access Group page visible with heading "Create Access Group", breadcrumbs showing System > Access Groups > Create Access Group, form with Code, Name, and Description fields. Code field placeholder "e.g., SALES_MGR". Create and Cancel buttons visible.

## Checkpoint 2: Form Filled with Duplicate Code
- **When**: After filling Code with "FULL_ACCESS" and Name with "Full Access Duplicate" (Step 2)
- **Screenshot file**: `step-2-form-filled-duplicate-code.png`
- **What to look for**: Code field shows "FULL_ACCESS", Name field shows "Full Access Duplicate". No validation errors visible yet. Create button is enabled.

## Checkpoint 3: Inline Error on Code Field After 409 Response
- **When**: After clicking Create button and receiving 409 CONFLICT (Step 3)
- **Screenshot file**: `step-3-duplicate-code-inline-error.png`
- **What to look for**: Code field has an inline error message below it: "An access group with this code already exists". The error text should be in red/destructive colour. The form remains on the create page (no navigation occurred). No success toast visible. Form fields retain their values (FULL_ACCESS and Full Access Duplicate). The Code field label may also be styled red to indicate error state.
