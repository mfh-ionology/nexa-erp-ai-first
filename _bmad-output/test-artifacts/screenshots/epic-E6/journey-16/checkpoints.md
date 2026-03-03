# Visual Checkpoints — Journey 16: Configure Field Overrides on Access Group

## Checkpoint 1: Field Overrides Tab — Empty State (No Resource Selected)
- **When**: After clicking the "Field Overrides" tab on access group detail page (Step 3)
- **Screenshot file**: step-3-field-overrides-empty-state.png
- **What to look for**:
  - "Field Overrides" tab is active/selected
  - Resource selector combobox visible showing placeholder "Select resource…"
  - Empty state card with text "Select a resource to configure field visibility overrides"
  - No override table visible
  - No "Save Field Overrides" button visible (only shown after resource is selected)

## Checkpoint 2: Resource Selector Combobox — Open with Grouped Resources
- **When**: After clicking the resource selector combobox (Step 4)
- **Screenshot file**: step-4-resource-combobox-open.png
- **What to look for**:
  - Popover/dropdown is open showing searchable list
  - Resources grouped by module headers (alphabetically sorted)
  - Each resource shows name and code
  - Search input at top with placeholder "Search resources…"
  - No resource has a check mark (none selected yet)

## Checkpoint 3: Resource Selected — Empty Override Table
- **When**: After selecting a resource (e.g., "Sales Orders") from the combobox (Step 5)
- **Screenshot file**: step-5-resource-selected-empty-overrides.png
- **What to look for**:
  - Selected resource name displayed in the combobox trigger button
  - Card shows "No field overrides configured for this resource"
  - "Add Field Override" button visible inside the empty state card
  - "Save Field Overrides" button NOT visible (no overrides exist yet, so no dirty state)

## Checkpoint 4: New Override Row Added
- **When**: After clicking "Add Field Override" button (Step 6)
- **Screenshot file**: step-6-new-override-row.png
- **What to look for**:
  - Table now visible with columns: Field Path, Visibility
  - New row with empty field path input (should be auto-focused)
  - Visibility dropdown showing "Visible" (default)
  - Remove (X) button on the row
  - Field path input has placeholder "e.g., costPrice"
  - "Save Field Overrides" button visible but disabled (empty field path = validation error)

## Checkpoint 5: Visibility Changed to Hidden
- **When**: After filling field path "costPrice" and changing visibility to "Hidden" (Step 9)
- **Screenshot file**: step-9-visibility-hidden.png
- **What to look for**:
  - Row shows: Field Path = "costPrice", Visibility = "Hidden"
  - "Save Field Overrides" button is now enabled (dirty state, valid data)
  - No validation errors visible

## Checkpoint 6: Save Success — Toast and Final State
- **When**: After clicking "Save Field Overrides" and receiving success response (Step 10)
- **Screenshot file**: step-10-save-success.png
- **What to look for**:
  - Success toast visible with text "Field overrides saved successfully"
  - "Save Field Overrides" button returns to disabled state (no longer dirty)
  - Override row persists showing costPrice = Hidden
  - No error messages
