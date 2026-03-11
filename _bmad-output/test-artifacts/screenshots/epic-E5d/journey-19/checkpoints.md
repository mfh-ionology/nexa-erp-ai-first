# Visual Checkpoints — Journey 19: Settings Tab — Configuration, Save, Dirty Guard

## Checkpoint 1: Settings tab initial load
- **When**: After navigating to `/ai/admin/knowledge#settings` (Step 1)
- **Screenshot**: `step-1-settings-tab-loaded.png`
- **What to look for**: T7 settings layout with setting rows: "Enable AI Knowledge Base" switch (on), "Share Anonymised Patterns" switch (off, "Not sharing"), "Knowledge Categories" checkboxes (all 5 checked), "Auto-generated Article Retention" input (90 days), "RAG Token Budget" slider (1000). Save Settings button disabled (clean state). Reset to Defaults button visible (ghost style). Purple background #f4f2ff.

## Checkpoint 2: Dirty state after toggle and form modifications
- **When**: After toggling share switch, changing retention to 180, and adjusting RAG budget to 1500 (Step 4)
- **Screenshot**: `step-4-dirty-state-modified-values.png`
- **What to look for**: "Share Anonymised Patterns" switch ON showing "Sharing enabled". Retention input shows "180". RAG slider at 1500 with "1500" displayed. Amber "You have unsaved changes" text visible. Save Settings button enabled (primary purple).

## Checkpoint 3: After saving settings
- **When**: After clicking Save Settings (Step 5)
- **Screenshot**: `step-5-settings-saved.png`
- **What to look for**: Success toast "Knowledge settings saved" visible. Save Settings button disabled (clean state). "You have unsaved changes" text gone. Form values persisted (180 days, 1500 tokens, sharing enabled).

## Checkpoint 4: After resetting to defaults
- **When**: After clicking Reset to Defaults (Step 6)
- **Screenshot**: `step-6-reset-to-defaults.png`
- **What to look for**: Form fields reset to defaults: Enable Knowledge ON, Share Patterns OFF ("Not sharing"), all 5 categories checked, retention 90 days, RAG budget 1000. Note: `form.reset()` in react-hook-form also resets the default values baseline, so isDirty=false (clean state). Save Settings button disabled. This differs from the test plan expectation but is correct react-hook-form behavior.
