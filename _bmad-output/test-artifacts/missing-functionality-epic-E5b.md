# Missing Functionality - Epic E5b

> Auto-generated during frontend E2E testing

## Missing: Memory settings panel not visible on empty-state Memory page
- **Journey**: Journey 2 (Memory Management Page Load & Layout), Step 3
- **Expected**: Settings panel should render with "Enable AI Memory" toggle, category checkboxes (Preferences, Instructions, Workflows, Decisions, Entity Context), retention period selector, and "Forget Everything" button — even when no memories exist. The code at `memory-page.tsx:306` renders `{settings && <MemorySettingsPanel/>}` in the empty-state branch.
- **Actual**: Settings panel does not render. The `settings` variable is falsy, meaning the GET /ai/memories/settings API endpoint is not returning data (either the endpoint is not implemented, not connected, or memory settings have not been seeded for the test user).
- **Related Story**: E5b-5 (AC2 — Memory settings controls)
- **Suggested Story Title**: Ensure memory settings API returns default settings for new users

## Missing: Memory seed data not present for full page layout verification
- **Journey**: Journey 2 (Memory Management Page Load & Layout), Steps 4-6
- **Expected**: Memory list with 10+ memories across 5 categories (PREFERENCE, WORKFLOW, DECISION, INSTRUCTION, ENTITY_CONTEXT) with stats panel showing totals and source breakdown, search input, category filter pills, and grouped accordion sections with memory cards
- **Actual**: Empty state shown ("No memories yet") — no memories exist in the database for the test user. Stats panel, search input, filter pills, and memory cards could not be verified.
- **Related Story**: E5b-5 (AC3 — Stats display, AC4 — Search/filter, AC8 — Category grouping, AC13 — Skeleton/empty states)
- **Suggested Story Title**: Seed AI memory test data for E2E testing (prerequisite for frontend test plan)

## Missing: Memory settings toggle controls not testable — settings panel not rendered
- **Journey**: Journey 3 (Toggle Memory Settings), Steps 2-6
- **Expected**: Settings panel with "Enable AI Memory" toggle switch, 5 category checkboxes (Preferences, Workflows, Decisions, Instructions, Entity Context), and retention period selector should be visible. Toggle OFF should disable checkboxes and retention selector. Toggle ON should re-enable them. Category checkboxes should toggle between checked/unchecked states. Retention selector should allow changing to 90 days.
- **Actual**: The settings panel does not render because `GET /ai/memories/settings` returns no data (settings query `data` is falsy). The frontend component code is correctly implemented in `memory-settings-panel.tsx` with all required controls, but the conditional rendering `{settings && <MemorySettingsPanel/>}` prevents it from appearing. The Memory page shows only the "No memories yet" empty state.
- **Related Story**: E5b-5 (AC2 — Memory enable/disable toggle with optimistic updates)
- **Suggested Story Title**: Ensure memory settings API auto-creates default settings on first access

## Missing: Search and filter UI not rendered — no seeded memory data (blocks Journey 4 entirely)
- **Journey**: Journey 4 (Search and Filter Memories), Steps 1-5
- **Expected**: Memory page should show search input ("Search memories..."), category filter pills (Preferences, Instructions, Workflows, Decisions, Entity Context), and grouped memory cards. Typing "invoice" should filter to matching memories. Clicking a category pill should further filter. Clearing search should show all memories in the active category. Typing a non-matching term should show "No memories match your search" empty state.
- **Actual**: Memory page shows global empty state ("No memories yet") with no search input, no filter pills, and no memory cards. The search/filter UI is conditionally rendered only when memories exist (the `filteredMemories` / `groupedMemories` arrays must be non-empty). All 5 steps of this journey could not be tested.
- **Related Story**: E5b-5 (AC4 — Client-side search and category filtering)
- **Suggested Story Title**: Seed AI memory test data for E2E testing (10+ memories across 5 categories — prerequisite for Journeys 4-8)

## Missing: Edit Memory flow untestable — no seeded memory data (blocks Journey 5 entirely)
- **Journey**: Journey 5 (Edit an Existing Memory), Steps 1-4
- **Expected**: Memory page should display memory cards. Clicking the pencil/edit icon on a card should open an "Edit Memory" dialog with a pre-filled textarea. Editing the content and clicking Save should close the dialog, update the card content optimistically, and show a "Memory updated" success toast.
- **Actual**: Memory page shows empty state ("No memories yet") — no AI memories exist in the database. Without any memory cards, the edit button cannot be clicked and the entire edit flow cannot be tested. The test was skipped with the annotation: "PREREQUISITE NOT MET: No AI memories seeded."
- **Related Story**: E5b-5 (AC5 — Edit memory content with optimistic update)
- **Suggested Story Title**: Seed AI memory test data for E2E testing (10+ memories across 5 categories — prerequisite for Journeys 4-8)

## Missing: Delete Single Memory flow untestable — no seeded memory data (blocks Journey 6 entirely)
- **Journey**: Journey 6 (Delete a Single Memory), Steps 1-4
- **Expected**: Memory page should display memory cards grouped by category with count badges. Clicking the trash icon on a memory card should open a delete confirmation AlertDialog with "Delete Memory" title, "Delete this memory? This action cannot be undone." description, memory content excerpt, red "Delete" button and "Cancel" button. Confirming should close the dialog, remove the card with animation, show "Memory deleted" success toast, and decrement the category count badge.
- **Actual**: Memory page shows empty state ("No memories yet") — no AI memories exist in the database. Without any memory cards, the delete button cannot be clicked and the entire delete flow cannot be tested. The test was skipped with annotation: "PREREQUISITE NOT MET: No AI memories seeded."
- **Related Story**: E5b-5 (AC6 — Delete single memory with confirmation)
- **Suggested Story Title**: Seed AI memory test data for E2E testing (10+ memories across 5 categories — prerequisite for Journeys 4-8)

## Missing: Forget Everything flow untestable — no seeded memory data (blocks Journey 7 entirely)
- **Journey**: Journey 7 (Forget Everything — Destructive Action), Steps 1-5
- **Expected**: Memory page should display memories. Clicking the "Forget Everything" button in the danger zone of the settings panel should open a destructive confirmation AlertDialog with warning triangle icon, title "Forget Everything", body text "This will permanently delete ALL of your AI memories. This action cannot be undone.", a text input labeled "Type FORGET to confirm" with placeholder "FORGET", and a disabled red "Forget Everything" confirm button. Typing "FORG" should keep the button disabled. Typing "FORGET" should enable the button. Clicking confirm should close the dialog, clear all memories, show "All memories have been deleted" toast, and display the empty state.
- **Actual**: Memory page shows empty state ("No memories yet") — no AI memories exist in the database and the settings panel does not render (GET /ai/memories/settings returns no data). Without memories and the settings panel, the "Forget Everything" button is not accessible and the entire destructive action flow cannot be tested. The test was skipped with annotation: "PREREQUISITE NOT MET: No AI memories seeded."
- **Related Story**: E5b-5 (AC7 — Forget Everything with FORGET confirmation)
- **Suggested Story Title**: Seed AI memory test data and ensure settings API returns defaults for E2E testing (prerequisite for Journeys 4-8)

## Missing: Stats panel should show zero counts in empty state (design discrepancy)
- **Journey**: Journey 8 (Memory Page Empty State), Step 3
- **Expected**: Stats panel should show Total: 0, Explicit: 0, Learned: 0 even when no memories exist, giving the user awareness of the stats feature
- **Actual**: The stats panel component (`memory-stats-panel.tsx`) returns `null` when `stats.total === 0`, so it is completely hidden in the empty state. This is a design decision in the implementation that differs from the test plan expectation.
- **Related Story**: E5b-5 (AC3 — Stats display, AC13 — Empty states)
- **Suggested Story Title**: Show zero-state stats panel on empty memory page (design decision — optional)

## Missing: Settings panel not visible in empty state (same root cause as Journey 2)
- **Journey**: Journey 8 (Memory Page Empty State), Step 2
- **Expected**: The settings panel (Enable AI Memory toggle, category checkboxes, retention selector, Forget Everything button) should be visible above the empty state card even when no memories exist. The code at `memory-page.tsx:306` includes `{settings && <MemorySettingsPanel/>}` in the empty-state branch.
- **Actual**: Settings panel does not render because `GET /ai/memories/settings` returns no data. Same root cause as documented in Journey 2.
- **Related Story**: E5b-5 (AC2)
- **Suggested Story Title**: (Duplicate of Journey 2 finding — Ensure memory settings API returns default settings for new users)

## Missing: Skills seed data not present — Skills page shows empty state (blocks Journey 9 steps 3-4)
- **Journey**: Journey 9 (AI Skills Browser Page Load & Layout), Steps 3-4
- **Expected**: Skills page should show search input ("Search skills..."), module filter dropdown ("Filter by module"), and module-grouped accordion sections with skill cards. First module group should be expanded by default. Each skill card should show: display name, description, green trigger phrase pills, red negative trigger tags (if any), orchestration pattern badge (colour-coded), and active/inactive status indicator (green/grey dot). The test plan prerequisite states: "Skills seeded via E5b-6 views skill pack."
- **Actual**: Skills page correctly loads and shows the empty state: "No skills available" heading with Zap icon in purple circle, description "Browse the AI capabilities available in your system". The GET /ai/skills API returned an empty array. The search input, module filter, accordion groups, and skill cards are not rendered in the empty state (by design — the component only shows these when skills exist). Steps 1-2 (sidebar navigation and page title) verified successfully.
- **Related Story**: E5b-6 (Skills Registry & Skill Packs seeding)
- **Suggested Story Title**: Seed AI skills data via E5b-6 views skill pack for E2E testing (prerequisite for Journeys 9-12)

## Missing: Skills search and module filter untestable — no seeded skills data (blocks Journey 10 entirely)
- **Journey**: Journey 10 (Search and Filter Skills), Steps 1-4
- **Expected**: Skills page should display skill cards grouped by module with search input and module filter dropdown. Typing "invoice" in search should filter skills matching by name, description, or trigger phrases. Selecting "Views & Navigation" from module dropdown should show only that module's skills. Typing "zzzznonexistent" should show empty state: "No skills match your search" with Clear button.
- **Actual**: Skills page shows empty state ("No skills available") — no skills exist in the database. The search input, module filter dropdown, and skill cards are not rendered in the empty state (by design). The GET /ai/skills API returned an empty array. The test was skipped with annotation: "prerequisite_not_met: No skills data seeded."
- **Related Story**: E5b-6 (Skills Registry & Skill Packs seeding)
- **Suggested Story Title**: Seed AI skills data via E5b-6 views skill pack for E2E testing (prerequisite for Journeys 9-12)

## Missing: Admin skill detail sheet, override save, and reset untestable — no seeded skills data (blocks Journey 11 entirely)
- **Journey**: Journey 11 (Admin Skill Detail & Override), Steps 1-8
- **Expected**: An ADMIN user should be able to: (1) click a skill card to open a slide-out detail sheet with admin controls (active/inactive toggle, editable trigger phrase input, editable priority input, Save Override button, Reset to Default button), (2) toggle active/inactive, (3) add a new trigger phrase "display records", (4) change priority to 150, (5) click Save Override to persist changes via PUT /ai/skill-overrides/:skillId and see "Skill override saved" toast, (6) re-open the sheet to verify overridden values and "Custom override applied" badge, (7) click Reset to Default to remove override via DELETE /ai/skill-overrides/:skillId and see "Override removed — using default settings" toast.
- **Actual**: Skills page shows empty state ("No skills available") — no skills exist in the database. Without skill cards, the detail sheet cannot be opened and the entire admin override flow cannot be tested. The test was skipped with annotation: "prerequisite_not_met: No skills data seeded. Admin skill detail & override tests require seed data."
- **Related Story**: E5b-6 (Skills Registry & Skill Packs seeding)
- **Suggested Story Title**: Seed AI skills data via E5b-6 views skill pack for E2E testing (prerequisite for Journeys 9-12)

## Missing: Staff skill detail read-only view untestable — no seeded skills data (blocks Journey 12 entirely)
- **Journey**: Journey 12 (Staff Skill Detail — Read-Only), Steps 1-3
- **Expected**: A STAFF user should be able to: (1) navigate to /ai/skills and see skill cards, (2) click a skill card to open a slide-out detail sheet in read-only mode — NO active/inactive toggle switch, NO editable trigger phrase input, NO priority number input, NO Save Override button, NO Reset to Default button — only a Close button in the footer, with trigger phrases displayed as non-editable green pills and a read-only status indicator, (3) verify the sheet footer contains only the Close button.
- **Actual**: Skills page shows empty state ("No skills available") — no skills exist in the database. The AI module routes return 404 (PLATFORM_SERVICE_TOKEN likely not set, causing graceful degradation). Without skill cards, the detail sheet cannot be opened and the STAFF read-only verification cannot be tested. The test was skipped with annotation: "prerequisite_not_met: No skills data seeded. Staff skill detail tests require seed data."
- **Related Story**: E5b-6 (Skills Registry & Skill Packs seeding)
- **Suggested Story Title**: Seed AI skills data via E5b-6 views skill pack for E2E testing (prerequisite for Journeys 9-12)

## Missing: Responsive layout of settings panel, search/filter, and memory cards untestable — no seed data (Journey 14)
- **Journey**: Journey 14 (Memory Page Responsive Behaviour), Steps 1-3
- **Expected**: At phone (375x812), settings sections should stack vertically and memory cards should be full-width with touch-friendly sizes. At tablet (768x1024), wider single-column form layout with search bar on the same row. At desktop (1440x900), two-column settings panel (label left, input right) with full memory/skill cards.
- **Actual**: All three breakpoints render correctly for the elements that ARE present (header, sidebar, empty state card, breadcrumb). However, the settings panel, search/filter bar, stats panel, and memory cards are not rendered because no memories are seeded and GET /ai/memories/settings returns no data. The responsive behavior of these components could not be verified. Confirmed: no horizontal overflow at any breakpoint (scrollWidth exactly matches viewport), sidebar correctly adapts (hidden at phone, icon-only at tablet, full at desktop), content properly centered at desktop (width=1184px with 256px sidebar).
- **Related Story**: E5b-5 (AC14 — Mobile adaptation and responsive breakpoints)
- **Suggested Story Title**: Seed AI memory test data to enable responsive layout verification of settings panel, search/filter, and memory cards

## Missing: Concept D visual compliance partially unverifiable — no seed data for cards, badges, triggers (Journey 13)
- **Journey**: Journey 13 (Concept D Visual Compliance Check), Steps 2 and 4
- **Expected**: Memory page should display memory cards with 12px border-radius, custom shadow, purple-tinted hover shadow, category badges with semantic colours, source badges (Explicit=purple, Learned=grey). Skills page should display skill cards with green trigger phrase tags, red negative trigger tags, active/inactive status indicators, and module-grouped accordion sections. Both pages should be fully populated to verify the complete Concept D design system.
- **Actual**: Both pages show empty states (no memories seeded, no skills seeded). Verified: body background is `#f4f2ff` (PASS), heading font is Plus Jakarta Sans (PASS), body font is Inter (PASS), active sidebar link uses `#7c3aed` purple (PASS). Could NOT verify: memory card radius, card shadows, settings panel toggles/buttons, category badges, trigger phrase green tags, negative trigger red tags, skill card hover effects, fadeInUp animations on cards.
- **Related Story**: E5b-5 (AC13 — Concept D compliance), E5b-6 (Skills seeding)
- **Suggested Story Title**: Seed AI memory and skills test data to enable full Concept D visual compliance verification

## Missing: Entity triggers API route not registered on platform-api — blocks entity mention autocomplete (Journey 15)
- **Journey**: Journey 15 (Entity Mention Trigger Word Detection in Chat), Step 3
- **Expected**: After typing "open saved view ov" in the Co-Pilot chat input, the entity mention detection system should: (1) recognise "saved view" as a trigger word via the useEntityTriggers hook (which calls GET /ai/entity-triggers?isActive=true), (2) extract "ov" as the search query (2+ chars), (3) display an autocomplete dropdown above the input with matching saved view entities, including purple circle icon, display name, subtitle, and keyboard navigation hint footer.
- **Actual**: The entity triggers API endpoint (GET /api/v1/ai/entity-triggers?isActive=true) returns HTTP 404 "Route not found" from the platform-api (port 3000). The entity-triggers route files exist in `apps/api/src/ai/entity-triggers.routes.ts` (untracked/new), but the route is NOT registered on the platform-api that the frontend Vite proxy forwards to. Without trigger data, `triggerMap` is empty, `useMentionDetection` returns `null`, `showAutocomplete` remains `false`, and the autocomplete dropdown never renders. The frontend component code (EntityMentionInput, EntityAutocompleteDropdown, useMentionDetection) appears correctly implemented — only the backend API route registration is missing.
- **Related Story**: E5b-7 (AC1 — Trigger word detection activates autocomplete, AC5 — Keyboard hint footer, AC8 — Typing non-trigger text shows no autocomplete)
- **Suggested Story Title**: Register AI entity-triggers and entity-search API routes on platform-api for frontend access

## Missing: Entity autocomplete chip insertion & removal untestable — entity triggers API returns 404 (Journey 16)
- **Journey**: Journey 16 (Entity Selection & Chip Insertion), Steps 2-5
- **Expected**: After typing "open view us" in the Co-Pilot chat input, the entity autocomplete dropdown should appear (trigger word "view" + 2-char query "us"). Clicking the first result should insert an entity chip (purple pill with icon, name, and X remove button) into the input, replacing the trigger text. Typing additional text after the chip should show both chip and text coexisting with the send button enabled. Clicking the X button on the chip should remove it while preserving the typed text.
- **Actual**: The entity triggers API endpoint (GET /api/v1/ai/entity-triggers?isActive=true) returns HTTP 404 "Route not found" from the platform-api. Without trigger data, the `triggerMap` is empty, `useMentionDetection` returns `null`, and the autocomplete dropdown never renders. Steps 3-5 (chip insertion, text after chip, chip removal) could not be tested at all. This is the same root cause as Journey 15 — the entity-triggers route exists in source (`apps/api/src/ai/entity-triggers.routes.ts`) but is not registered on the platform-api that the frontend Vite proxy connects to.
- **Related Story**: E5b-7 (AC3 — Entity chip insertion, AC4 — Chip styling and removal, AC8 — Keyboard interaction)
- **Suggested Story Title**: Register AI entity-triggers and entity-search API routes on platform-api for frontend access (same as Journey 15)

## Missing: Send message with entity mentions & chat display untestable — entity triggers API returns 404 (Journey 17)
- **Journey**: Journey 17 (Send Message with Entity Mentions & Display in Chat), Steps 2-7
- **Expected**: After typing "open view us" in the Co-Pilot chat input, the entity autocomplete dropdown should appear. Selecting an entity should insert a chip. Typing additional text and clicking Send should: (1) display the user message bubble with entity chip using user-message variant (bg-white/20 text-white) and message text, (2) clear the input, (3) show streaming indicator (pulsing dots) while waiting for AI response, (4) display assistant response with any entity mentions rendered as assistant-message variant chips (bg-[#ede9fe] text-[#6d28d9]).
- **Actual**: The entity triggers API endpoint (GET /api/v1/ai/entity-triggers?isActive=true) returns HTTP 404 "Route not found" from the platform-api. Without trigger data, `triggerMap` is empty, `useMentionDetection` returns `null`, and the autocomplete dropdown never renders. Steps 3-7 (chip insertion, text after chip, send with chips, streaming indicator, assistant response with entity chips) could not be tested. The test correctly identified the root cause via API response interception: `status=404, body={"success":false,"error":{"code":"NOT_FOUND","message":"Route not found"}}`. This is the same root cause as Journeys 15 and 16.
- **Related Story**: E5b-7 (AC4 — Entity chip display in sent messages, AC11 — Entity chips in chat history)
- **Suggested Story Title**: Register AI entity-triggers and entity-search API routes on platform-api for frontend access (same as Journey 15)

## Missing: Entity autocomplete keyboard navigation untestable — entity triggers API returns 404 (Journey 18)
- **Journey**: Journey 18 (Entity Autocomplete Keyboard Navigation), Steps 2-9
- **Expected**: After typing "open view us" in the Co-Pilot chat input, the entity autocomplete dropdown should appear. The user should be able to: (1) press ArrowDown to move highlight to the second result (light purple #f5f3ff background), (2) press ArrowUp to return highlight to the first result, (3) press Enter to insert the selected entity as a chip (purple pill with icon, name, X remove button), (4) type a new trigger "open saved view ov" to trigger autocomplete again, (5) press Escape to dismiss the autocomplete while preserving typed text, (6) clear the textarea and press Backspace to remove the last entity chip.
- **Actual**: The entity triggers API endpoint (GET /api/v1/ai/entity-triggers?isActive=true) returns HTTP 404 "Route not found" from the platform-api (port 3000). Without trigger data, `triggerMap` is empty, `useMentionDetection` returns `null`, `showAutocomplete` remains `false`, and the autocomplete dropdown never renders. Steps 3-9 (ArrowDown/ArrowUp navigation, Enter selection, Escape dismiss, Backspace chip removal) could not be tested at all. The test correctly identified the root cause via API response interception: `status=404, body={"success":false,"error":{"code":"NOT_FOUND","message":"Route not found"}}`. This is the same root cause as Journeys 15, 16, and 17.
- **Related Story**: E5b-7 (AC8 — Full keyboard navigation, AC1 — Trigger word detection, AC3 — Entity chip insertion)
- **Suggested Story Title**: Register AI entity-triggers and entity-search API routes on platform-api for frontend access (same as Journeys 15-17)
