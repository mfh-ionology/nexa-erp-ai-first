# Journey 12: Responsive Email Dialog Layout — Visual Checkpoints

## Checkpoint 1: Desktop Dialog (1280x720)
- **When**: After opening email dialog at desktop viewport
- **Screenshot**: `step-3-desktop-dialog-1280x720.png`
- **What to look for**: 600px wide centered modal dialog, all form fields (From, To, Subject, Body, Attachment) visible without scrolling, purple accent top border, Concept D styling, proper spacing

## Checkpoint 2: Tablet Dialog (800x600)
- **When**: After resizing viewport to 800x600 and verifying dialog adapts
- **Screenshot**: `step-4-tablet-dialog-800x600.png`
- **What to look for**: Dialog fills approximately 90% of 800px viewport width (~720px), all fields still usable and visible, no horizontal overflow, dialog may require vertical scrolling but fields are not clipped

## Checkpoint 3: Mobile Dialog (375x667)
- **When**: After resizing viewport to 375x667 mobile size
- **Screenshot**: `step-5-mobile-dialog-375x667.png`
- **What to look for**: Full-screen or near-full-screen bottom sheet layout, form fields stacked vertically, Send Email button fixed at bottom of screen, scrollable content area, no horizontal overflow or cut-off content
