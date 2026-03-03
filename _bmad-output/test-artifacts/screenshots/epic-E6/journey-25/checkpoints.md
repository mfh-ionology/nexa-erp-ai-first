# Visual Checkpoints — Journey 25: Login Form Validation and Error Handling

## Checkpoint 1: Validation errors on empty submit
- **When**: After Step 2 — clicking "Sign In" without filling any fields
- **Screenshot file**: `step-2-empty-form-validation-errors.png`
- **What to look for**:
  - Email field shows a required/validation error message below it (red text via `text-destructive`)
  - Password field shows a required/validation error message below it
  - Login form is still visible (not navigated away)
  - "Sign In" button is still present and enabled (not in loading state)
  - No toast notification — these are inline validation errors only

## Checkpoint 2: Auth error toast on invalid credentials
- **When**: After Step 4 — submitting with wrong email/password and receiving API 401
- **Screenshot file**: `step-4-auth-error-toast.png`
- **What to look for**:
  - Error toast notification visible (sonner toast with role="alert" or similar)
  - Toast text should read "Invalid email or password" (from `errors:AUTH_INVALID_CREDENTIALS`)
  - Login form still visible underneath for retry
  - Form fields still contain the entered values (wrong@example.com)
  - "Sign In" button returns to enabled state (no longer showing "Signing in…")
