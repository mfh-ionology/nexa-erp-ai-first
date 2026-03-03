# Visual Checkpoint Manifest — Journey 2: Trigger Events and Verify Audit Records Created

## Checkpoint 1: Access Group Created Successfully
- **When**: After step 7 — clicking Save/Create button on Create Access Group form
- **Screenshot file**: `step-7-access-group-created-toast.png`
- **What to look for**: Green success toast or confirmation message visible confirming the access group "Audit Test Group" was created. The access groups list page or detail page should be visible behind the toast. No error messages.

## Checkpoint 2: Audit Log Shows AccessGroup CREATE Record
- **When**: After step 9 — navigating to Audit Log and verifying AccessGroup text
- **Screenshot file**: `step-9-audit-log-accessgroup-record.png`
- **What to look for**: Audit log table is visible with at least one record showing entityType "AccessGroup" and action "CREATE". The record should show the admin user as the actor. Timestamp should be recent (within the last minute). Table columns (Timestamp, Entity Type, Entity ID, Action, User) should be visible.

## Checkpoint 3: Audit Log Shows LOGIN Record
- **When**: After step 10 — verifying LOGIN text appears in audit log table
- **Screenshot file**: `step-10-audit-log-login-record.png`
- **What to look for**: Audit log table contains at least one record with action "LOGIN" and entityType "User". This confirms the login event from step 3 was captured by the event bus and persisted to the audit trail. The LOGIN record should show the admin user's email or ID.
