# Visual Checkpoints — Journey 9: Browse Resource Registry with Filters

## Checkpoint 1: Resource Registry Page Loaded
- **When**: After navigating to /system/resources and page loads
- **Screenshot file**: step-1-resource-registry-loaded.png
- **What to look for**:
  - Page title "Resource Registry" visible
  - Breadcrumbs showing "System > Resource Registry"
  - Data table with columns: Code, Name, Module, Type, Sort Order
  - NO [+ New] button visible anywhere (read-only page)
  - Module and Type filter dropdowns visible in toolbar
  - Search input visible

## Checkpoint 2: Module Filter Dropdown Open
- **When**: After clicking the Module filter dropdown
- **Screenshot file**: step-3-module-dropdown-open.png
- **What to look for**:
  - Module filter dropdown is open
  - Shows "All Modules" option plus module names: System, Finance, Accounts Receivable, Accounts Payable, Sales, Purchasing, Inventory, CRM, HR & Payroll, Manufacturing, Reporting

## Checkpoint 3: Filtered by Finance Module
- **When**: After selecting "Finance" from the Module dropdown
- **Screenshot file**: step-4-filtered-finance-module.png
- **What to look for**:
  - Data table shows only rows where Module column displays "Finance"
  - Module filter dropdown shows "Finance" as selected value
  - Type filter still shows "All Types"

## Checkpoint 4: Filtered by Finance + PAGE Type
- **When**: After selecting "PAGE" from the Type dropdown (on top of Finance module filter)
- **Screenshot file**: step-6-filtered-finance-page.png
- **What to look for**:
  - Table shows only resources where Module=Finance AND Type=Page
  - Module filter shows "Finance" selected
  - Type filter shows "Page" selected
  - Both filters applied with AND logic

## Checkpoint 5: Search Results for "journal"
- **When**: After typing "journal" in the search input (with 300ms debounce)
- **Screenshot file**: step-7-search-journal.png
- **What to look for**:
  - Search input contains "journal" text
  - Table shows resources matching "journal" within the Finance/PAGE context
  - Results are narrowed further by the search term
