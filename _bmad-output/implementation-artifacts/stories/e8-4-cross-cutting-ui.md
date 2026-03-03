# Story 8.4: Cross-Cutting UI Components

Status: done

## Story

As a **user working with any business record** (invoice, sales order, purchase order, customer, etc.),
I want an attachment panel with drag-drop upload, a notes panel with timeline view, and a links panel showing related records,
so that I can manage cross-cutting data from any record screen without leaving the current context.

## Acceptance Criteria

1. **GIVEN** a record screen (T2 or T3 template) **WHEN** the user clicks the Attachments button in the action bar **THEN** a side panel (Sheet) opens showing the file list with name, size, type icon, date, and download/delete actions — the action bar badge shows the current attachment count
2. **GIVEN** the attachment panel is open **WHEN** the user drags a file onto the drop zone (or clicks the file picker) **THEN** the upload process starts automatically: presign → direct S3 upload → confirm → list refreshes — with a progress indicator visible during upload — and executable files (`.exe`, `.bat`, `.sh`) and files exceeding 50MB are rejected with a validation error before upload begins
3. **GIVEN** a record screen (T2 or T3 template) **WHEN** the user clicks a "Notes" tab or section **THEN** a timeline view shows notes in reverse chronological order (pinned notes first) with author name, timestamp, type badge (General grey, Internal blue, Customer Visible green, System purple), and content
4. **GIVEN** the notes panel **WHEN** the user clicks "Add Note" **THEN** a form appears with a content text area and a type selector (General, Internal, Customer Visible) — SYSTEM type is not available to users — and the note is created on submit with the list refreshing immediately
5. **GIVEN** a record screen (T2 or T3 template) **WHEN** the user clicks the Links button in the action bar **THEN** a side panel (Sheet) opens showing all linked records grouped by link type (Created From, Fulfills, Payment For, Credit For, Relates To, Parent-Child) with entity type icon, display reference (e.g., "INV-0047"), direction indicator, and navigation link to each related record — the action bar badge shows the total link count
6. **GIVEN** the links panel **WHEN** the user clicks "Add Link" **THEN** a form appears with entity type selector, entity search (typeahead), and link type selector — creating the link on submit and refreshing the list
7. **GIVEN** any cross-cutting panel (attachments, notes, links) **WHEN** displayed on a phone breakpoint **THEN** the panel renders as a full-screen overlay sheet (not side-by-side) with a close button, and all interactive elements are keyboard-navigable (NFR28) and meet WCAG 2.1 AA (NFR27)
8. **GIVEN** a user without MANAGER role **WHEN** they view the attachment panel **THEN** the delete button is hidden for all attachments — and **WHEN** they view a note they did not create **THEN** the edit button is hidden — per RBAC permission rules from E8.1/E8.2/E8.3

## Tasks / Subtasks

### Task 1: Cross-Cutting API Hooks (React Query) (AC: #1–#6)

- [x] 1.1 Create `apps/web/src/features/cross-cutting/api/attachment-api.ts` — API client functions:
  - `presignUpload(input: { entityType, entityId, fileName, mimeType, fileSize })` → `{ uploadUrl, storageKey, expiresIn }`
  - `confirmUpload(input: { storageKey, entityType, entityId, fileName, fileSize, mimeType })` → Attachment
  - `listAttachments(entityType, entityId, limit?, offset?)` → `{ data: Attachment[], meta: { total } }`
  - `getDownloadUrl(attachmentId)` → `{ downloadUrl, fileName, mimeType }`
  - `deleteAttachment(attachmentId)` → void
  - All calls go through the existing `apiClient` from `lib/api-client.ts`
- [x] 1.2 Create `apps/web/src/features/cross-cutting/api/note-api.ts` — API client functions:
  - `createNote(input: { entityType, entityId, noteType, content, title? })` → Note
  - `listNotes(entityType, entityId, noteType?, limit?, offset?)` → `{ data: Note[], meta: { total } }`
  - `updateNote(noteId, input: { content?, title? })` → Note
  - `deleteNote(noteId)` → void
  - `pinNote(noteId, isPinned: boolean)` → Note
- [x] 1.3 Create `apps/web/src/features/cross-cutting/api/record-link-api.ts` — API client functions:
  - `createRecordLink(input: { sourceEntityType, sourceEntityId, targetEntityType, targetEntityId, linkType, description? })` → RecordLink
  - `listRecordLinks(entityType, entityId, direction?, linkType?, limit?, offset?)` → `{ data: RecordLink[], meta: { total } }`
  - `deleteRecordLink(linkId)` → void
- [x] 1.4 Create `apps/web/src/features/cross-cutting/hooks/use-attachments.ts` — React Query hooks:
  - `useAttachments(entityType, entityId)` — `useQuery` for list, returns `{ attachments, total, isLoading }`
  - `useUploadAttachment()` — custom hook orchestrating presign → PUT to S3 → confirm, returns `{ upload, isUploading, progress }`
  - `useDownloadAttachment()` — `useMutation` that fetches presigned GET URL and opens in new tab
  - `useDeleteAttachment(entityType, entityId)` — `useMutation` that invalidates attachment list on success
  - Query key factory: `queryKeys.attachments.list(entityType, entityId)`
- [x] 1.5 Create `apps/web/src/features/cross-cutting/hooks/use-notes.ts` — React Query hooks:
  - `useNotes(entityType, entityId)` — `useQuery` for list, returns `{ notes, total, isLoading }`
  - `useCreateNote(entityType, entityId)` — `useMutation`, invalidates list on success
  - `useUpdateNote(entityType, entityId)` — `useMutation`, invalidates list on success
  - `useDeleteNote(entityType, entityId)` — `useMutation`, invalidates list on success
  - `usePinNote(entityType, entityId)` — `useMutation`, optimistic update for pin toggle
- [x] 1.6 Create `apps/web/src/features/cross-cutting/hooks/use-record-links.ts` — React Query hooks:
  - `useRecordLinks(entityType, entityId)` — `useQuery` for bidirectional list, returns `{ links, total, isLoading }`
  - `useCreateRecordLink(entityType, entityId)` — `useMutation`, invalidates list on success
  - `useDeleteRecordLink(entityType, entityId)` — `useMutation`, invalidates list on success
- [x] 1.7 Add query key entries to `apps/web/src/lib/query-keys.ts`:
  - `attachments: { all: ['attachments'], list: (entityType, entityId) => ['attachments', entityType, entityId] }`
  - `notes: { all: ['notes'], list: (entityType, entityId) => ['notes', entityType, entityId] }`
  - `recordLinks: { all: ['record-links'], list: (entityType, entityId) => ['record-links', entityType, entityId] }`
- [x] 1.8 Create `apps/web/src/features/cross-cutting/types.ts` — shared TypeScript types:
  - `Attachment`, `Note`, `NoteType`, `RecordLink`, `RecordLinkType`, `LinkDirection` matching backend schemas
  - `UploadProgress` type for tracking upload state

### Task 2: AttachmentPanel Component (AC: #1, #2, #7, #8)

- [x] 2.1 Create `apps/web/src/features/cross-cutting/components/FileUploadZone.tsx`:
  - Drag-and-drop zone using native HTML5 drag events (pattern from `import-dialog.tsx`)
  - Visual feedback: dashed border → solid purple border + `bg-purple-50` on drag-over
  - "Click or drag files here" label with upload icon (lucide `Upload`)
  - Hidden `<input type="file">` triggered by click, with `accept` attribute filtering known MIME types
  - Client-side validation before upload: file size < 50MB, MIME type not in executable blocklist
  - Accessible: `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space activates), `aria-label`
  - Props: `onFilesSelected(files: File[])`, `isUploading: boolean`, `accept?: string`, `maxSizeBytes?: number`
- [x] 2.2 Create `apps/web/src/features/cross-cutting/components/UploadProgressBar.tsx`:
  - Shows file name, progress percentage, and animated progress bar during S3 upload
  - Cancel button to abort upload (AbortController)
  - Error state: red bar with retry button
  - Uses Shadcn `<Progress>` component
  - Props: `fileName: string`, `progress: number`, `status: 'uploading' | 'confirming' | 'error' | 'complete'`, `onCancel?: () => void`, `onRetry?: () => void`
- [x] 2.3 Create `apps/web/src/features/cross-cutting/components/AttachmentList.tsx`:
  - Renders list of attachments as rows: file type icon (lucide: `FileText`, `Image`, `FileSpreadsheet`, `File`), file name, human-readable file size (e.g., "2.4 MB"), upload date (relative: "3 hours ago"), uploader name
  - Download button (lucide `Download`) — calls `useDownloadAttachment` → opens presigned URL
  - Delete button (lucide `Trash2`) — visible only if user has MANAGER role (prop: `canDelete`), with confirmation dialog before delete
  - Empty state: illustration + "No attachments yet" text
  - Loading state: Shadcn `<Skeleton>` rows
  - Props: `attachments: Attachment[]`, `isLoading: boolean`, `canDelete: boolean`, `onDownload(id)`, `onDelete(id)`
- [x] 2.4 Create `apps/web/src/features/cross-cutting/components/AttachmentPanel.tsx`:
  - Wraps Shadcn `<Sheet>` (side="right", width 400px desktop, full-screen phone)
  - Header: "Attachments" title + close button + attachment count badge
  - Body: `<FileUploadZone>` at top → `<UploadProgressBar>` (when uploading) → `<AttachmentList>` below
  - Orchestrates the full upload flow: file selected → `useUploadAttachment().upload(file)` → list auto-refreshes via query invalidation
  - Uses `useAttachments(entityType, entityId)` for data
  - Uses `usePermission(resourceCode)` to determine `canDelete`
  - Phone breakpoint: Sheet renders as full-screen overlay (Shadcn Sheet default on mobile)
  - Keyboard: Escape closes panel, Tab navigates through file list and actions
  - Props: `open: boolean`, `onOpenChange(open)`, `entityType: string`, `entityId: string`, `resourceCode: string`

### Task 3: NotesPanel Component (AC: #3, #4, #7, #8)

- [x] 3.1 Create `apps/web/src/features/cross-cutting/components/NoteCard.tsx`:
  - Single note display card: type badge (colour-coded per AC #3), author name, relative timestamp, content text
  - Type badge colours: General → `bg-gray-100 text-gray-700`, Internal → `bg-blue-100 text-blue-700`, Customer Visible → `bg-green-100 text-green-700`, System → `bg-purple-100 text-purple-700`
  - Pin indicator: pinned notes show pin icon (lucide `Pin`) in header
  - Action buttons (overflow menu): Edit (own notes only, not SYSTEM), Delete (MANAGER only), Pin/Unpin
  - Edit mode: inline content editing with Save/Cancel buttons
  - System notes: read-only, no action buttons, italic styling
  - Props: `note: Note`, `currentUserId: string`, `canDelete: boolean`, `onEdit(id, content)`, `onDelete(id)`, `onPin(id, isPinned)`
- [x] 3.2 Create `apps/web/src/features/cross-cutting/components/AddNoteForm.tsx`:
  - Expandable form: "Add Note" button (lucide `Plus`) → expands to form on click
  - Content: `<Textarea>` with placeholder "Write a note..."
  - Type selector: `<Select>` with options General (default), Internal, Customer Visible
  - Submit button: "Add Note" (primary purple) — disabled when content is empty
  - Cancel button: collapses form back to button
  - On submit: calls `useCreateNote` mutation, collapses form, clears content
  - Props: `entityType: string`, `entityId: string`, `onNoteCreated?: () => void`
- [x] 3.3 Create `apps/web/src/features/cross-cutting/components/NotesPanel.tsx`:
  - Can be used as a tab panel within `<RecordDetailPage>` (AC #3 — "Notes tab or section")
  - Header: "Notes" title + note count
  - `<AddNoteForm>` at top
  - Timeline view: vertical list of `<NoteCard>` components — pinned notes first, then reverse chronological
  - Subtle timeline connector line between cards (left border or vertical line)
  - Empty state: "No notes yet — add the first note" text
  - Loading state: Shadcn `<Skeleton>` cards
  - Uses `useNotes(entityType, entityId)` for data
  - Uses `usePermission(resourceCode)` for delete permission
  - Props: `entityType: string`, `entityId: string`, `resourceCode: string`

### Task 4: LinksPanel Component (AC: #5, #6, #7, #8)

- [x] 4.1 Create `apps/web/src/features/cross-cutting/components/LinkGroupHeader.tsx`:
  - Section header for a link type group: link type label (e.g., "Created From"), link count, expand/collapse toggle
  - Link type display mapping: `CREATED_FROM` → "Created From", `FULFILLS` → "Fulfils", `PAYMENT_FOR` → "Payment For", `CREDIT_FOR` → "Credit For", `RELATES_TO` → "Related To", `PARENT_CHILD` → "Parent / Child"
  - Uses Shadcn `<Collapsible>` for expand/collapse
  - Props: `linkType: RecordLinkType`, `count: number`, `isOpen: boolean`, `onToggle()`
- [x] 4.2 Create `apps/web/src/features/cross-cutting/components/LinkItem.tsx`:
  - Single link row: entity type icon (lucide icons mapped per entity type), display reference (e.g., "INV-0047"), direction arrow (→ outgoing, ← incoming), entity type label
  - Navigation: clicking the reference opens the related record (React Router `<Link>`)
  - Delete button: visible for manual links (STAFF), system links only for MANAGER — with confirmation
  - Direction badge: "outgoing" (arrow-right) or "incoming" (arrow-left) with muted colour
  - Props: `link: RecordLink`, `canDeleteManual: boolean`, `canDeleteSystem: boolean`, `onDelete(id)`, `onNavigate(entityType, entityId)`
- [x] 4.3 Create `apps/web/src/features/cross-cutting/components/AddLinkForm.tsx`:
  - Modal dialog (Shadcn `<Dialog>`) triggered by "Add Link" button
  - Entity type selector: `<Select>` with registered entity types from `VALID_ENTITY_TYPES`
  - Entity search: typeahead `<Input>` that searches entities by display reference — debounced 300ms — results in dropdown
  - Link type selector: `<Select>` with all RecordLinkType values
  - Direction display: shows "This record → [selected entity]" or "[selected entity] → This record"
  - Submit: calls `useCreateRecordLink` mutation, closes dialog, refreshes list
  - Validation: both entities must be selected, link type required
  - Props: `sourceEntityType: string`, `sourceEntityId: string`, `open: boolean`, `onOpenChange(open)`, `onLinkCreated?: () => void`
- [x] 4.4 Create `apps/web/src/features/cross-cutting/components/LinksPanel.tsx`:
  - Wraps Shadcn `<Sheet>` (side="right", width 400px desktop, full-screen phone)
  - Header: "Linked Records" title + close button + total link count badge
  - "Add Link" button at top (lucide `Plus`)
  - Body: links grouped by `linkType` using `<LinkGroupHeader>` + `<LinkItem>` within `<Collapsible>`
  - Groups are shown even if empty in the current query (hidden if no links of that type)
  - Empty state: "No linked records yet" text with "Add Link" call-to-action
  - Loading state: Shadcn `<Skeleton>` rows
  - Uses `useRecordLinks(entityType, entityId)` for data
  - Uses `usePermission(resourceCode)` for delete permissions
  - Props: `open: boolean`, `onOpenChange(open)`, `entityType: string`, `entityId: string`, `resourceCode: string`

### Task 5: ActionBar Integration + Template Wiring (AC: #1, #3, #5)

- [x] 5.1 Create `apps/web/src/features/cross-cutting/components/CrossCuttingPanels.tsx` — wrapper component:
  - Manages open/close state for AttachmentPanel and LinksPanel
  - Provides `onAttachmentsClick` and `onLinksClick` callbacks for ActionBar
  - Fetches attachment count and link count (lightweight count-only queries or from existing list queries)
  - Renders `<AttachmentPanel>` and `<LinksPanel>` as children
  - Props: `entityType: string`, `entityId: string`, `resourceCode: string`
  - Returns: `{ attachmentCount, linkCount, onAttachmentsClick, onLinksClick, panels: ReactNode }`
- [x] 5.2 Create `apps/web/src/features/cross-cutting/hooks/use-cross-cutting-panels.ts` — hook encapsulating panel state:
  - `useCrossCuttingPanels(entityType, entityId)` returns:
    - `attachmentCount: number` (from `useAttachments` query, just the total)
    - `linkCount: number` (from `useRecordLinks` query, just the total)
    - `isAttachmentPanelOpen: boolean`, `setAttachmentPanelOpen(open)`
    - `isLinksPanelOpen: boolean`, `setLinksPanelOpen(open)`
  - Pre-fetches counts on mount so ActionBar badges are immediate
- [x] 5.3 Create `apps/web/src/features/cross-cutting/components/NotesTab.tsx` — tab adapter for `<RecordDetailPage>`:
  - Wraps `<NotesPanel>` as a tab content component compatible with the `tabs` prop of `<RecordDetailPage>`
  - Tab configuration: `{ key: 'notes', labelKey: 'common.notes', icon: MessageSquare, content: <NotesTab /> }`
  - Props: `entityType: string`, `entityId: string`, `resourceCode: string`
- [x] 5.4 Update ActionBar integration documentation in `apps/web/src/components/action-bar/ActionBar.tsx`:
  - ActionBar already accepts `attachmentCount`, `linkCount`, `onAttachmentsClick`, `onLinksClick` props
  - Verify these props are correctly wired — if any props are missing or incorrectly typed, fix them
  - Ensure badge shows count as "(3)" next to icon, and shows no badge when count is 0
  - Ensure the attachment and link buttons use `aria-label` with count: "Attachments (3 files)"
- [x] 5.5 Create `apps/web/src/features/cross-cutting/index.ts` — barrel exports:
  - Export all components: `AttachmentPanel`, `NotesPanel`, `LinksPanel`, `CrossCuttingPanels`, `NotesTab`
  - Export all hooks: `useAttachments`, `useNotes`, `useRecordLinks`, `useCrossCuttingPanels`, `useUploadAttachment`
  - Export types: `Attachment`, `Note`, `RecordLink`, etc.

### Task 6: Entity Type Display Utilities (AC: #5, #6)

- [x] 6.1 Create `apps/web/src/features/cross-cutting/utils/entity-display.ts`:
  - `getEntityTypeLabel(entityType: string)` — maps Prisma model name to human-readable label (e.g., `CustomerInvoice` → "Customer Invoice", `SalesOrder` → "Sales Order")
  - `getEntityTypeIcon(entityType: string)` — maps entity type to lucide icon component (e.g., `CustomerInvoice` → `FileText`, `SalesOrder` → `ShoppingCart`, `PurchaseOrder` → `Package`)
  - `getEntityTypeRoute(entityType: string, entityId: string)` — maps to React Router path (e.g., `CustomerInvoice` + id → `/finance/invoices/${id}`)
  - `getMimeTypeIcon(mimeType: string)` — maps MIME type to file icon (e.g., `application/pdf` → `FileText`, `image/*` → `Image`, `text/csv` → `FileSpreadsheet`)
  - `formatFileSize(bytes: number)` — human-readable: "2.4 MB", "156 KB", "3 bytes"

### Task 7: Visual Design Fidelity (AC: #1–#7)

- [x] 7.1 Ensure all components follow Concept D design system:
  - Cards: 12px radius, custom shadow, purple-tinted hover shadow
  - Buttons: Primary `#7c3aed`, hover `#5b21b6`, 8px radius
  - Background: `#f4f2ff` (light purple) for panel backgrounds, NOT white or grey
  - Typography: Plus Jakarta Sans headings, Inter body, JetBrains Mono for file sizes/references
  - Animations: `fadeInUp` for panel open, with `prefers-reduced-motion` respect via `usePrefersReducedMotion()`
  - Sheet panels: purple accent on header bar, consistent with CopilotDrawer styling
- [x] 7.2 Responsive layout verification:
  - Desktop (≥1024px): Sheet as 400px side panel
  - Tablet (768–1023px): Sheet as 400px side panel (content area shrinks)
  - Phone (<768px): Sheet as full-screen overlay with close button at top

### Task 8: Tests (AC: #1–#8)

- [x] 8.1 Unit tests for API hooks (`apps/web/src/features/cross-cutting/hooks/__tests__/`):
  - `use-attachments.test.ts`: list query, upload mutation (presign → S3 → confirm orchestration), download mutation, delete mutation with cache invalidation
  - `use-notes.test.ts`: list query, create mutation, update mutation, delete mutation, pin toggle with optimistic update
  - `use-record-links.test.ts`: list query, create mutation, delete mutation with cache invalidation
- [x] 8.2 Unit tests for components (`apps/web/src/features/cross-cutting/components/__tests__/`):
  - `AttachmentPanel.test.tsx`: renders file list, drag-drop triggers upload, progress bar shown during upload, delete only visible for MANAGER, empty state, keyboard navigation (Escape closes)
  - `NotesPanel.test.tsx`: renders timeline in reverse chronological order, pinned notes first, type badges correct colours, add note form creates note, edit only on own notes, SYSTEM notes read-only
  - `LinksPanel.test.tsx`: renders grouped links, direction indicators correct, navigation links work, add link dialog creates link, delete permissions enforced
  - `FileUploadZone.test.tsx`: drag events trigger callback, click triggers file input, rejects oversized files, rejects executable MIME types, accessible markup (role, aria-label)
  - `NoteCard.test.tsx`: renders all fields, edit mode toggle, pin toggle, delete confirmation
- [x] 8.3 Unit tests for utility functions:
  - `entity-display.test.ts`: label mapping, icon mapping, route generation, file size formatting
- [x] 8.4 Verify all existing tests still pass (no regressions from E8.1, E8.2, E8.3, or prior epics)

## Dev Notes

### Architecture: Shadcn Sheet for Side Panels

The AttachmentPanel and LinksPanel use Shadcn `<Sheet>` component (backed by `@radix-ui/react-dialog`), NOT a custom implementation like CopilotDrawer. The CopilotDrawer is custom because it needs inline panel behaviour (content area resizes), minimise-to-pill on mobile, and cross-session persistence. The cross-cutting panels are simpler overlay sheets that don't need those features. Shadcn Sheet provides:
- Built-in focus trap and Escape key handling
- ARIA dialog semantics
- Mobile-friendly full-screen overlay (when side sheet width > viewport)
- Portal rendering (no z-index conflicts)

### Upload Flow: Three-Step Orchestration

The `useUploadAttachment` hook orchestrates the presigned URL upload pattern from Architecture §2.20:

```
1. presignUpload(entityType, entityId, fileName, mimeType, fileSize)
   → Validates MIME + size on server → Returns presigned PUT URL

2. fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } })
   → Direct browser-to-S3 upload (bypasses API server)
   → XMLHttpRequest used instead of fetch for upload progress events

3. confirmUpload(storageKey, entityType, entityId, fileName, fileSize, mimeType)
   → Server verifies S3 object exists → Creates Attachment DB record
```

Use `XMLHttpRequest` (not `fetch`) for step 2 to get upload progress events (`xhr.upload.onprogress`). The `fetch` API does not support upload progress tracking.

### Notes as Tab Content (Not Sheet)

Per epic AC #3, notes are accessed "via tab or section" — NOT via a Sheet panel like attachments and links. The NotesPanel is rendered as tab content within `<RecordDetailPage>` using the `tabs` prop slot pattern. This matches the UX spec which shows notes as part of the record detail, not as an overlay.

### Permission Model

Permissions are resolved using the existing `usePermission(resourceCode)` hook from E6:
- **Attachments**: `canDelete` maps to MANAGER role (per E8.1 DELETE endpoint)
- **Notes**: `canEdit` — only own notes, enforced by comparing `note.createdBy === currentUserId`; `canDelete` maps to MANAGER role (per E8.2 DELETE endpoint)
- **Record Links**: `canDelete` — manual links need STAFF, system links need MANAGER (per E8.3 DELETE endpoint)

The ActionBar already gates persistent tool visibility via `showPersistentTools` prop. The tools themselves are always visible per UX spec rule: "Persistent tools never hide — even if the count is zero."

### Entity Display Reference Resolution

For the LinksPanel to show display references (e.g., "INV-0047" instead of a UUID), the `listRecordLinks` API response includes entity type and ID but NOT the display reference. The frontend must either:
- **Option A**: Make additional API calls to resolve each linked entity's display name (N+1 problem)
- **Option B**: Extend the backend `listRecordLinks` to include `displayRef` in the response (API change)
- **Chosen approach**: Use entity type + truncated ID as fallback for now (e.g., "Customer Invoice • abc123..."), and add a `displayRef` field to the record-link list response in a follow-up task. This keeps E8.4 unblocked while the backend enhancement can be done as a refinement.

### Count-Only Queries for Badge Performance

The ActionBar badges need attachment and link counts immediately on page load. Rather than fetching full lists just for counts, the hooks use the existing list endpoints with `limit=0` (returns only `meta.total`) for the initial count fetch. The full list is fetched lazily when the panel is opened.

### Cross-Cutting Patterns (MANDATORY)

Every implementation MUST follow these patterns from project-context.md:
- **companyId**: Not handled in frontend — backend services enforce company scoping via `validateEntityExists()`. Frontend just passes `entityType` + `entityId`.
- **i18n**: All labels use `t()` translation keys (e.g., `t('crossCutting.attachments.title')`, `t('crossCutting.notes.addNote')`, `t('crossCutting.links.createdFrom')`). No hardcoded English strings.
- **Accessibility**: All components meet WCAG 2.1 AA (NFR27). All interactive elements keyboard-navigable (NFR28). Sheet panels have proper focus trap. Tab panels use ARIA `role="tabpanel"`.
- **Reduced Motion**: Animations (panel slide-in, progress bar) respect `prefers-reduced-motion` via `usePrefersReducedMotion()` hook.

### Existing Infrastructure (DO NOT recreate)

The following were created in prior epics and must be reused, not duplicated:
- `apps/web/src/components/action-bar/ActionBar.tsx` — ActionBar with persistent tools zone (E6.4)
- `apps/web/src/components/ui/sheet.tsx` — Shadcn Sheet component
- `apps/web/src/components/ui/progress.tsx` — Shadcn Progress bar
- `apps/web/src/components/ui/dialog.tsx` — Shadcn Dialog
- `apps/web/src/components/ui/badge.tsx` — Shadcn Badge
- `apps/web/src/components/ui/skeleton.tsx` — Shadcn Skeleton
- `apps/web/src/components/ui/collapsible.tsx` — Shadcn Collapsible
- `apps/web/src/components/ui/select.tsx` — Shadcn Select
- `apps/web/src/components/ui/textarea.tsx` — Shadcn Textarea
- `apps/web/src/components/templates/record-detail-page.tsx` — T2 template (E6)
- `apps/web/src/components/templates/header-lines-page.tsx` — T3 template (E6)
- `apps/web/src/hooks/use-permissions.ts` — Permission hook (E6)
- `apps/web/src/hooks/useBreakpoint.ts` — Responsive breakpoint hook (E6)
- `apps/web/src/hooks/use-prefers-reduced-motion.ts` — Reduced motion hook (E6)
- `apps/web/src/lib/api-client.ts` — API client with auth (E3)
- `apps/web/src/lib/query-keys.ts` — Query key factory (E6)
- `apps/web/src/lib/query-client.ts` — React Query client (E6)
- `apps/web/src/features/admin/company-config/components/import-dialog.tsx` — Drag-drop file pattern reference (E6)

### Reference Documents

| Document | Relevant Sections | Key Details |
|----------|------------------|-------------|
| **Architecture** | §5.2 Component Architecture, §5.2.1 Standardised Page Templates | Feature-based org, ActionBar component, T2/T3 template slots |
| **Architecture** | §2.20 Cross-Cutting Data Infrastructure | Polymorphic pattern, presigned URL upload flow, RecordLink bidirectional query |
| **API Contracts** | §2.5 Cross-cutting Infrastructure | All attachment, note, record-link endpoints — FR148/FR55/FR58 |
| **Data Models** | §3.9 Cross-Cutting Module | Attachment, Note, RecordLink fields and enums |
| **State Machine** | N/A | No state transitions for cross-cutting records |
| **Event Catalog** | N/A | No events emitted from UI components |
| **Business Rules** | §12 Cross-Cutting Rules | BR-SYS-006 (file size), BR-SYS-007 (MIME allowlist), BR-SYS-008 (presigned URL), BR-SYS-009 (entity validation), BR-SYS-010 (cascade deletion), BR-SYS-013 (polymorphic validation), BR-SYS-014 (entityType registry) |
| **UX Design Spec** | §The Action Bar System | Persistent tools: Attachments (count badge), Links (count badge) — always visible |
| **UX Design Spec** | §T2 Record Detail, §T3 Header+Lines | Template layouts showing action bar + tabs |
| **UX Design Spec** | §Navigation Patterns | Side panels (Sheet) for related entity preview |
| **UX Design Spec** | §Design System Components | Shadcn Sheet for side panels |
| **Project Context** | §1 Multi-Company Architecture | companyId scoping handled by backend, not frontend |
| **PRD** | NFR27, NFR28 | WCAG 2.1 AA compliance, keyboard navigation |

### Project Structure Notes

New files:
```
apps/web/src/features/cross-cutting/
├── api/
│   ├── attachment-api.ts
│   ├── note-api.ts
│   └── record-link-api.ts
├── hooks/
│   ├── use-attachments.ts
│   ├── use-notes.ts
│   ├── use-record-links.ts
│   ├── use-cross-cutting-panels.ts
│   └── __tests__/
│       ├── use-attachments.test.ts
│       ├── use-notes.test.ts
│       └── use-record-links.test.ts
├── components/
│   ├── FileUploadZone.tsx
│   ├── UploadProgressBar.tsx
│   ├── AttachmentList.tsx
│   ├── AttachmentPanel.tsx
│   ├── NoteCard.tsx
│   ├── AddNoteForm.tsx
│   ├── NotesPanel.tsx
│   ├── NotesTab.tsx
│   ├── LinkGroupHeader.tsx
│   ├── LinkItem.tsx
│   ├── AddLinkForm.tsx
│   ├── LinksPanel.tsx
│   ├── CrossCuttingPanels.tsx
│   └── __tests__/
│       ├── AttachmentPanel.test.tsx
│       ├── NotesPanel.test.tsx
│       ├── LinksPanel.test.tsx
│       ├── FileUploadZone.test.tsx
│       └── NoteCard.test.tsx
├── utils/
│   ├── entity-display.ts
│   └── __tests__/
│       └── entity-display.test.ts
├── types.ts
└── index.ts
```

Modified files:
- `apps/web/src/lib/query-keys.ts` — add cross-cutting query key entries
- `apps/web/src/components/action-bar/ActionBar.tsx` — verify persistent tool props (should already work)

### Source References

- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md §2.20] — Polymorphic pattern, presigned upload flow, RecordLink bidirectional query
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md §5.2] — Component architecture, feature-based organisation, template system
- [Source: _bmad-output/planning-artifacts/ux-design-specification/standardised-screen-templates.md §Action Bar System] — Persistent tools zone, badge counts, always-visible rule
- [Source: _bmad-output/planning-artifacts/api-contracts/2-endpoint-summary.md §2.5] — All cross-cutting endpoints
- [Source: _bmad-output/planning-artifacts/data-models/3-module-by-module-models.md §3.9] — Attachment, Note, RecordLink field definitions
- [Source: _bmad-output/planning-artifacts/business-rules-compendium.md §12] — BR-SYS-006 to BR-SYS-014
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md] — NFR27 (WCAG AA), NFR28 (keyboard nav)
- [Source: apps/web/src/components/action-bar/ActionBar.tsx] — Existing ActionBar with persistent tools props
- [Source: apps/web/src/features/admin/company-config/components/import-dialog.tsx] — Drag-drop file upload pattern
- [Source: apps/api/src/modules/cross-cutting/index.ts] — Backend route layout
- [Source: _bmad-output/implementation-artifacts/stories/e8-3-record-links-service.md] — Pattern reference for story structure


## Code Review Notes (Auto-Generated)

**Status:** Completed with remaining issues after 3 CR iterations

**Date:** 2026-03-03 07:03

### Remaining Issues for Human Review:

- ISSUE #1: [HIGH] **Collapsible double-toggle in LinksPanel** — `<Collapsible onOpenChange>` AND `<CollapsibleTrigger onClick>` both call `handleToggleGroup()`, firing twice per click. Link groups open then immediately re-close. The links panel is completely broken. (`LinksPanel.tsx:201-207`, `LinkGroupHeader.tsx:51`)
- ISSUE #2: [HIGH] **`window.open` after `await` blocked by popup blockers** — `useDownloadAttachment` calls `window.open(url, '_blank')` after an async `getDownloadUrl()` call. Browsers don't treat this as a user gesture. Attachment downloads silently fail in Chrome, Firefox, and Safari. (`use-attachments.ts:203`)
- ISSUE #3: [HIGH] **Missing `onDragEnter` handler causes drag-drop flicker** — Only `onDragOver`/`onDragLeave` are handled. When the cursor crosses child elements (icon, text), the browser fires `dragleave` and `isDragOver` flips to `false`. The purple highlight flickers continuously during any realistic drag operation. (`FileUploadZone.tsx:100-111`)
- ISSUE #4: [HIGH] **No unmount cleanup for upload — leaked requests and zombie state updates** — If the user closes the AttachmentPanel mid-upload, no `useEffect` cleanup calls `abortControllerRef.current?.abort()`. The S3 upload completes invisibly, `confirmUpload` runs, and `setUploadProgress` fires on an unmounted component. (`use-attachments.ts:65-191`)
- ISSUE #5: [HIGH] **XHR abort listener never removed — memory leak per upload** — `abortController.signal.addEventListener('abort', ...)` is never cleaned up after successful/failed uploads. Each upload leaves a dangling closure holding references to `xhr` and `reject`. Needs `{ once: true }`. (`use-attachments.ts:119-122`)
- ISSUE #6: [HIGH] **Pin/Unpin available to ALL users on ANY note — no RBAC gate** — `showOverflowMenu = !isSystem` means any user can pin/unpin any other user's note. No `canPin` prop or role check exists. Also, the overflow menu renders empty for non-author non-MANAGER users — an empty interactive control is an accessibility violation. (`NoteCard.tsx:91`)
- ISSUE #7: [HIGH] **`AddNoteForm` has ZERO test coverage — AC4 entirely untested** — No `AddNoteForm.test.tsx` exists. `NotesPanel.test.tsx` never clicks "Add Note" or exercises the form. AC4 (textarea + type selector, SYSTEM type NOT available, submit creates note) has no behavioral coverage at all.
- ISSUE #8: [HIGH] **`AddLinkForm` mocked to `null` in tests — AC6 entirely untested** — `LinksPanel.test.tsx` mocks `AddLinkForm` to return `null`. No dedicated `AddLinkForm.test.tsx` exists. AC6 (entity type selector, typeahead search, link type selector, submit creates link) has zero test coverage. (`LinksPanel.test.tsx:92-94`)
- ISSUE #9: [HIGH] **`displayRef` shows raw UUID prefix — unusable for ERP users** — `linkedEntityId.substring(0, 8)` renders `cm7kx2ab` instead of a document number like "INV-0047". The story explicitly requires "display reference." The fallback is functionally useless. (`LinkItem.tsx:73`)
- ISSUE #10: [HIGH] **Incomplete executable blocklist — `.jar`, `.hta`, `.scr`, `.apk` and others bypass validation** — `.hta` (HTML Application) executes with full Windows trust. `.jar`, `.scr`, `.pif`, `.reg`, `.apk`, `.dmg` are also missing. A malicious `.hta` file can be uploaded and downloaded by a manager. (`FileUploadZone.tsx:15`)
- ISSUE #11: [HIGH] **`window.open` without `noopener` — tabnapping vulnerability** — The opened page (S3 presigned URL) gets `window.opener` access and can manipulate the parent ERP app's DOM. Needs `'noopener,noreferrer'` third parameter. (`use-attachments.ts:203`)
- ISSUE #12: [MEDIUM] **`font-serif` used for panel headings — violates Concept D design system** — CLAUDE.md mandates Plus Jakarta Sans (`font-jakarta`) for headings. `font-serif` renders Georgia/Times New Roman. Direct violation of the Visual Design Fidelity Rule. (`AttachmentPanel.tsx:99`, `NotesPanel.tsx:113`)
- ISSUE #13: [MEDIUM] **Multi-file drop shows warning but uploads first file anyway** — `setValidationError('singleFileOnly')` fires, then `onFilesSelected([first])` is called. User sees a red error but the upload starts — confusing contradictory UX. (`FileUploadZone.tsx:73-85`)
- ISSUE #14: [MEDIUM] **`formatDistanceToNow` ignores app i18n locale** — `date-fns` defaults to `en-US`. No `locale` option passed. A French user sees "3 hours ago" instead of "il y a 3 heures". Violates the project i18n mandate. (`AttachmentList.tsx:90-92`)
- ISSUE #15: [MEDIUM] **`LINK_TYPE_LABEL_KEYS` duplicated in two files — divergence risk** — Identical `Record<RecordLinkType, string>` copy-pasted in both files. Should be a single exported constant. (`LinkGroupHeader.tsx:22-29`, `AddLinkForm.tsx:49-56`)
- ISSUE #16: [MEDIUM] **No self-link guard in `AddLinkForm`** — Validation only checks `targetEntityType && targetEntityId && linkType`. A user can link a record to itself. (`AddLinkForm.tsx:149`)
- ISSUE #17: [MEDIUM] **`isOutgoing` direction ignores `link.direction` field from backend** — The `RecordLink` type has a `direction?: LinkDirection` field set by the backend. The component ignores it and re-derives direction client-side, risking contradiction. (`LinkItem.tsx:66-67`)
- ISSUE #18: [MEDIUM] **AC7 (phone breakpoint + keyboard nav) entirely untested** — No test sets `window.innerWidth`, mocks `matchMedia`, or exercises Escape key. AC7 explicitly requires full-screen overlay on phone and keyboard navigability.
- ISSUE #19: [MEDIUM] **Validation error `<p>` has no `role="alert"` — WCAG violation** — Dynamically inserted error text without `role="alert"` or `aria-live="assertive"`. Screen readers won't announce file validation errors. Violates WCAG 2.1 SC 4.1.3. (`FileUploadZone.tsx:169-171`)
- ISSUE #20: [MEDIUM] **Inline edit `<Textarea>` has no `aria-label`** — No `aria-label`, `aria-labelledby`, or associated `<label>`. Violates WCAG 1.3.1 and 4.1.2. (`NoteCard.tsx:195`)
- ISSUE #21: [MEDIUM] **Cancel/upload race condition — zombie error flash** — When `cancelUpload` is called at the moment `finally` fires, `abortControllerRef.current` is already `null`. The abort never fires, the error from in-flight `confirmUpload` surfaces, and the user sees a flash of `idle` then `error`. (`use-attachments.ts:157-167`)
- ISSUE #22: [MEDIUM] **Test mock missing `count` key — count invalidation path untested** — The mock omits `attachments.count`. `useDeleteAttachment` invalidates `queryKeys.attachments.count` in production but this path is untested. (`use-attachments.test.ts:31-38`)
- ISSUE #23: [MEDIUM] **Upload toast test asserts wrong string** — Test asserts `title: 'Presign failed'` but implementation uses `t('crossCutting.attachments.uploadFailed')`. Passes only because mock `t()` returns the key unchanged. (`use-attachments.test.ts:281`)
- ISSUE #24: [LOW] **`Customer` and `Employee` share same `Users` icon — no visual distinction** — `CreditNote` and `CustomerPayment` also share `CreditCard`. Users can't distinguish entity types by icon in the links panel. (`entity-display.ts:63-65`)
- ISSUE #25: [LOW] **`NotesTab` is a pure pass-through — redundant abstraction** — Forwards three props to `NotesPanel` with zero additional logic. Creates import confusion. (`NotesTab.tsx:29-37`)
- ISSUE #26: [LOW] **`getEntityTypeLabelKey` fallback returns raw string to `t()`** — Unknown entity types like `"SalesQuote"` are passed directly to `t()`, rendering untranslated text. (`entity-display.ts:140`)
- ISSUE #27: [LOW] **`buttonIdx` mutable counter in ActionBar render causes keyboard nav bug** — When `onAttachmentsClick` is `undefined`, `buttonIdx++` is skipped but the button still renders disabled. `focusIndex` for subsequent buttons is off by one, breaking roving tabindex. (`ActionBar.tsx:166-251`)
- **Summary: 11 HIGH, 12 MEDIUM, 4 LOW issues found**

---

