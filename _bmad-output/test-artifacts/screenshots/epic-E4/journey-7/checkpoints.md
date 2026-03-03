# Visual Checkpoints — Journey 7: User Creation Validation Shows Interpolated Field Names

## Checkpoint 1: Create User Form Opened
- **When**: After step 5 — clicking the "Create" button on the user list page
- **Screenshot file**: `step-5-create-user-form.png`
- **What to look for**:
  - Create User form is visible (modal or dedicated page)
  - Empty fields present for: email, firstName, lastName, password, role
  - All field labels are translated English text (e.g., "Email", "First Name", "Last Name", "Password", "Role")
  - No raw translation keys like `field.email` or `common:firstName` visible
  - A "Save" or "Create" action button is visible

## Checkpoint 2: Validation Errors After Empty Submit
- **When**: After step 6 — clicking "Save" with all fields empty
- **Screenshot file**: `step-6-validation-errors.png`
- **What to look for**:
  - Validation errors visible next to required fields
  - Error messages use interpolated field names (e.g., "email is required", "firstName is required")
  - NO raw template syntax like `{{field}} is required` visible
  - NO raw namespace prefix like `validation:required` visible
  - Optionally a top-level error banner: "Please correct the errors below" (from errors.json VALIDATION_ERROR)
  - Fields may be highlighted with red borders or error styling
