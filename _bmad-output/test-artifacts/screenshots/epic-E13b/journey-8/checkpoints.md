# Journey 8: Toggle Module Overrides and Feature Flags — Visual Checkpoints

## CP1: Modules & Flags Tab Loaded
- **When**: After clicking the "Modules & Flags" tab on the tenant detail page
- **Screenshot file**: `01-modules-flags-tab-loaded.png`
- **What to look for**: Two distinct sections visible — "Module Overrides" with a list of 11 MVP modules each with a toggle switch and Inherited/Override badge, and "Feature Flags" section below (either with flag toggles or an empty state message)

## CP2: Module Toggle Changed — Toast Confirmation
- **When**: After toggling a module switch (e.g. manufacturing) and the API call completes
- **Screenshot file**: `02-module-toggle-toast.png`
- **What to look for**: Success toast visible confirming module change (e.g. 'Module "manufacturing" enabled/disabled'), toggle switch reflects new state, module badge may change from "Inherited" to "Override"

## CP3: Feature Flag Toggle — Toast Confirmation
- **When**: After toggling a feature flag switch and the API call completes
- **Screenshot file**: `03-feature-flag-toggle-toast.png`
- **What to look for**: Success toast visible confirming feature flag change (e.g. 'Feature flag "..." enabled/disabled'), toggle switch reflects new state

## CP4: Feature Flags Empty State (conditional)
- **When**: If no feature flags are configured for the tenant
- **Screenshot file**: `04-feature-flags-empty-state.png`
- **What to look for**: Empty state message "No feature flags configured for this tenant." in a dashed border container
