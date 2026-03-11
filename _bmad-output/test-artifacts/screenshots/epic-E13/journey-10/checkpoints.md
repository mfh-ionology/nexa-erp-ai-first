# Visual Checkpoints — Journey 10: Loading Skeleton and Error State

## Checkpoint 1: Skeleton Loading State
- **When**: Immediately after navigation while API request is in-flight (intercepted with delay)
- **Screenshot file**: step-2-skeleton-loading-state.png
- **What to look for**: Print Preferences page with skeleton loading placeholders visible. 6 rows of animated skeleton rectangles — left side `h-4 w-36` for labels, right side `h-9 w-44 rounded-md` for dropdowns. Page header and description may be visible. No actual document type names or select dropdowns yet.

## Checkpoint 2: Fully Loaded Preference Table
- **When**: After API response completes and skeletons are replaced by real data
- **Screenshot file**: step-3-table-fully-loaded.png
- **What to look for**: Preference table with all 14 document type rows visible. Each row has a document type label on the left and a Select dropdown on the right. Column headers "Document Type" and "My Preference" visible. fadeInUp animation applied. Card has 12px radius and proper Concept D styling with #f4f2ff background.
