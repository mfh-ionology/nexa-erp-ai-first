# Visual Checkpoints — Journey #14: Verify Field-Level Visibility in API Response

## Context
The sales user has QA_TESTER access group with field overrides configured:
- `vatNumber` on `system.company-profile.detail` → HIDDEN (field should not appear at all)
- `registrationNumber` on `system.company-profile.detail` → READ_ONLY (field visible but non-editable)

This journey verifies that the frontend correctly respects field-level visibility overrides from the RBAC system.

---

## Checkpoint 1: Company Profile Page Loaded (After Step 1)
- **When**: After navigating to /system/company-profile as the sales user
- **Screenshot file**: `step-1-company-profile-loaded.png`
- **What to look for**:
  - Company profile page renders correctly (not access denied)
  - Page title/heading shows "Company Profile"
  - The `vatNumber` field should be **completely absent** from the page (HIDDEN override)
  - Other company fields (name, address, etc.) should be visible
  - No error messages or broken layout

## Checkpoint 2: vatNumber Field Absence Confirmed (After Step 2)
- **When**: After verifying vatNumber is not displayed
- **Screenshot file**: `step-2-vat-number-absent.png`
- **What to look for**:
  - Full page view showing the company profile form
  - No "VAT Number" label, no "vatNumber" input field anywhere on the page
  - The area where VAT Number would normally appear should not show a blank gap or placeholder
  - Other fields render normally without layout issues from the missing field

## Checkpoint 3: registrationNumber Read-Only State (After Step 3)
- **When**: After verifying registrationNumber is present but read-only
- **Screenshot file**: `step-3-registration-number-readonly.png`
- **What to look for**:
  - `registrationNumber` (or "Registration Number" / "Company Registration Number") field is visible
  - The field should be visually distinct as read-only: greyed out background, disabled state, read-only indicator, or lock icon
  - The field should display its value but NOT allow editing (no cursor on click, disabled attribute)
  - No edit/pencil icon on this specific field if the page uses inline editing
