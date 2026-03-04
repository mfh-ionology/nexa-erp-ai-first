# Journey 11 — Edit Skill and Test Trigger Phrase Routing — Visual Checkpoints

## Checkpoint 1: Skill Pack Manager loaded
- **When**: After step 1 — navigate to /ai/admin/skills
- **Screenshot file**: step-1-skill-pack-manager-loaded.png
- **What to look for**: Page heading "Skill Pack Manager", accordion groups with skill cards visible, "Test Trigger" and "Add Skill" buttons in action bar, search input present

## Checkpoint 2: Skill edit form opened with tabs
- **When**: After step 2 — click first skill card
- **Screenshot file**: step-2-skill-edit-form-tabs.png
- **What to look for**: Skill form page with heading showing skill display name, 4 tabs visible (Main, Triggers, Content, Schema), Main tab active by default showing fields: Name (mono), Display Name, Description, Category dropdown, Module Key, Pack Key, Output Type, Priority, Version (read-only), Active toggle

## Checkpoint 3: Triggers tab with phrase pills
- **When**: After step 3 — click Triggers tab
- **Screenshot file**: step-3-triggers-tab-pills.png
- **What to look for**: Triggers tab active, trigger phrases displayed as blue pill tags with x remove buttons, negative triggers as red pills, context required as grey pills, tag input fields with Enter-to-add behaviour

## Checkpoint 4: New trigger phrase added
- **When**: After step 4 — add "check outstanding payments" phrase
- **Screenshot file**: step-4-trigger-phrase-added.png
- **What to look for**: New blue pill tag showing "check outstanding payments" added to the trigger phrases list

## Checkpoint 5: Content tab with mono textarea
- **When**: After step 5 — click Content tab
- **Screenshot file**: step-5-content-tab-textarea.png
- **What to look for**: Content tab active, large mono textarea (min-height 400px) showing skill content, character count displayed above

## Checkpoint 6: Skill saved successfully
- **When**: After step 6 — click Save button
- **Screenshot file**: step-6-skill-saved-success.png
- **What to look for**: Success toast/notification confirming skill was updated, or navigation back to list confirming save completed

## Checkpoint 7: Test Trigger panel opened
- **When**: After step 8 — click Test Trigger button on skill list page
- **Screenshot file**: step-7-test-trigger-panel-open.png
- **What to look for**: Sheet/panel slid in from right, title "Test Trigger Phrase", input field with placeholder about overdue invoices, "Test" button visible, empty results area

## Checkpoint 8: Test trigger routing results
- **When**: After step 10 — submit test phrase "show me overdue invoices"
- **Screenshot file**: step-8-test-trigger-results.png
- **What to look for**: L0 module routing result with matched module and confidence bar, L1 skill selection with matched skill name and confidence, L2 skill details showing required tools and content preview. Or "No matching skill found" with module suggestions. Response should appear within 3 seconds.
