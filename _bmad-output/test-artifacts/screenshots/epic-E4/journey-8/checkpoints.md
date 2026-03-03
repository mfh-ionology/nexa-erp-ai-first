# Journey 8: Duplicate Email Error Uses Translated Message — Visual Checkpoints

## Checkpoint 1: Create User Form Opened
- **When**: After step 5 — clicking the Create button on the user list page
- **Screenshot file**: `step-5-create-user-form.png`
- **What to look for**: Create User form is visible with fields for email, firstName, lastName, password, and role. All field labels are in translated English. No raw i18n keys visible.

## Checkpoint 2: Duplicate Email Error Displayed
- **When**: After step 7 — submitting the form with an existing email (admin@nexa-test.co.uk)
- **Screenshot file**: `step-7-duplicate-email-error.png`
- **What to look for**: Error message visible on the form or as a toast/banner reading 'A user with this email already exists'. This text comes from errors.json DUPLICATE_EMAIL key resolved via the API error envelope's messageKey. The raw key 'errors:DUPLICATE_EMAIL' must NOT be visible anywhere on the page.
