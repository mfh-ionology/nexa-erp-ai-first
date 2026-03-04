# Journey 6: Prompt Versioning — Edit, Diff, and Restore
## Visual Checkpoint Manifest

### Checkpoint 1: Prompt Editor Loaded with Existing Data
- **When**: After step 2 — clicking 'test-invoice-reminder' row in prompt list
- **Screenshot file**: `step-2-prompt-editor-loaded.png`
- **What to look for**:
  - Editor page shows 'test-invoice-reminder' as the prompt name
  - Version sidebar visible on right side showing 'Version History' heading
  - v1 entry in sidebar with purple left border and 'Active' badge
  - System prompt textarea populated with existing prompt text
  - Save button visible but disabled (form not dirty)

### Checkpoint 2: Change Reason Modal Appears
- **When**: After step 4 — clicking Save after editing system prompt
- **Screenshot file**: `step-4-change-reason-modal.png`
- **What to look for**:
  - Modal dialog overlay visible
  - Title: 'Save Prompt Changes'
  - Description: 'Describe what changed in this version'
  - Textarea for change reason (empty, autofocused)
  - Cancel and Save buttons visible
  - Save button disabled (no reason entered yet)

### Checkpoint 3: Version 2 Created Successfully
- **When**: After step 6 — saving with change reason
- **Screenshot file**: `step-6-version-2-created.png`
- **What to look for**:
  - Success toast visible
  - Version sidebar now shows v2 with purple left border and 'Active' badge
  - v1 listed below v2 without Active badge
  - Change reason text visible on v2 entry
  - Updated system prompt text in the editor

### Checkpoint 4: Diff View Between v1 and v2
- **When**: After step 7 — clicking v1 in version sidebar
- **Screenshot file**: `step-7-diff-view-shown.png`
- **What to look for**:
  - Diff view section visible below version list
  - Heading: 'Changes: v1 vs current'
  - System Prompt diff showing removed lines in red (-) and added lines in green (+)
  - 'Restore This Version' button visible at bottom of diff section

### Checkpoint 5: Version 3 Restored from v1
- **When**: After step 9 — clicking Restore This Version
- **Screenshot file**: `step-9-version-3-restored.png`
- **What to look for**:
  - Success toast: 'Version restored. Now active: v3'
  - Version sidebar shows v3 with Active badge and change reason 'Restored from version 1'
  - v2 and v1 listed below v3 without Active badges
  - System prompt reverted to original v1 content
