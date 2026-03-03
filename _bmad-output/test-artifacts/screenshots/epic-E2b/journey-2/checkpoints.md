# Visual Checkpoint Manifest — Journey 2: View System Resource Registry

## Checkpoint 1: Resource Registry Page Loaded
- **When**: After navigating to /system/resources (step 2)
- **Screenshot file**: step-2-resource-registry-page.png
- **What to look for**:
  - T1 Entity List page layout with "Resource Registry" heading
  - No [+ New] button (this is a read-only registry)
  - Table visible with columns: Code, Name, Module, Type, Sort Order
  - At least 6 rows of seeded system resources visible

## Checkpoint 2: Module Filter Applied
- **When**: After selecting "system" in the module filter dropdown (step 5)
- **Screenshot file**: step-5-module-filter-system.png
- **What to look for**:
  - Module filter dropdown showing "system" selected
  - Table filtered to show only system-module resources
  - All visible rows should have "system" in the Module column

## Checkpoint 3: Search Filter for "access"
- **When**: After typing "access" in search input (step 7)
- **Screenshot file**: step-7-search-access.png
- **What to look for**:
  - Search box contains "access"
  - Table filtered to show only resources matching "access"
  - Expected matches: system.access-groups.list, system.access-groups.detail
  - No unrelated resources visible in filtered results
