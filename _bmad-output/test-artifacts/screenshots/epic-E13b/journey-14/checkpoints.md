# Visual Checkpoints — Journey 14: AI Quota Alerts and Spike Detection

## Checkpoint 1: Alerts Tab Loaded with Active Alerts
- **When**: After clicking Alerts tab (step 2)
- **Screenshot file**: `01-alerts-tab-loaded.png`
- **What to look for**: Alert list visible with type-specific styling:
  - quota_warning alerts: amber badge, warning icon
  - quota_exceeded alerts: red badge, alert icon
  - usage_spike alerts: purple badge, trending-up icon
  - Each alert shows tenant name, usage percentage, threshold, timestamp
  - Filter dropdowns visible (type filter + acknowledged filter)

## Checkpoint 2: Filtered to Usage Spike Only
- **When**: After selecting 'Usage Spike' in type filter dropdown (step 4)
- **Screenshot file**: `02-filtered-usage-spike.png`
- **What to look for**: Only usage_spike alerts shown with purple badges and trending-up icons. Other alert types (amber/red) should NOT be visible.

## Checkpoint 3: Alert Acknowledged
- **When**: After clicking Acknowledge on first alert (step 5)
- **Screenshot file**: `03-alert-acknowledged.png`
- **What to look for**: Alert either removed from active list or visually marked as acknowledged (opacity reduced, green check icon). List count should decrement by one.

## Checkpoint 4: Acknowledged Alerts View
- **When**: After switching acknowledged filter to 'Acknowledged' (step 6)
- **Screenshot file**: `04-acknowledged-alerts-view.png`
- **What to look for**: Acknowledged alerts visible, previously acknowledged alert appears with acknowledged status indicator (green check, "Acknowledged" text).
