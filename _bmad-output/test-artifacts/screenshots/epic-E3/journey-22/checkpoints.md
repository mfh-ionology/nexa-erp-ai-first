# Visual Checkpoints — Journey 22: Full Audit Lifecycle

## Checkpoint 1: Login Page Loaded
- **When:** After navigating to /login (Step 1)
- **Screenshot file:** step-01-login-page.png
- **What to look for:** Login form visible with email input, password input, and Sign In button. No error messages displayed.

## Checkpoint 2: Dashboard After Login
- **When:** After clicking Sign In with admin credentials (Step 3)
- **Screenshot file:** step-03-dashboard-after-login.png
- **What to look for:** Dashboard/briefing page loaded. App shell visible with sidebar containing System module section. Navigation links for Access Groups, Audit Log visible in sidebar.

## Checkpoint 3: Access Group Created
- **When:** After clicking Save/Create button for new access group (Step 7)
- **Screenshot file:** step-07-access-group-created.png
- **What to look for:** Success toast confirming access group creation. The new 'Lifecycle Test Group' with code 'LIFECYCLE_TEST' should appear in the list or confirmation.

## Checkpoint 4: Access Group Updated
- **When:** After clicking Save/Update button with modified name (Step 10)
- **Screenshot file:** step-10-access-group-updated.png
- **What to look for:** Success toast confirming access group update. The name should now show 'Lifecycle Test Group (Updated)'.

## Checkpoint 5: Audit Log Filtered to AccessGroup
- **When:** After applying entityType=AccessGroup filter and clicking Apply Filters (Step 13)
- **Screenshot file:** step-13-audit-log-filtered.png
- **What to look for:** Audit log table filtered to AccessGroup entities. At least two records visible for LIFECYCLE_TEST: one with action=CREATE, one with action=UPDATE. Most recent (UPDATE) appears first (descending timestamp order). Columns: Timestamp, Entity Type, Entity ID, Action, User, AI Action.

## Checkpoint 6: Entity Change History
- **When:** After clicking View History on the LIFECYCLE_TEST group's audit record (Step 14)
- **Screenshot file:** step-14-entity-history.png
- **What to look for:** Entity history view showing chronological timeline. Two records: 1) CREATE with afterData containing code=LIFECYCLE_TEST and name='Lifecycle Test Group', 2) UPDATE showing name change to 'Lifecycle Test Group (Updated)'. Timestamps progress forward. Both records show admin user as actor.
