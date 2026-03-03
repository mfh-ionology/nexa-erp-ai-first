# Visual Checkpoint Manifest — Journey 3: Login Validation Errors Use Interpolated Field Names

## Checkpoint 1: Login Page Initial State
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page-loaded.png
- **What to look for**: Login form visible with email and password fields. All labels are translated English text. No raw i18n keys visible.

## Checkpoint 2: Validation Errors After Empty Submit
- **When**: After clicking Sign In with empty fields (Step 2)
- **Screenshot file**: step-2-validation-errors-displayed.png
- **What to look for**: Inline validation errors visible next to email and password fields. Error messages contain resolved field names (e.g., 'Email is required', 'Password is required'), NOT raw template syntax like '{{field}} is required' or raw keys like 'validation:required'. This is the critical checkpoint — it verifies i18next interpolation is working.
