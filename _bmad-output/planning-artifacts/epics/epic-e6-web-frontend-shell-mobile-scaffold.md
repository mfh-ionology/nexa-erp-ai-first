# Epic E6: Web Frontend Shell + Mobile Scaffold

**Tier:** 1 | **Dependencies:** E2 (Auth), E2b (Granular RBAC backend), E4 (i18n) | **FRs:** UX infrastructure + FR81, FR175-FR177, FR227-FR233 (RBAC admin frontend) | **NFRs:** NFR27 (WCAG 2.1 AA), NFR28 (keyboard navigation)

---

## Story E6.S1: React App Bootstrap

**User Story:** As a developer, I want a fully configured React application with routing, state management, styling, and auth integration, so that all subsequent frontend stories have a solid foundation.

**Acceptance Criteria:**
1. GIVEN the `apps/web` package WHEN it is built THEN it produces an optimised Vite + React 19 + TypeScript application with strict mode enabled
2. GIVEN the application loads WHEN the user is not authenticated THEN they are redirected to the login page
3. GIVEN the user authenticates WHEN the JWT is received THEN it is stored securely and used for all API requests via the shared API client
4. GIVEN the application WHEN React Query is configured THEN it provides caching, background refetch, and optimistic update capabilities for all server state
5. GIVEN Zustand stores WHEN client-side state is needed THEN stores exist for: auth state, sidebar state, active company, user preferences, and Co-Pilot drawer state

**Key Tasks:**
- [ ] Scaffold `apps/web` with Vite + React 19 + TypeScript strict (AC: #1)
  - [ ] Configure `tsconfig.json` with strict mode
  - [ ] Configure Vite with path aliases (`@/components`, `@/features`, etc.)
  - [ ] Install and configure Tailwind CSS 4 + shadcn/ui
- [ ] Configure TanStack Router for file-based routing with lazy-loaded module routes (AC: #2)
  - [ ] Set up route-level code splitting per module
  - [ ] Create `ModuleGuard` component for module access gating
  - [ ] Create `AuthGuard` component for authentication requirement
- [ ] Configure TanStack Query (React Query) for server state management (AC: #4)
  - [ ] Set default stale time, cache time, and retry configuration
  - [ ] Create query key factory pattern for consistent cache management
  - [ ] Set up API client integration from `packages/api-client`
- [ ] Create Zustand stores for client state (AC: #5)
  - [ ] `useAuthStore`: user, token, login/logout, company context
  - [ ] `useSidebarStore`: open/closed, active module, collapsed sections
  - [ ] `useCopilotStore`: drawer open/closed, active conversation, streaming state
- [ ] Integrate auth flow with JWT storage and API client (AC: #2, #3)
  - [ ] Token refresh on 401 responses
  - [ ] Secure token storage (httpOnly cookie or in-memory)
  - [ ] Redirect to login on auth failure

**FR/NFR:** N/A (infrastructure); NFR41, NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 Frontend Architecture | Vite + React 19, TanStack Query + Zustand, React Hook Form + Zod |
| API Contracts | §1 Overview | JWT Bearer auth, response envelope, cursor pagination |
| Data Models | N/A | N/A — frontend infrastructure |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Design System Foundation | Tailwind CSS 4, Shadcn UI, purple theme |
| Project Context | §1 Multi-Company Architecture | Company switcher in auth state |

---

## Story E6.S2: Navigation Shell

**User Story:** As a user, I want a sidebar with module groups and company switcher, a top bar with user menu, notifications bell, and search, so that I can navigate the ERP efficiently.

**Acceptance Criteria:**
1. GIVEN the authenticated user WHEN the app shell renders THEN a sidebar displays module groups (Finance, Sales, Purchasing, etc.) filtered by the user's enabled modules
2. GIVEN the sidebar WHEN a module group is expanded THEN sub-items (entities within the module) are shown with icons and labels
3. GIVEN the sidebar WHEN the viewport is below 1024px THEN the sidebar collapses to an icon-only view with hover-to-expand behaviour
4. GIVEN the top bar WHEN it renders THEN it shows: hamburger menu (mobile), company logo/name, unified search input, chat button, notifications bell (with unread count badge), and user avatar menu
5. GIVEN a multi-company tenant WHEN the user clicks the company switcher in the sidebar THEN a dropdown lists available companies and switching updates the company context globally
6. GIVEN the user avatar menu WHEN clicked THEN it shows: user name, role, company name, "My Profile", "Preferences", "Sign Out"

**Key Tasks:**
- [ ] Build `<AppSidebar>` component in `apps/web/src/components/layout/` (AC: #1, #2)
  - [ ] Module groups with expand/collapse
  - [ ] Icons from Lucide icon set (shadcn default)
  - [ ] Active route highlighting
  - [ ] Filter modules by user's `enabledModules` from entitlements
- [ ] Build `<CompanySwitcher>` component (AC: #5)
  - [ ] Fetch user's accessible companies from API
  - [ ] Switch company context (updates Zustand store + API header)
  - [ ] Show current company name in sidebar header
- [ ] Build `<AppHeader>` component with top bar elements (AC: #4)
  - [ ] Unified search input placeholder (wired in E6.S5)
  - [ ] Chat button (wired in E6.S5)
  - [ ] Notifications bell with badge (wired in E9)
  - [ ] User avatar dropdown menu
- [ ] Implement responsive sidebar collapse (AC: #3)
  - [ ] Desktop (>=1280px): full sidebar
  - [ ] Tablet (1024-1279px): icon-only, hover to expand
  - [ ] Mobile (<1024px): off-canvas drawer with hamburger toggle
- [ ] Build user avatar dropdown menu (AC: #6)

**FR/NFR:** N/A (UX infrastructure); NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2 Component Architecture | `components/layout/` — App shell, sidebar, header, breadcrumbs |
| API Contracts | §2.2 System Module | Company endpoints for switcher |
| Data Models | §3.1 System Module | CompanyProfile (name, logo) |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Standardised Screen Templates | Sidebar navigation, topbar layout, responsive collapse |
| Project Context | §1 Multi-Company Architecture | Company switcher, companyId context |

---

## Story E6.S3: Screen Template System

**User Story:** As a developer, I want reusable page template components for all 8 screen types (T1-T8), so that every screen in the ERP follows a consistent layout without custom page designs.

**Acceptance Criteria:**
1. GIVEN a developer building an entity list screen WHEN they use `<EntityListPage>` THEN it provides: breadcrumb, title, action buttons, saved view selector, search, filter bar, data table with selection, pagination, and batch action bar
2. GIVEN a developer building a record detail screen WHEN they use `<RecordDetailPage>` THEN it provides: breadcrumb, title with status badge, action bar, tabbed content area, and related entities section
3. GIVEN a developer building a header+lines document WHEN they use `<HeaderLinesPage>` THEN it provides: header section with tabs, editable line items table with add/remove, totals section, and event flow tracker
4. GIVEN template T4 (Briefing) WHEN it renders THEN it provides a card-based layout for briefing items with action buttons and period comparisons
5. GIVEN templates T5 (Board), T6 (Wizard), T7 (Settings), T8 (Report) WHEN they render THEN each provides the correct standardised layout per the UX Design Spec

**Key Tasks:**
- [ ] Build `<EntityListPage>` (T1) template component (AC: #1)
  - [ ] Props: title, entityType, columns config, actions config, filters config
  - [ ] Integrated data table with TanStack Table
  - [ ] Row selection with batch action bar
  - [ ] Cursor-based pagination
  - [ ] Search and filter integration points
- [ ] Build `<RecordDetailPage>` (T2) template component (AC: #2)
  - [ ] Props: title, entityType, statusConfig, tabs config, actions config
  - [ ] Status badge with semantic colours
  - [ ] Tabbed content area
  - [ ] Related entities sidebar/section
- [ ] Build `<HeaderLinesPage>` (T3) template component (AC: #3)
  - [ ] Props: headerFields, lineColumns, totalsConfig, statusConfig
  - [ ] Editable header section with tabs
  - [ ] Line items table with inline editing, add/delete rows
  - [ ] Auto-calculated totals (subtotal, VAT, total)
  - [ ] Event flow tracker component
- [ ] Build remaining templates (AC: #4, #5)
  - [ ] `<BriefingPage>` (T4): card grid, action buttons, metrics with delta
  - [ ] `<BoardPage>` (T5): Kanban columns with drag-and-drop
  - [ ] `<WizardPage>` (T6): step indicator, next/back, validation per step
  - [ ] `<SettingsPage>` (T7): grouped settings with save/reset
  - [ ] `<ReportPage>` (T8): parameter form, results table, AI summary slot

**FR/NFR:** N/A (UX infrastructure); NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | T1-T8 components, file locations in `components/templates/` |
| API Contracts | §1 Pagination | Cursor-based pagination on all list endpoints |
| Data Models | N/A | N/A — templates are generic, data-driven |
| State Machines | N/A | N/A — templates consume status from entities |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — templates are presentation layer |
| UX Design Spec | §Standardised Screen Templates | T1-T8 wireframes, use counts, responsive behaviour |
| Project Context | N/A | N/A — covered by UX Design Spec |

---

## Story E6.S4: ActionBar Component

**User Story:** As a user, I want a consistent action bar on every record screen with primary actions, persistent tools (Attachments, Links), and a grouped overflow menu, so that I always know where to find actions regardless of which module I am in.

**Acceptance Criteria:**
1. GIVEN a record screen WHEN the action bar renders THEN it shows: primary action zone (max 2 buttons, status-driven), persistent tools zone (Attachments with count badge, Links with count badge), and overflow menu button
2. GIVEN the entity is in DRAFT status WHEN the action bar renders THEN the primary action is "Approve" (or "Save Draft") and the overflow Status Actions section shows valid next transitions only
3. GIVEN the entity has 3 attachments and 2 record links WHEN the action bar renders THEN the Attachments button shows "(3)" badge and Links button shows "(2)" badge
4. GIVEN the overflow menu WHEN opened THEN actions are grouped into 5 sections: Document Actions, Status Actions, Record Actions, AI Actions, History — with empty sections hidden
5. GIVEN an action that is invalid for the current status WHEN the overflow menu renders THEN the action is hidden entirely (not greyed out/disabled)
6. GIVEN a status change action WHEN clicked THEN a confirmation dialog appears for destructive actions (Void, Cancel) with entity name and consequence description

**Key Tasks:**
- [ ] Build `<ActionBar>` component in `apps/web/src/components/action-bar/ActionBar.tsx` (AC: #1)
  - [ ] Three zones: primary actions, persistent tools, overflow trigger
  - [ ] Accept `actionConfig` prop defining available actions per entity status
- [ ] Build status-driven action configuration system (AC: #2, #5)
  - [ ] Create `action-config.ts` with status-to-actions mapping per entity type
  - [ ] Actions appear/hide based on current entity status and user permissions
  - [ ] Maximum 2 primary actions enforced
- [ ] Build persistent tools buttons with count badges (AC: #3)
  - [ ] Attachments button with count from entity
  - [ ] Links button with count from entity
  - [ ] Click opens respective panel (E8 provides the panels)
- [ ] Build `<OverflowMenu>` component with grouped sections (AC: #4)
  - [ ] 5 sections with dividers: Document, Status, Record, AI, History
  - [ ] Sections auto-hide when no valid actions exist
  - [ ] Keyboard shortcut hints on menu items
- [ ] Implement confirmation dialogs for destructive actions (AC: #6)

**FR/NFR:** N/A (UX infrastructure); NFR27, NFR28

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.2.1 Standardised Page Templates | ActionBar component, `action-bar/` directory, status-driven actions |
| API Contracts | N/A | N/A — ActionBar is frontend presentation |
| Data Models | N/A | N/A — consumes entity status from any model |
| State Machines | §1 Common Patterns | All entity state machines drive action visibility |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — ActionBar enforces state machine transitions visually |
| UX Design Spec | §The Action Bar System | Three zones, 5 overflow sections, action bar rules, per-template mapping |
| Project Context | N/A | N/A — covered by UX Design Spec |

---

## Story E6.S5: Co-Pilot Dock

**User Story:** As a user, I want a Cmd+K header input for quick search/AI commands and a collapsible 380px right-side drawer for multi-turn AI conversations, so that I can interact with the AI assistant from any screen.

**Acceptance Criteria:**
1. GIVEN any screen WHEN the user presses Cmd+K (Mac) or Ctrl+K (Windows) THEN the unified search input in the header bar gains focus
2. GIVEN the user types in the header input WHEN the input matches entity patterns (INV-, PO-) THEN an autocomplete dropdown shows matching entities for direct navigation
3. GIVEN the user types a natural language command WHEN they press Enter THEN the Co-Pilot drawer opens (if closed) and the AI response streams in the drawer
4. GIVEN the Co-Pilot drawer WHEN opened THEN it is 380px wide on desktop, the main content area resizes, and it shows: chat selector, conversation area, quick prompts, and input area
5. GIVEN the drawer WHEN on mobile (<768px) THEN it renders as a full-screen overlay with a minimise button that shrinks to a floating pill
6. GIVEN the user is on a specific page WHEN quick prompts render THEN they are role-based and context-aware (e.g., on Invoice List: "Show Overdue", "Create Invoice")

**Key Tasks:**
- [ ] Build `<UnifiedSearch>` component in `apps/web/src/components/header/UnifiedSearch.tsx` (AC: #1, #2)
  - [ ] Cmd+K global keyboard shortcut to focus
  - [ ] Input type detection: entity search, page search, AI command
  - [ ] Autocomplete dropdown with entity results, page results, AI prompt suggestions
- [ ] Build `<CopilotDrawer>` container component (AC: #3, #4)
  - [ ] Slide-in from right, 200ms ease-out animation
  - [ ] 380px fixed width on desktop, 100% overlay on phone
  - [ ] Main content area resizes when drawer opens
  - [ ] Zustand store controls open/closed state
- [ ] Build `<CopilotChat>` conversation component (AC: #3)
  - [ ] AI messages (left-aligned, grey) and user messages (right-aligned, purple)
  - [ ] Streaming text display with typing indicator
  - [ ] Inline action buttons and data cards in AI messages
  - [ ] Links to records (navigate on click)
- [ ] Build `<ChatHistory>` selector component (AC: #4)
  - [ ] Dropdown listing previous conversations with titles
  - [ ] "+ New Chat" button
- [ ] Build `<QuickPrompts>` role-based preset chips (AC: #6)
  - [ ] Load presets from configuration (role + page context)
  - [ ] Tap to submit immediately
- [ ] Build `<CopilotInput>` text input area (AC: #3)
  - [ ] Multi-line support (Shift+Enter)
  - [ ] File drop zone for Document Understanding
  - [ ] Submit button and Enter key handling
- [ ] Implement responsive behaviour for mobile (AC: #5)

**FR/NFR:** FR1 (AI conversation), FR4 (context awareness); NFR27, NFR28, NFR30 (screen reader for AI chat)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.4 Dual Interface Pattern | Co-Pilot Dock, header input, drawer components |
| API Contracts | §2.6 AI & Chat | WS /ai/chat, GET /ai/chat/history, POST /ai/chat/sessions |
| Data Models | N/A | N/A — frontend components |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — WebSocket communication, not event bus |
| Business Rules | §13 Communications Rules | BR-COM-013: AI actions require user confirmation |
| UX Design Spec | §AI Interaction Model — Co-Pilot Dock | Header bar, drawer specs (380px, animation, sections), behaviour rules, interaction flow |
| Project Context | N/A | N/A — covered by Architecture and UX Design Spec |

---

## Story E6.S6: Mobile Scaffold

**User Story:** As a mobile user, I want a React Native app with authentication, navigation shell, and push notification setup, so that I can access AI chat, briefings, and approvals on my phone.

**Acceptance Criteria:**
1. GIVEN the `apps/mobile` package WHEN it is built THEN it produces an Expo (React Native) application with TypeScript
2. GIVEN the mobile app WHEN the user opens it unauthenticated THEN they see a login screen with optional biometric authentication (Face ID / fingerprint)
3. GIVEN the mobile app WHEN authenticated THEN a tab bar shows: Chat (primary), Briefing, Approvals, More
4. GIVEN the shared API client in `packages/api-client` WHEN the mobile app makes API calls THEN it uses the same typed client as the web app
5. GIVEN push notifications WHEN configured with Expo Push THEN the app can receive and display approval requests, briefing alerts, and stock alerts

**Key Tasks:**
- [ ] Scaffold `apps/mobile` with Expo + React Native + TypeScript (AC: #1)
  - [ ] Configure Expo Router for file-based routing
  - [ ] Install shared packages: `packages/api-client`, `packages/shared`, `packages/i18n`
- [ ] Implement auth flow with biometric option (AC: #2)
  - [ ] Login screen with email/password
  - [ ] MFA challenge screen
  - [ ] Biometric unlock via `expo-local-authentication`
  - [ ] Token storage via `expo-secure-store`
- [ ] Build tab bar navigation shell (AC: #3)
  - [ ] Chat tab (primary AI screen)
  - [ ] Briefing tab (daily briefing cards)
  - [ ] Approvals tab (pending approvals queue)
  - [ ] More tab (module quick-access grid)
- [ ] Integrate shared API client (AC: #4)
  - [ ] Configure base URL and auth headers
  - [ ] Use React Query for data fetching
- [ ] Set up Expo Push Notifications (AC: #5)
  - [ ] Register for push token on login
  - [ ] Store push token on server (user device)
  - [ ] Handle incoming push notifications with deep linking

**FR/NFR:** N/A (mobile infrastructure); NFR27

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5 Frontend Architecture | React Native + Expo, shared packages, tab navigation |
| API Contracts | §1 Overview | JWT Bearer auth, same API endpoints |
| Data Models | N/A | N/A — mobile scaffold |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — push notifications via BullMQ worker |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Responsive Design & Accessibility | Mobile breakpoints, touch targets (44x44px) |
| Project Context | §8 Mobile Strategy | Mobile as end-of-epic story, Expo, AI-first mobile |

---

## Story E6.S7: Resource Registry Page

**User Story:** As an administrator, I want a read-only Resource Registry page listing all controllable system resources, so that I can see what pages, reports, settings, and maintenances are available for permission configuration.

**Scope:**
- T1 Entity List at `/system/resources` displaying all resources (code, name, module, type, sortOrder)
- Module filter dropdown, type filter dropdown, search input
- Read-only page (no create/edit/delete — resources are system-managed)
- Calls `GET /system/resources` API

**FRs covered:** FR227
**Missing items covered:** 3 of 57 (Resource Registry page, module filter, search)

> Full acceptance criteria and tasks to be created by SM when E6 is scheduled.

---

## Story E6.S8: Access Group Management Pages

**User Story:** As an administrator, I want to list, create, view, edit, and deactivate access groups with an interactive permission matrix, so that I can define and manage granular roles for my company.

**Scope:**
- T1 Entity List at `/system/access-groups` with search, system badges, user count
- Create form at `/system/access-groups/new` (code, name, description) with 409 duplicate handling
- T7 Settings detail at `/system/access-groups/:id` with editable name/description
- Permission matrix checkbox grid (canAccess, canNew, canView, canEdit, canDelete) grouped by module
- Save permissions via `PUT /access-groups/:id/permissions` (replace-all semantics)
- System group banner for `isSystem: true` groups (code read-only, cannot deactivate)
- Overflow menu with Deactivate option (disabled for system groups, confirmation dialog for custom)
- Soft-delete via `DELETE /access-groups/:id` (sets isActive=false), hidden from default list view

**FRs covered:** FR175, FR229
**Missing items covered:** 20 of 57

> Full acceptance criteria and tasks to be created by SM when E6 is scheduled.

---

## Story E6.S9: User Access Group Assignment

**User Story:** As an administrator, I want to view users and assign one or more access groups to each user, so that users get the exact permissions their role requires.

**Scope:**
- T1 Entity List at `/system/users` with clickable rows for navigation to user detail
- T2 Record Detail at `/system/users/:id` with Access Groups assignment panel
- Current group assignments displayed as tags/chips with assignedBy and assignedAt metadata
- Multi-select dropdown/combobox for adding/removing groups
- Save via `PUT /system/users/:id/access-groups` (replace-all pattern)
- 422 Business Rule Violation handling when assigning zero groups
- Removable access group tags with empty state display

**FRs covered:** FR81, FR176
**Missing items covered:** 8 of 57

> Full acceptance criteria and tasks to be created by SM when E6 is scheduled.

---

## Story E6.S10: Field Override Configuration

**User Story:** As an administrator, I want to configure field-level visibility (VISIBLE, READ_ONLY, HIDDEN) per access group per resource, so that sensitive fields like cost prices can be hidden from specific user groups.

**Scope:**
- Field Overrides panel on Access Group detail page (extends E6.S8)
- Resource selector dropdown with empty state
- Per-field visibility table with dropdown (VISIBLE, READ_ONLY, HIDDEN)
- Save via `PUT /access-groups/:id/field-overrides` with success toast
- Persisted overrides reload correctly from `GET /access-groups/:id`

**FRs covered:** FR228
**Missing items covered:** 4 of 57

> Full acceptance criteria and tasks to be created by SM when E6 is scheduled.

---

## Story E6.S11: Permission-Driven Route Guards & Field Visibility

**User Story:** As a user, I want the frontend to enforce my access group permissions — hiding unauthorized sidebar items, blocking unauthorized routes, and respecting field-level visibility — so that I only see and interact with what my permissions allow.

**Scope:**
- `ModuleGuard` and route-level permission guards using `GET /system/my-permissions` response
- Access denied page for unauthorized direct URL navigation (403 display)
- Permission-driven sidebar: hide menu items where `canAccess=false`
- Button visibility: hide [+ New] when `canNew=false`, hide edit/delete based on flags
- Field-level visibility: strip HIDDEN fields from forms, render READ_ONLY as disabled
- `_fieldMeta` integration for READ_ONLY markers from API responses
- SUPER_ADMIN bypass: show all sidebar items, all routes, all fields editable
- My Permissions page/panel displaying resolved permissions, role, access groups, enabled modules
- Most-permissive-wins resolution reflected in UI (union of multiple groups)

**FRs covered:** FR177, FR231, FR232, FR233
**Missing items covered:** 14 of 57

> Full acceptance criteria and tasks to be created by SM when E6 is scheduled.

---

## Story E6.S12: Configuration Export & Import UI

**User Story:** As an administrator, I want to export my company's permission configuration as JSON and import it into other companies, so that I can standardise permissions across multiple companies or share best-practice configurations.

**Scope:**
- "Export Config" and "Import Config" options in Company Profile overflow menu
- Export: calls `GET /system/company-profile/export-defaults`, displays preview dialog or initiates download
- Import: dialog with JSON textarea/file upload, dry-run toggle checkbox, Import button
- Dry-run mode: displays DRY_RUN results (counts of created/updated) without persisting
- Actual import: displays APPLIED results confirming round-trip fidelity

**FRs covered:** FR230
**Missing items covered:** 5 of 57

> Full acceptance criteria and tasks to be created by SM when E6 is scheduled.

---
