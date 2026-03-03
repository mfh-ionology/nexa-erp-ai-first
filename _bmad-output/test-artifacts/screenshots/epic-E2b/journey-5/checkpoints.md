# Visual Checkpoint Manifest — Journey #5: Create Access Group with Duplicate Code is Rejected

## Checkpoint 1: Create form loaded for duplicate attempt
- **When**: After navigating to /system/access-groups/new and filling in the duplicate code form
- **Screenshot file**: step-2-form-filled-duplicate-code.png
- **What to look for**: Create form visible with fields populated: Code = "QA_TESTER", Name = "QA Tester Duplicate", Description = "Attempting duplicate code". The form should look like a standard create form (T7 Settings template) with a Save button visible.

## Checkpoint 2: Duplicate code error displayed
- **When**: After clicking [Save Settings] button with a duplicate code
- **Screenshot file**: step-3-duplicate-code-error.png
- **What to look for**: Error toast or inline error message visible indicating "Access group code already exists for this company" or similar 409 Conflict message. The form should remain on the create page (/system/access-groups/new) — NOT redirected to a detail page. The form fields should still contain the entered data, allowing the user to correct the code and retry.
