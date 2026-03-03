# Visual Checkpoint Manifest — Journey 15: Run Duplicate Detection for Customers

## Checkpoint 1: Duplicate Detection Page Loaded
- **When**: After navigating to `/ai/predictions/duplicates` and page loads (Step 1)
- **Screenshot file**: `step-1-duplicate-detection-page.png`
- **What to look for**:
  - Page heading contains "Duplicate" or "Duplicate Detection"
  - Entity Type selector (dropdown) visible with options: Customer, Supplier, Contact
  - Minimum Similarity threshold input visible (slider or number, default 70%)
  - Results Limit input visible (number input, default 20)
  - "Scan for Duplicates" button visible and enabled

## Checkpoint 2: Duplicate Scan Results Displayed
- **When**: After clicking "Scan for Duplicates" and results load (Step 3)
- **Screenshot file**: `step-3-duplicate-scan-results.png`
- **What to look for**:
  - Summary header visible (e.g., "Scanned 150 customers — 3 potential duplicate pairs found")
  - Duplicate pair cards displayed, each showing two entities side-by-side
  - Overall similarity score visible on each card with confidence colour coding (green >=90%, amber 70-89%, red <70%)
  - Field-by-field comparison table showing: field name, value A, value B, per-field similarity score
  - Fields compared include: name, address, VAT number, bank details, email, phone
  - High-similarity fields highlighted or visually distinguished

## Checkpoint 3: Field Comparison Detail
- **When**: After verifying field-by-field comparison table exists (Step 4)
- **Screenshot file**: `step-4-field-comparison-detail.png`
- **What to look for**:
  - At least one duplicate pair card expanded or visible with detailed field comparison
  - Comparison table rows for: Company Name, Address, VAT Number, Email, Phone
  - Per-field similarity scores (0.0-1.0) displayed alongside each field comparison
  - High-similarity fields visually highlighted (bold, coloured, or marked)
