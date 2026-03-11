# Visual Checkpoints — Journey 7: Preference Cascade with Source Labels

## Checkpoint 1: Precondition Setup Complete
- **When**: After setting up company defaults (Sales Invoice = Auto-Download) and user preference (Purchase Order = Browser Print Dialog), page reloaded
- **Screenshot file**: step-setup-preconditions-complete.png
- **What to look for**: Print Preferences page loaded with admin view. Company Defaults section visible below. Sales Invoice company default shows Auto-Download PDF.

## Checkpoint 2: Source Labels Visible — Cascade Verification
- **When**: After step 6 — verifying all three cascade states on the reloaded page
- **Screenshot file**: step-6-cascade-source-labels.png
- **What to look for**:
  - Sales Invoice row shows "(company default)" label in small dimmed text below the document type name. The Select dropdown text should be dimmed (text-muted-foreground) showing "Auto-Download PDF".
  - Purchase Order row shows NO source label (user has set a personal preference). The Select dropdown text should be normal weight (text-foreground) showing "Browser Print Dialog".
  - P60 row shows "(system default)" label in small dimmed text below the document type name. The Select dropdown text should be dimmed showing "No Action".
  - Overall: preference table clearly distinguishes inherited vs user-set values through text color and source labels.
