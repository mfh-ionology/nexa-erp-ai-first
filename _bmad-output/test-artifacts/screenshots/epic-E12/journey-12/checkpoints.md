# Visual Checkpoints — Journey 12: Preview a Specific Template Version

## CP-1: Detail view with versions section
- **When**: After step 2 — clicking 'E2E Test Invoice Template' card to enter detail view
- **Screenshot file**: step-2-detail-view-versions.png
- **What to look for**: Detail view showing template name heading 'E2E Test Invoice Template'. A versions section visible listing at least one version (French locale). Version card shows locale identifier 'fr' or 'French'.

## CP-2: Version overflow menu open
- **When**: After step 3 — clicking three-dot overflow menu on French version card
- **Screenshot file**: step-3-version-overflow-menu.png
- **What to look for**: Dropdown/popover menu visible with options including 'Preview'. Menu positioned near the French version card. Other options may include Edit, Delete.

## CP-3: PDF preview with French version content
- **When**: After step 5 — verifying the PDF preview iframe loaded with French version overrides
- **Screenshot file**: step-5-pdf-preview-french.png
- **What to look for**: PDF rendered in an iframe. 'FACTURE' heading visible (French for Invoice). French field labels like 'Facture:', 'Date:', 'Client:'. Sample data rendered correctly. This confirms version-specific overrides are applied.
