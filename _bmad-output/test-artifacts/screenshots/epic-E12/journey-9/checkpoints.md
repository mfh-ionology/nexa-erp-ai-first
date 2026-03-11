# Journey 9: View Template Detail and Create a Version — Visual Checkpoints

## CP-1: Template Detail View Loaded
- **When**: After clicking 'E2E Test Invoice Template' card (Step 2)
- **Screenshot file**: step-2-template-detail-view.png
- **What to look for**: Detail view visible with template name "E2E Test Invoice Template", description, page settings summary (Document Type, Page Size, Status, Versions count). "Versions (0)" section with purple "Create Version" button. Empty state dashed border box with message about creating first version. Preview panel on the right. "Back to list" link and "Edit Template" button in header.

## CP-2: Version Editor Dialog Open
- **When**: After clicking "Create Version" button (Step 4)
- **Screenshot file**: step-4-version-editor-dialog.png
- **What to look for**: Modal dialog visible with title "Create Version". Selection Criteria section with 2-column grid: Language Code, Branch Code, Number Series ID, Access Group, Customer Group ID inputs. Collapsible override sections (HTML Override, CSS Override, Header Override, Footer Override). Email Settings section. Priority number input and Active toggle switch. Cancel and Create Version buttons at bottom.

## CP-3: Version Created Successfully
- **When**: After clicking Create button and dialog closes (Step 8)
- **Screenshot file**: step-8-version-created.png
- **What to look for**: Version editor dialog dismissed. Versions section now shows "(1)" count. New version card visible with: "Priority: 10" in JetBrains Mono font, green "Active" badge, selection criteria summary showing "Lang: fr, Branch: PARIS". Three-dot overflow menu (Version actions button) on version card.
