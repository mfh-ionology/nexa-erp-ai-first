# Visual Checkpoint Manifest — Journey 7: Toast for URGENT/HIGH Priority Notifications

## Checkpoint 1: Dashboard loaded with bell icon visible
- **When**: After login, dashboard loaded with WebSocket mock connected
- **Screenshot**: `step-2-bell-icon-ws-connected.png`
- **What to look for**: Header bar visible with purple "N" logo, search bar, notification bell icon. Bell icon should be present (NotificationProvider is active). Badge may or may not show depending on seeded notifications. No errors or broken layout.

## Checkpoint 2: Sonner toast visible for URGENT notification
- **When**: After injecting URGENT notification via mocked WebSocket
- **Screenshot**: `step-4-toast-urgent-notification.png`
- **What to look for**: Sonner toast notification visible (top-right area per `position="top-right"` in App.tsx). Toast should show the notification title ("Urgent: System Alert") and description body text. An action button (e.g., "View") should be present on the toast. Bell icon badge count should have incremented by 1 compared to the pre-injection state.

## Checkpoint 3: Badge count incremented
- **When**: After toast verification, confirming badge update
- **Screenshot**: `step-5-badge-count-incremented.png`
- **What to look for**: Bell icon badge (red destructive background) showing a number that is exactly 1 more than the initial count. If initial count was 0, badge should now show "1". The badge may have the bounce animation class.
