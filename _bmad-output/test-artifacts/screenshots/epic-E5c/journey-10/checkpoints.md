# Journey 10: Create Scheduled Automation with Steps — Visual Checkpoints

## Checkpoint 1: Automation List Page
- **When:** After navigating to /ai/admin/automations (Step 1)
- **Screenshot:** `step-01-automation-list.png`
- **What to look for:** T1 Entity List with "Automations" heading. Table columns: name (bold), trigger type badge (purple Scheduled/blue Event/amber Chain/grey Manual), schedule, step count (mono), last run status, last run time, active toggle. At least 1 seeded automation ("Daily AR Aging Summary") visible. "New Automation" button in action bar.

## Checkpoint 2: Automation Builder Initial State
- **When:** After clicking "New Automation" and /ai/admin/automations/new loads (Step 2)
- **Screenshot:** `step-02-automation-builder.png`
- **What to look for:** "New Automation" heading. Form cards: Basic Configuration (Name, Description), Trigger Configuration (radio: Scheduled/Event/Manual), Steps ("Add Step" button), Chain Configuration, Notifications, Budget & Limits. Cancel and Save buttons in action bar.

## Checkpoint 3: Cron Builder with Weekdays Preset
- **When:** After selecting "Scheduled" trigger and clicking "Weekdays at 9 AM" preset (Steps 4-5)
- **Screenshot:** `step-05-cron-weekdays.png`
- **What to look for:** CronBuilder visible with preset buttons. Minute=0, Hour=9 selected. Day-of-week: Mon-Fri checked, Sat/Sun unchecked. Raw expression "0 9 * * 1-5". Human-readable preview. Timezone default "Europe/London".

## Checkpoint 4: First Step Configured
- **When:** After adding Step 1 and filling agent + goal (Steps 6-7)
- **Screenshot:** `step-07-first-step.png`
- **What to look for:** Step card with purple "1" badge, agent dropdown showing "general-analyst" selected, goal textarea filled with analysis prompt including {{company.name}}. "Add Step" dashed button below. Drag handle and delete button visible.

## Checkpoint 5: Two Steps with Input Chaining
- **When:** After configuring Step 2 with "Use Previous Step Output" (Step 11)
- **Screenshot:** `step-11-two-steps-chained.png`
- **What to look for:** Two step cards (badges "1" and "2") connected by vertical line. Step 2: "communication-drafter" agent, email goal. Input Configuration expanded with JSON referencing PREVIOUS_STEP from step 1. "Add Step" button below both steps.

## Checkpoint 6: Automation Created Toast
- **When:** After clicking Save (Step 13)
- **Screenshot:** `step-13-save-success.png`
- **What to look for:** Success toast "Automation created". Page shows saved automation with name "E2E Weekly Summary", scheduled trigger with cron preview, 2 steps with agents and goals, budget values (30000 tokens, 180s duration).

## Checkpoint 7: New Automation in List
- **When:** After navigating back to /ai/admin/automations (Step 14)
- **Screenshot:** `step-14-in-list.png`
- **What to look for:** "E2E Weekly Summary" visible in list with purple "Scheduled" badge, "2" step count (mono), active toggle on. Alongside seeded "Daily AR Aging Summary".
