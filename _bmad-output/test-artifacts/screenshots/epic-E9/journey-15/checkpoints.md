# Journey 15: Role Switch With Unsaved Changes Guard — Visual Checkpoints

## Checkpoint 1: Role defaults section loaded with dirty toggle
- **When**: After Step 2 — admin toggles a switch in Role Defaults matrix
- **Screenshot file**: `step-2-toggle-dirty-state.png`
- **What to look for**: Role Defaults section visible with STAFF selected in role dropdown. One toggle has been changed. Amber warning triangle (AlertTriangle icon) visible as a dirty indicator (role="status"). Save Role Defaults button is enabled (purple, not greyed out).

## Checkpoint 2: Unsaved changes guard dialog on role switch
- **When**: After Step 3 — admin tries to switch role while dirty state exists
- **Screenshot file**: `step-3-unsaved-guard-dialog.png`
- **What to look for**: AlertDialog modal overlay visible. Title references switching roles. Description warns unsaved changes will be lost. Two buttons: "Cancel" (default style) and "Discard & Switch" (destructive red style). Background shows the notification preferences page dimmed behind the modal.

## Checkpoint 3: Guard dialog dismissed, changes preserved
- **When**: After Step 4 — admin clicks Cancel to stay on current role
- **Screenshot file**: `step-4-cancel-stays-on-staff.png`
- **What to look for**: Dialog closed. Role selector still shows "STAFF". Dirty indicator (amber triangle) still visible. The previously changed toggle still in its modified state. Save button still enabled.

## Checkpoint 4: Discard & Switch completes role change
- **When**: After Step 6 — admin confirms Discard & Switch to MANAGER
- **Screenshot file**: `step-6-switched-to-manager.png`
- **What to look for**: Role selector now shows "MANAGER". Matrix reloaded with MANAGER role defaults. No amber dirty indicator visible. Save button should be disabled (no unsaved changes for MANAGER). Changes to STAFF defaults were discarded.
