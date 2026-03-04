# Visual Checkpoints — Journey 3: Click Notification to Mark as Read

## Checkpoint 1: Unread notification visible in dropdown
- **When**: After Step 3 — bell clicked and dropdown open, before clicking a notification
- **Screenshot file**: `step-3-unread-notification-in-dropdown.png`
- **What to look for**: Notification dropdown popover is open. First notification item has a blue unread dot (bg-blue-500 circle), bold/semibold title text, body preview text, and relative timestamp. Background of the unread item is slightly tinted (#faf9ff). A coloured left border indicates priority (red/amber/blue/gray).

## Checkpoint 2: Navigation after clicking notification
- **When**: After Step 4 — user clicks the first unread notification item
- **Screenshot file**: `step-4-navigated-after-click.png`
- **What to look for**: The notification dropdown has closed. The page has navigated to the entity's actionUrl (e.g., an invoice or sales order detail page). The URL has changed from the dashboard. If actionUrl doesn't exist, the dropdown may still be open but notification state changed.

## Checkpoint 3: Notification now shows as READ in dropdown
- **When**: After Step 5 — bell icon clicked again to reopen dropdown
- **Screenshot file**: `step-5-notification-marked-as-read.png`
- **What to look for**: Dropdown is open again. The previously clicked notification is now in READ state: no blue dot, normal font weight (not bold), muted text colour. The unread badge count on the bell icon should have decreased by 1 compared to before the click.
