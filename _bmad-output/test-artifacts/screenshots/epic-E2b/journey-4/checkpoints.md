# Visual Checkpoints — Journey 4: Create a Custom Access Group

## Checkpoint 1: Create Form Loaded
- **When**: After clicking [+ New Access Group] button (Step 2)
- **Screenshot file**: step-2-create-form-loaded.png
- **What to look for**: T7 Settings template in create mode with empty form fields: Code (text input), Name (text input), Description (textarea). Page URL should be /system/access-groups/new. No pre-filled values.

## Checkpoint 2: Access Group Created Successfully
- **When**: After clicking [Save Settings] button with valid data (Step 4)
- **Screenshot file**: step-4-creation-success.png
- **What to look for**: Success toast message visible (e.g. "Access group created"). Redirected to detail page for QA_TESTER showing the code (read-only after creation), name "QA Tester", description "Custom access group for QA testing E2E flows", and an empty permission matrix.

## Checkpoint 3: New Group Visible in List
- **When**: After navigating back to /system/access-groups (Step 5)
- **Screenshot file**: step-5-new-group-in-list.png
- **What to look for**: Access group list now shows 13 groups (12 pre-built + QA_TESTER). QA_TESTER row visible in the table with no System badge (isSystem: false), user count showing 0.
