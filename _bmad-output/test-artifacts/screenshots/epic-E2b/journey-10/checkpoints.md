# Journey #10: Assign Access Groups to a User — Visual Checkpoints

## Checkpoint 1: User Detail Page with Current Access Groups
- **When**: After step 2 — clicking on sales@nexa-test.co.uk user row
- **Screenshot file**: step-2-user-detail-sales-access-groups.png
- **What to look for**: T2 Record Detail page for the sales user. Should display user info (email: sales@nexa-test.co.uk, role: STAFF). Access Groups assignment panel visible showing SALES_STAFF as a tag/chip. The page title/heading should indicate this is a user detail view.

## Checkpoint 2: Access Groups Saved Successfully
- **When**: After step 6 — clicking Save after assigning both SALES_STAFF and QA_TESTER
- **Screenshot file**: step-6-access-groups-save-success.png
- **What to look for**: Green success toast message visible with text like "Access groups updated". The Access Groups panel should now show both SALES_STAFF and QA_TESTER as assigned groups (tags/chips). Each assignment should display assignedBy and assignedAt metadata.

## Checkpoint 3: Access Groups Persisted After Reload
- **When**: After step 8 — re-navigating to the same user detail page
- **Screenshot file**: step-8-access-groups-persisted.png
- **What to look for**: User detail page reloaded for sales@nexa-test.co.uk. Access Groups panel still shows both SALES_STAFF and QA_TESTER groups assigned, confirming persistence. This verifies the PUT replace-all assignment was stored correctly in the database.
