# Visual Checkpoint Manifest — Journey 20: DLQ Rejects Unauthenticated Requests

## Checkpoint 1: Unauthenticated DLQ Access Redirect
- **When**: After navigating to /system/dead-letter-queue without being logged in
- **Screenshot file**: step-1-unauthenticated-dlq-redirect.png
- **What to look for**:
  - Login page is displayed (user was redirected from /system/dead-letter-queue)
  - OR an error page showing 'Unauthorized' / '401' message
  - Dead Letter Queue data (table, entries, filters) is NOT visible
  - URL should be /login (redirect) or show unauthorized state
  - No DLQ-related content (event names, error details, retry counts) is leaked
