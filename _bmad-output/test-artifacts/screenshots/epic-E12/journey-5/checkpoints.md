# Journey 5: Filter Templates by Document Type — Visual Checkpoints

## Checkpoint 1: Page Load — Full Template List
- **When**: After navigating to /settings/document-templates and page loads
- **Screenshot file**: step-1-full-template-list.png
- **What to look for**: Page title "Document Templates" visible, filter bar with search input and document type dropdown showing "All Document Types", multiple accordion groups visible for different document types, template cards rendered in each group

## Checkpoint 2: Sales Invoice Filter Applied
- **When**: After selecting SALES_INVOICE from the document type dropdown (step 3)
- **Screenshot file**: step-3-sales-invoice-filtered.png
- **What to look for**: Only SALES_INVOICE accordion group visible, other document type groups hidden. Filter dropdown shows "Sales Invoice" as selected value with purple-tinted border/background indicating active filter. Template cards for sales invoices displayed in grid.

## Checkpoint 3: Purchase Order Filter Applied
- **When**: After changing filter to PURCHASE_ORDER (step 6)
- **Screenshot file**: step-6-purchase-order-filtered.png
- **What to look for**: Only PURCHASE_ORDER accordion group visible, SALES_INVOICE group gone. Filter dropdown shows "Purchase Order" as selected value. At least 1 template card visible for purchase orders.

## Checkpoint 4: Filters Cleared — Full List Restored
- **When**: After clicking clear filters button (step 7)
- **Screenshot file**: step-7-filters-cleared.png
- **What to look for**: Full template list restored with multiple document type accordion groups visible again. Filter dropdown reverted to "All Document Types". Same layout as checkpoint 1.
