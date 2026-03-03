# Visual Checkpoints — Journey 9: View Entity Change History

## Checkpoint 1: Login Page
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button

## Checkpoint 2: Dashboard After Login
- **When**: After clicking Sign In (Step 3)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: Dashboard loaded with sidebar visible containing System module section with Audit Log link

## Checkpoint 3: Audit Log Page
- **When**: After navigating to /system/audit-log (Step 4)
- **Screenshot file**: step-4-audit-log-page.png
- **What to look for**: Audit log page with filter controls and data table showing audit records. Table should have columns: Timestamp, Entity Type, Entity ID, Action, User, AI Action. At least one AccessGroup record should be present.

## Checkpoint 4: Entity History View
- **When**: After clicking View History on an AccessGroup audit record (Step 5)
- **Screenshot file**: step-5-entity-history-view.png
- **What to look for**: Entity history view showing chronological timeline of changes for the selected AccessGroup. Records in ascending order (oldest first). Each entry shows: timestamp, action (CREATE/UPDATE/DELETE), user who made the change, and before/after data diffs.

## Checkpoint 5: First Record Verification
- **When**: After verifying first record has action=CREATE (Step 7)
- **Screenshot file**: step-7-first-record-create.png
- **What to look for**: First record in entity history displays action=CREATE, confirming the entity was initially created before any modifications.
