# Journey 16: WebSocket Real-Time Notification Delivery — Visual Checkpoints

## Checkpoint 1: Initial Bell State
- **When**: After login, dashboard loaded, before triggering notification
- **Screenshot**: `step-2-initial-bell-state.png`
- **What to look for**: Header with notification bell icon visible. Record the current badge count (number in red badge) or confirm no badge is showing (zero unread). This establishes baseline for verifying increment.

## Checkpoint 2: Badge Count After WebSocket Delivery
- **When**: After NORMAL priority notification injected via mocked WebSocket, badge count should increment
- **Screenshot**: `step-4-badge-incremented-no-toast.png`
- **What to look for**: Bell icon badge count has incremented by 1 from baseline. NO toast notification visible anywhere on screen (NORMAL priority = silent badge update only, no Sonner toast). This confirms the WebSocket event was received and processed by the store.

## Checkpoint 3: Dropdown Shows New Notification at Top
- **When**: After clicking bell icon to open the notification dropdown
- **Screenshot**: `step-5-dropdown-new-notification-top.png`
- **What to look for**: Notification dropdown/popover is open. The newest notification (the one we injected) appears at the TOP of the list with: blue unread dot, bold title text, body preview, 'just now' relative timestamp, and a colored left border matching NORMAL priority (blue border). Other notifications (if any) appear below it.
