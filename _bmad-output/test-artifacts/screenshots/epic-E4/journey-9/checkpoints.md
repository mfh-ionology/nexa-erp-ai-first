# Journey 9: User Locale Preference Change and Fallback Chain — Visual Checkpoints

## Checkpoint 1: Dashboard After Login
- **When**: After step 3 — admin user clicks Sign In and login succeeds
- **Screenshot file**: `step-3-dashboard-after-login.png`
- **What to look for**: App shell loaded with sidebar navigation visible. Dashboard or home page rendered. All navigation labels in English (Dashboard, System, Users, Settings). No raw i18n keys visible.

## Checkpoint 2: User Detail/Edit Page with Locale Field
- **When**: After step 5 — clicked on admin user row to open user detail/edit page
- **Screenshot file**: `step-5-user-detail-locale-field.png`
- **What to look for**: User detail/edit form is open for the admin user. A "Locale" or "Language" field is visible on the form showing the current value 'en'. The field should be editable (dropdown, select, or text input). All field labels are translated English text, not raw i18n keys.

## Checkpoint 3: Save Success After Locale Change to en-GB
- **When**: After step 8 — saved user with locale changed to 'en-GB'
- **Screenshot file**: `step-8-locale-saved-en-gb.png`
- **What to look for**: Success feedback visible — either a green toast notification saying "User updated" or similar, or inline success message. The entire UI must STILL render in English since 'en-GB' falls back to 'en' in the i18n fallback chain. Sidebar navigation should still show 'Dashboard', 'System', 'Users', 'Settings' in English. No raw i18n keys or broken translations visible anywhere.
