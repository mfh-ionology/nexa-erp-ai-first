# Journey 11: Preview a Template as PDF — Visual Checkpoints

## CP-1: Preview panel initial state
- **When**: After step 4 — detail view loaded, preview panel visible
- **Screenshot**: `step-4-preview-initial-state.png`
- **What to look for**: Dashed border container in right column. Eye icon centered. Text: "Click 'Generate Preview' to see a PDF preview with sample data." Purple "Generate Preview" button visible with Eye icon. Template name heading "E2E Test Invoice Template" visible above. Template info card showing document type, page size, status, version count.

## CP-2: Loading state during PDF generation
- **When**: After step 5 — Generate Preview clicked, PDF generating
- **Screenshot**: `step-5-generating-preview.png`
- **What to look for**: Purple (#7c3aed) spinner animation in the preview area. Text "Generating PDF preview..." below spinner. Generate Preview button area should show "Generating..." text with spinner icon and be disabled.

## CP-3: PDF preview rendered with controls
- **When**: After step 6 — PDF successfully generated and displayed
- **Screenshot**: `step-6-pdf-preview-rendered.png`
- **What to look for**: PDF iframe visible showing rendered content (may show PDF viewer chrome or "INVOICE" heading depending on browser). Three control buttons below iframe: "Download" (with download icon), "Open in New Tab" (with external link icon), "Print" (with printer icon). "Regenerate" outline button in header replaces "Generate Preview" button. No error states visible.

## CP-4: Control buttons verification
- **When**: After step 7-9 — verifying all three action buttons
- **Screenshot**: `step-9-controls-visible.png`
- **What to look for**: All three control buttons (Download, Open in New Tab, Print) are visible and appear interactive (not disabled/greyed out). Buttons styled as outline variant with icons. Regenerate button still visible in header area.
