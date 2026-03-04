# Visual Checkpoint Manifest — Journey 12: Create a Scheduled Automation with Steps

## Checkpoint 1: Automation list page loaded
- **When:** After navigating to /ai/admin/automations
- **Screenshot file:** step-1-automation-list-page.png
- **What to look for:** T1 Entity List with seeded 'Daily AR Aging Summary' automation visible. Columns: name (bold), trigger type badge (purple 'Scheduled'), schedule (human-readable), step count, last run status, last run time, active toggle. "New Automation" button visible in action bar.

## Checkpoint 2: Automation builder in create mode
- **When:** After clicking "New Automation" button
- **Screenshot file:** step-2-automation-builder-create.png
- **What to look for:** Automation builder page with sections: Basic Config (name, description fields), Trigger Config (radio group: Scheduled/Event/Manual), Steps section (empty), Budget section. Action bar with Save and Cancel buttons.

## Checkpoint 3: Cron builder visible after selecting Scheduled
- **When:** After selecting "Scheduled" radio button in trigger type
- **Screenshot file:** step-4-cron-builder-visible.png
- **What to look for:** CronBuilder component with preset buttons (including 'Weekly on Monday'), field selectors (minute, hour, day-of-month, month), day-of-week checkboxes, raw expression input, timezone dropdown defaulting to Europe/London.

## Checkpoint 4: Weekly Monday preset applied
- **When:** After clicking "Weekly on Monday" preset button
- **Screenshot file:** step-5-weekly-monday-preset.png
- **What to look for:** Cron fields updated, "Weekly on Monday" preset highlighted in purple. Human-readable preview showing 'At 9:00 AM, on Monday' or similar. Timezone showing Europe/London.

## Checkpoint 5: First step card added
- **When:** After clicking "Add Step" button
- **Screenshot file:** step-6-first-step-added.png
- **What to look for:** Step 1 card with step number badge '1', agent dropdown, goal textarea, max turns field, collapsible input/output config panels, delete button.

## Checkpoint 6: Two step cards with connector
- **When:** After adding Step 2
- **Screenshot file:** step-8-two-steps-connected.png
- **What to look for:** Two step cards connected by vertical line, Step 2 with badge '2', empty agent/goal fields, 'Use Previous Step Output' button visible on Step 2.

## Checkpoint 7: Automation saved successfully
- **When:** After clicking Save
- **Screenshot file:** step-12-automation-saved.png
- **What to look for:** Success toast 'Automation created' or similar. Page showing saved automation with all configuration: 2 steps, scheduled trigger, cron schedule, budget values.
