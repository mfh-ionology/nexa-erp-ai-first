# Missing Functionality - Epic E9

> Auto-generated during frontend E2E testing

## Bug: Dirty state not cleared after successful preference save

- **Journey**: Journey 9: Toggle a Preference and Save, Step 4
- **Expected**: After clicking "Save Preferences" and receiving the success toast, the amber "Unsaved Changes" warning should disappear, and the Save button should return to disabled state
- **Actual**: The success toast "Notification preferences saved successfully" appears (save succeeded), but the amber "unsaved changes" warning persists and the Save button stays enabled. The dirty state never clears.
- **Root Cause**: In `notification-preferences-page.tsx` lines 122-128, the `useEffect` that syncs `localState` from server data after a refetch has a guard `!isDirtyRef.current`. After save, `isDirtyRef.current` is still `true` (computed from stale `localState` vs `initialStateRef.current`), so the guard blocks the re-sync. `localState` never updates to match the new server data, and `isDirty` stays true indefinitely.
- **Fix**: After successful mutation, either (a) reset `isDirtyRef.current = false` before the query invalidation triggers a refetch, or (b) update `initialStateRef.current` to match `localState` in the mutation's `onSuccess` callback.
- **Related Story**: E9.4
- **Suggested Story Title**: Fix dirty state not clearing after saving notification preferences

## Bug: Role Defaults dirty state not cleared after successful save (isDirtyRef guard)

- **Journey**: Journey 14: Edit Role Defaults as Admin, Steps 4-6
- **Expected**: After clicking "Save Role Defaults" and seeing the success toast, the amber dirty indicator should disappear, the Save button should return to disabled, and switching roles should NOT trigger the unsaved-changes guard dialog.
- **Actual**: The success toast "Role defaults saved successfully" appears (save succeeded), but the amber dirty indicator persists and Save button stays enabled. When opening the role selector dropdown and selecting MANAGER, the "Select Role — You have unsaved changes for this role. Switch anyway?" dialog appears even though the save was successful.
- **Root Cause**: Same as the personal preferences dirty state bug. In `role-defaults-section.tsx`, the `useEffect` at lines 162-168 has a guard `!isDirtyRef.current`. After save, `isDirtyRef.current` remains `true` because the mutation's `onSuccess` doesn't reset it before the query refetch fires the useEffect. The stale `localState` vs `initialStateRef.current` comparison still evaluates as dirty.
- **Fix**: In the `updateMutation` `onSuccess` callback, reset `isDirtyRef.current = false` before query invalidation, or update `initialStateRef.current` to match `localState`.
- **Related Story**: E9.4
- **Suggested Story Title**: Fix role defaults dirty state not clearing after save (same isDirtyRef pattern as personal preferences)

## Missing: Notification seed data for staff user

- **Journey**: Journey 2: Open Notification Dropdown, Steps 4-7
- **Expected**: Staff user should have at least 3 unread notifications of varying priorities (URGENT, HIGH, NORMAL) seeded in the database so the dropdown displays notification items with priority borders, unread dots, timestamps, and the "Mark All Read" button
- **Actual**: Notification dropdown opens showing empty state ("No notifications — You're all caught up!"). No notification items are present. Bell icon shows no unread badge.
- **Related Story**: E9.2 or seed data setup
- **Suggested Story Title**: Seed notification test data for E2E testing (URGENT, HIGH, NORMAL priority notifications for staff user)

