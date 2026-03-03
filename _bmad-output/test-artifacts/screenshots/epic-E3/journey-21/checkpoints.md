# Visual Checkpoints — Journey 21: Dead Letter Queue Rejects Users Without Permission

## Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email input, password input, and Sign In button

## Checkpoint 2: Sales User Dashboard After Login
- **When**: After sales user successfully logs in (Step 3)
- **Screenshot file**: step-3-sales-user-dashboard.png
- **What to look for**: Dashboard loaded for sales user. Sidebar should NOT show Dead Letter Queue link (sales user lacks system.dead-letter-queue.list permission). If sidebar shows System section, DLQ should be absent.

## Checkpoint 3: DLQ Access Denied (403 Forbidden)
- **When**: After navigating directly to /system/dead-letter-queue as sales user (Step 4)
- **Screenshot file**: step-4-dlq-forbidden-403.png
- **What to look for**: Error page or toast showing 'Forbidden' / 'You do not have permission to access this resource' / '403'. DLQ data table is NOT displayed. May redirect to an error page or show inline forbidden message.
