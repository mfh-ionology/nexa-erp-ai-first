# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-visible sidebar with a hamburger mega-menu, persistent favourites toolbar, and auto-detected module context bar.

**Architecture:** Remove the sidebar from AppLayout and replace with three horizontal layers: header (56px, now with hamburger at all breakpoints), favourites toolbar (40px, pinned page shortcuts), and module context bar (32px, auto-detected from URL). Navigation lives in a 380px slide-from-left mega-menu panel with drill-down accordion. Favourites stored in a new `UserFavouritePage` DB model. Mobile nav style is a per-user preference (`mobileNavStyle` enum on User model).

**Tech Stack:** React 19, Zustand, TanStack Router, Tailwind 4, Shadcn UI, Prisma 7, Fastify 5

**Spec:** `docs/superpowers/specs/2026-03-13-navigation-redesign-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/components/layout/mega-menu.tsx` | Slide-out mega-menu panel with accordion modules |
| `apps/web/src/components/layout/mega-menu-item.tsx` | Single module tile in the mega-menu |
| `apps/web/src/components/layout/favourites-toolbar.tsx` | Horizontal bar of pinned page chips with overflow |
| `apps/web/src/components/layout/module-context-bar.tsx` | Auto-detected module context bar with pills |
| `apps/web/src/stores/mega-menu-store.ts` | Zustand store for mega-menu open/close state |
| `apps/web/src/hooks/use-active-module.ts` | Hook to detect current module from URL path |
| `apps/web/src/hooks/use-favourite-pages.ts` | Hook for CRUD on pinned page shortcuts |
| `apps/web/src/features/favourite-pages/api.ts` | API client for UserFavouritePage endpoints |
| `apps/web/src/features/favourite-pages/types.ts` | TypeScript types for favourite pages |
| `apps/api/src/modules/system/favourite-pages.service.ts` | Service layer for UserFavouritePage CRUD |
| `apps/api/src/modules/system/favourite-pages.schema.ts` | Zod schemas for request/response validation |
| `apps/api/src/modules/system/favourite-pages.routes.ts` | Fastify routes for favourite pages API |
| `apps/web/src/lib/icon-resolver.ts` | Shared utility to resolve Lucide icon components from string names |
| `apps/api/src/modules/system/favourite-pages-seeder.ts` | Seeds default favourite pages for new users |
| `apps/web/src/features/settings/components/mobile-nav-settings.tsx` | User settings UI for mobile navigation preference |

### Modified Files

| File | Changes |
|------|---------|
| `packages/db/prisma/schema.prisma` | Add `UserFavouritePage` model, `MobileNavStyle` enum, `mobileNavStyle` field on User |
| `apps/web/src/lib/navigation-config.ts` | Add `category` field to `NavigationItem`, add `displayOrder` to `NavigationModule` |
| `apps/web/src/components/layout/app-layout.tsx` | Remove sidebar, add favourites toolbar + module context bar, conditional mobile nav |
| `apps/web/src/components/layout/app-header.tsx` | Hamburger visible at all breakpoints, opens mega-menu |
| `apps/web/src/components/layout/bottom-tab-bar.tsx` | Support 3 mobile nav modes |
| `apps/web/src/hooks/use-breakpoint.ts` | Remove sidebar auto-sync, only determine breakpoint |

### Deprecated (kept but no longer rendered)

| File | Status |
|------|--------|
| `apps/web/src/components/layout/app-sidebar.tsx` | Kept in codebase, no longer rendered |
| `apps/web/src/components/layout/sidebar-item.tsx` | Kept in codebase, no longer rendered |
| `apps/web/src/components/layout/sidebar-group.tsx` | Kept in codebase, no longer rendered |
| `apps/web/src/stores/sidebar-store.ts` | Kept in codebase, no longer imported |

---

## Chunk 1: Data Layer (Prisma + API)

### Task 1: Database Schema — UserFavouritePage model + User mobileNavStyle

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add MobileNavStyle enum and UserFavouritePage model to schema**

Add after the existing `ViewScope` enum:

```prisma
enum MobileNavStyle {
  CLASSIC_TABS
  MINIMAL
  MY_SHORTCUTS
}
```

Add `mobileNavStyle` to the User model (after `locale` field):

```prisma
mobileNavStyle MobileNavStyle @default(CLASSIC_TABS) @map("mobile_nav_style")
```

Add new model (after SavedView model):

```prisma
model UserFavouritePage {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  companyId    String   @map("company_id")
  path         String   @db.VarChar(255)
  label        String   @db.VarChar(100)
  iconKey      String   @map("icon_key") @db.VarChar(50)
  displayOrder Int      @default(0) @map("display_order")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  company CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([userId, companyId, path])
  @@index([userId, companyId, displayOrder])
  @@map("user_favourite_pages")
}
```

Add relation to User model:

```prisma
favouritePages UserFavouritePage[]
```

Add relation to CompanyProfile model:

```prisma
favouritePages UserFavouritePage[]
```

- [ ] **Step 2: Generate migration**

Run: `cd packages/db && npx prisma migrate dev --name add-favourite-pages-and-mobile-nav-style --create-only`

Review the generated SQL, then apply:

Run: `npx prisma migrate dev`

- [ ] **Step 3: Verify schema and generate client**

Run: `npx prisma generate`
Expected: No errors, `@nexa/db` updated with new types

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/
git commit -m "feat: add UserFavouritePage model and mobileNavStyle enum to schema"
```

---

### Task 2: Backend API — Favourite Pages Service

**Files:**
- Create: `apps/api/src/modules/system/favourite-pages.service.ts`

- [ ] **Step 1: Write the service with CRUD operations**

```typescript
import type { PrismaClient } from '@nexa/db';

export interface CreateFavouritePageInput {
  path: string;
  label: string;
  iconKey: string;
}

export interface ReorderFavouritePagesInput {
  orderedIds: string[];
}

export async function listFavouritePages(
  db: PrismaClient,
  userId: string,
  companyId: string,
) {
  return db.userFavouritePage.findMany({
    where: { userId, companyId },
    orderBy: { displayOrder: 'asc' },
  });
}

export async function createFavouritePage(
  db: PrismaClient,
  userId: string,
  companyId: string,
  input: CreateFavouritePageInput,
) {
  const maxOrder = await db.userFavouritePage.aggregate({
    where: { userId, companyId },
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

  return db.userFavouritePage.create({
    data: {
      userId,
      companyId,
      path: input.path,
      label: input.label,
      iconKey: input.iconKey,
      displayOrder: nextOrder,
    },
  });
}

export async function deleteFavouritePage(
  db: PrismaClient,
  userId: string,
  companyId: string,
  pageId: string,
) {
  return db.userFavouritePage.delete({
    where: {
      id: pageId,
      userId,
      companyId,
    },
  });
}

export async function deleteFavouritePageByPath(
  db: PrismaClient,
  userId: string,
  companyId: string,
  path: string,
) {
  return db.userFavouritePage.deleteMany({
    where: { userId, companyId, path },
  });
}

export async function reorderFavouritePages(
  db: PrismaClient,
  userId: string,
  companyId: string,
  input: ReorderFavouritePagesInput,
) {
  const updates = input.orderedIds.map((id, index) =>
    db.userFavouritePage.update({
      where: { id, userId, companyId },
      data: { displayOrder: index },
    }),
  );
  return db.$transaction(updates);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/system/favourite-pages.service.ts
git commit -m "feat: add favourite pages service layer"
```

---

### Task 3: Backend API — Favourite Pages Schemas + Routes

**Files:**
- Create: `apps/api/src/modules/system/favourite-pages.schema.ts`
- Create: `apps/api/src/modules/system/favourite-pages.routes.ts`
- Modify: `apps/api/src/modules/system/index.ts` (register routes)

**IMPORTANT:** Follow the existing route patterns in this codebase:
- Use `request.userId` and `request.companyId` (NOT `request.requestContext`)
- Import `prisma` from `@nexa/db` (NOT `fastify.prisma`)
- Use `sendSuccess()` from `../../core/utils/response.js` for all responses
- Add Zod schemas for all request/response validation
- The system module is mounted at `/system`, so routes here resolve to `/api/v1/system/favourite-pages/*`

- [ ] **Step 1: Write Zod schemas**

```typescript
// apps/api/src/modules/system/favourite-pages.schema.ts
import { z } from 'zod';
import { successEnvelope } from '../../core/utils/response.js';

export const favouritePageResponseSchema = z.object({
  id: z.string(),
  path: z.string(),
  label: z.string(),
  iconKey: z.string(),
  displayOrder: z.number(),
});

export const createFavouritePageSchema = {
  body: z.object({
    path: z.string().min(1).max(255),
    label: z.string().min(1).max(100),
    iconKey: z.string().min(1).max(50),
  }),
  response: { 201: successEnvelope(favouritePageResponseSchema) },
};

export const deleteFavouritePageSchema = {
  params: z.object({ id: z.string().uuid() }),
};

export const unpinByPathSchema = {
  body: z.object({ path: z.string().min(1).max(255) }),
};

export const reorderSchema = {
  body: z.object({ orderedIds: z.array(z.string().uuid()) }),
};

export const listFavouritePagesSchema = {
  response: { 200: successEnvelope(z.array(favouritePageResponseSchema)) },
};
```

- [ ] **Step 2: Write the Fastify route plugin**

```typescript
// apps/api/src/modules/system/favourite-pages.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { sendSuccess } from '../../core/utils/response.js';
import {
  listFavouritePages,
  createFavouritePage,
  deleteFavouritePage,
  deleteFavouritePageByPath,
  reorderFavouritePages,
} from './favourite-pages.service.js';
import {
  createFavouritePageSchema,
  deleteFavouritePageSchema,
  unpinByPathSchema,
  reorderSchema,
  listFavouritePagesSchema,
} from './favourite-pages.schema.js';

export async function favouritePagesRoutes(fastify: FastifyInstance) {
  // GET /system/favourite-pages
  fastify.get('/', { schema: listFavouritePagesSchema }, async (request, reply) => {
    const pages = await listFavouritePages(prisma, request.userId, request.companyId);
    return sendSuccess(reply, pages);
  });

  // POST /system/favourite-pages
  fastify.post('/', { schema: createFavouritePageSchema }, async (request, reply) => {
    const { path, label, iconKey } = request.body as { path: string; label: string; iconKey: string };
    const page = await createFavouritePage(prisma, request.userId, request.companyId, {
      path, label, iconKey,
    });
    return sendSuccess(reply, page, undefined, 201);
  });

  // DELETE /system/favourite-pages/:id
  fastify.delete('/:id', { schema: deleteFavouritePageSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteFavouritePage(prisma, request.userId, request.companyId, id);
    return sendSuccess(reply, null, undefined, 204);
  });

  // POST /system/favourite-pages/unpin-by-path (using POST to pass body)
  fastify.post('/unpin-by-path', { schema: unpinByPathSchema }, async (request, reply) => {
    const { path } = request.body as { path: string };
    await deleteFavouritePageByPath(prisma, request.userId, request.companyId, path);
    return sendSuccess(reply, null, undefined, 204);
  });

  // PUT /system/favourite-pages/reorder
  fastify.put('/reorder', { schema: reorderSchema }, async (request, reply) => {
    const { orderedIds } = request.body as { orderedIds: string[] };
    await reorderFavouritePages(prisma, request.userId, request.companyId, { orderedIds });
    return sendSuccess(reply, { success: true });
  });
}
```

- [ ] **Step 3: Register routes in system module plugin**

In the system module's plugin registration file, add:

```typescript
import { favouritePagesRoutes } from './favourite-pages.routes.js';
// Inside the plugin:
fastify.register(favouritePagesRoutes, { prefix: '/favourite-pages' });
```

Note: No `/api/` prefix — the system module is already mounted at `/api/v1/system`.

- [ ] **Step 4: Verify routes load**

Run: `cd apps/api && pnpm dev`
Expected: Server starts, no errors. Check logs for route registration.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/system/favourite-pages.schema.ts apps/api/src/modules/system/favourite-pages.service.ts apps/api/src/modules/system/favourite-pages.routes.ts apps/api/src/modules/system/index.ts
git commit -m "feat: add favourite pages API endpoints with Zod schemas"
```

---

### Task 4: Add mobileNavStyle to User schemas, service, and response

**Files:**
- Modify: `apps/api/src/modules/system/user.service.ts` (add mobileNavStyle to update input + select)
- Modify: `apps/api/src/modules/system/user.schema.ts` (add to response + update schemas)

- [ ] **Step 1: Update user.schema.ts**

In `userResponseSchema`, add:
```typescript
mobileNavStyle: z.enum(['CLASSIC_TABS', 'MINIMAL', 'MY_SHORTCUTS']).nullable(),
```

In `updateUserRequestSchema` (or equivalent), add:
```typescript
mobileNavStyle: z.enum(['CLASSIC_TABS', 'MINIMAL', 'MY_SHORTCUTS']).optional(),
```

- [ ] **Step 2: Update user.service.ts**

In the `userSelect` object (the Prisma select clause), add `mobileNavStyle: true`.

In the `updateUser` function, add `mobileNavStyle` to the allowed update fields.

- [ ] **Step 3: Verify the user profile API returns the field**

Run: `cd apps/api && pnpm dev`
Test: `GET /api/v1/system/users/me` should now include `mobileNavStyle: "CLASSIC_TABS"` in the response.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/system/user.service.ts apps/api/src/modules/system/user.schema.ts
git commit -m "feat: add mobileNavStyle to user API schemas and service"
```

---

## Chunk 2: Navigation Config & Stores

### Task 5: Extend NavigationItem with category field

**Files:**
- Modify: `apps/web/src/lib/navigation-config.ts`

- [ ] **Step 1: Add `category` to the NavigationItem interface**

At line ~15 in the `NavigationItem` interface, add:

```typescript
/** Categorises item for module context bar: page (default), setting, or report */
category?: 'page' | 'setting' | 'report';
```

- [ ] **Step 2: Add `displayOrder` to NavigationModule interface**

```typescript
/** Display order in mega-menu (lower = higher) */
displayOrder?: number;
```

- [ ] **Step 3: Tag existing items with categories**

Go through each module in `NAVIGATION_MODULES` and add `category: 'setting'` or `category: 'report'` where appropriate. Items without a category default to `'page'`. Examples:

For the `system` module:
- `system.settings` → `category: 'setting'`
- `system.notificationPreferences` → `category: 'setting'`
- `system.printPreferences` → `category: 'setting'`
- `system.documentTemplates` → `category: 'setting'`
- `system.users`, `system.companies`, `system.accessGroups`, `system.myPermissions` → `category: 'page'` (or omit, it's default)

For the `reporting` module:
- `reporting.financialReports` → `category: 'report'`
- `reporting.dashboards` → `category: 'report'`

For the `finance` module:
- `finance.periods` → `category: 'setting'`
- `finance.budgets` → `category: 'page'`

For `ai` module:
- `ai.admin.models`, `ai.admin.prompts`, etc. → `category: 'setting'`
- `ai.briefing`, `ai.memory` → `category: 'page'`

- [ ] **Step 4: Add displayOrder to each module**

Add `displayOrder` to each module in the array, matching the spec's order (1=Dashboard through 14=System).

- [ ] **Step 5: Add a helper to get items by category**

```typescript
export function getModuleItemsByCategory(
  module: NavigationModule,
  category: 'page' | 'setting' | 'report',
): NavigationItem[] {
  return module.items.filter((item) => (item.category ?? 'page') === category);
}
```

- [ ] **Step 6: Run existing navigation-config tests**

Run: `cd apps/web && pnpm vitest run src/lib/navigation-config.test.ts`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/navigation-config.ts
git commit -m "feat: add category and displayOrder to navigation config"
```

---

### Task 6: Create mega-menu store

**Files:**
- Create: `apps/web/src/stores/mega-menu-store.ts`

- [ ] **Step 1: Write the Zustand store**

```typescript
import { create } from 'zustand';

interface MegaMenuState {
  isOpen: boolean;
  expandedModule: string | null;
  filterQuery: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setExpandedModule: (moduleKey: string | null) => void;
  setFilterQuery: (query: string) => void;
}

export const useMegaMenuStore = create<MegaMenuState>((set) => ({
  isOpen: false,
  expandedModule: null,
  filterQuery: '',
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, filterQuery: '' }),
  toggle: () =>
    set((s) => ({
      isOpen: !s.isOpen,
      filterQuery: s.isOpen ? '' : s.filterQuery,
    })),
  setExpandedModule: (moduleKey) => set({ expandedModule: moduleKey }),
  setFilterQuery: (query) => set({ filterQuery: query }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/stores/mega-menu-store.ts
git commit -m "feat: add mega-menu Zustand store"
```

---

### Task 7: Create useActiveModule hook

**Files:**
- Create: `apps/web/src/hooks/use-active-module.ts`

- [ ] **Step 1: Add `pathPrefix` to NavigationModule interface**

In `navigation-config.ts`, add to the `NavigationModule` interface:

```typescript
/** URL prefix for module detection (e.g., '/finance', '/sales') */
pathPrefix: string;
```

Then add `pathPrefix` to each module in `NAVIGATION_MODULES`:
- `finance` → `pathPrefix: '/finance'`
- `ar` → `pathPrefix: '/ar'`
- `ap` → `pathPrefix: '/ap'`
- `sales` → `pathPrefix: '/sales'`
- `purchasing` → `pathPrefix: '/purchasing'`
- `inventory` → `pathPrefix: '/inventory'`
- `crm` → `pathPrefix: '/crm'`
- `hr` → `pathPrefix: '/hr'`
- `manufacturing` → `pathPrefix: '/manufacturing'`
- `reporting` → `pathPrefix: '/reporting'`
- `ai` → `pathPrefix: '/ai'`
- `system` → `pathPrefix: '/system'`

- [ ] **Step 2: Write the hook using explicit pathPrefix**

```typescript
import { useRouterState } from '@tanstack/react-router';
import { NAVIGATION_MODULES } from '@/lib/navigation-config';

/**
 * Returns the currently active module key based on the URL path,
 * or null if not inside a module (e.g., Dashboard, Tasks).
 */
export function useActiveModule(): string | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  for (const mod of NAVIGATION_MODULES) {
    if (pathname.startsWith(mod.pathPrefix)) {
      return mod.key;
    }
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-active-module.ts
git commit -m "feat: add useActiveModule hook for URL-based module detection"
```

---

### Task 8: Create favourite pages frontend API + hook

**Files:**
- Create: `apps/web/src/features/favourite-pages/types.ts`
- Create: `apps/web/src/features/favourite-pages/api.ts`
- Create: `apps/web/src/hooks/use-favourite-pages.ts`

- [ ] **Step 1: Write types**

```typescript
// apps/web/src/features/favourite-pages/types.ts
export interface FavouritePage {
  id: string;
  userId: string;
  companyId: string;
  path: string;
  label: string;
  iconKey: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFavouritePageInput {
  path: string;
  label: string;
  iconKey: string;
}
```

- [ ] **Step 2: Write API client**

```typescript
// apps/web/src/features/favourite-pages/api.ts
import { apiClient } from '@/lib/api-client';
import type { FavouritePage, CreateFavouritePageInput } from './types';

const BASE = '/system/favourite-pages';

export async function fetchFavouritePages(): Promise<FavouritePage[]> {
  const res = await apiClient.get(BASE);
  return res.data;
}

export async function pinPage(input: CreateFavouritePageInput): Promise<FavouritePage> {
  const res = await apiClient.post(BASE, input);
  return res.data;
}

export async function unpinPage(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function unpinPageByPath(path: string): Promise<void> {
  // Uses POST with body (not DELETE with query params) to match backend route
  await apiClient.post(`${BASE}/unpin-by-path`, { path });
}

export async function reorderPages(orderedIds: string[]): Promise<void> {
  await apiClient.put(`${BASE}/reorder`, { orderedIds });
}
```

- [ ] **Step 3: Write the hook**

```typescript
// apps/web/src/hooks/use-favourite-pages.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFavouritePages,
  pinPage,
  unpinPage,
  unpinPageByPath,
  reorderPages,
} from '@/features/favourite-pages/api';
import type { CreateFavouritePageInput } from '@/features/favourite-pages/types';

const QUERY_KEY = ['favourite-pages'] as const;

export function useFavouritePages() {
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFavouritePages,
    staleTime: 60_000,
  });

  const pinMutation = useMutation({
    mutationFn: (input: CreateFavouritePageInput) => pinPage(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const unpinMutation = useMutation({
    mutationFn: (id: string) => unpinPage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const unpinByPathMutation = useMutation({
    mutationFn: (path: string) => unpinPageByPath(path),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderPages(orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const isPinned = (path: string) => pages.some((p) => p.path === path);

  const togglePin = (path: string, label: string, iconKey: string) => {
    const existing = pages.find((p) => p.path === path);
    if (existing) {
      unpinMutation.mutate(existing.id);
    } else {
      pinMutation.mutate({ path, label, iconKey });
    }
  };

  return {
    pages,
    isLoading,
    isPinned,
    togglePin,
    pin: pinMutation.mutate,
    unpin: unpinMutation.mutate,
    unpinByPath: unpinByPathMutation.mutate,
    reorder: reorderMutation.mutate,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/favourite-pages/ apps/web/src/hooks/use-favourite-pages.ts
git commit -m "feat: add favourite pages API client and useFavouritePages hook"
```

---

## Chunk 3: Mega-Menu Component

### Task 9: Build the MegaMenuItem component

**Files:**
- Create: `apps/web/src/components/layout/mega-menu-item.tsx`

- [ ] **Step 1: Write the component**

A single module tile in the accordion. Shows icon, name, description, chevron, and expandable sub-items with pin stars.

```typescript
import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Star } from 'lucide-react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFavouritePages } from '@/hooks/use-favourite-pages';
import type { NavigationModule, NavigationItem } from '@/lib/navigation-config';
import { useMegaMenuStore } from '@/stores/mega-menu-store';

import { useI18n } from '@nexa/i18n';

function resolveIcon(name: string): LucideIcon | undefined {
  return (icons as Record<string, LucideIcon>)[name];
}

interface MegaMenuItemProps {
  module: NavigationModule;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  activePath: string;
}

export function MegaMenuItem({
  module,
  isExpanded,
  isActive,
  onToggle,
  activePath,
}: MegaMenuItemProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const close = useMegaMenuStore((s) => s.close);
  const { isPinned, togglePin } = useFavouritePages();
  const ModuleIcon = resolveIcon(module.icon);

  const handleSubItemClick = (item: NavigationItem) => {
    navigate({ to: item.path });
    close();
  };

  const handlePinClick = (e: React.MouseEvent, item: NavigationItem) => {
    e.stopPropagation();
    togglePin(item.path, t(item.labelKey), item.icon);
  };

  return (
    <div className="mb-0.5">
      <button
        className={cn(
          'flex w-full items-center gap-3 rounded-[10px] px-3.5 py-2.5 transition-all',
          isExpanded
            ? 'bg-nexa-100 text-nexa-800'
            : 'text-gray-900 hover:bg-nexa-50',
        )}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {ModuleIcon && (
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              isExpanded ? 'bg-nexa-200' : 'bg-gray-100',
            )}
          >
            <ModuleIcon className="size-4" />
          </div>
        )}
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold">{t(module.labelKey)}</div>
        </div>
        <ChevronRight
          className={cn(
            'size-4 text-gray-400 transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {module.items.map((item) => {
            const ItemIcon = resolveIcon(item.icon);
            const isItemActive = activePath === item.path || activePath.startsWith(item.path + '/');
            const pinned = isPinned(item.path);
            const category = item.category ?? 'page';

            return (
              <button
                key={item.key}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg py-1.5 pl-11 pr-3 transition-all',
                  isItemActive
                    ? 'font-medium text-nexa-600'
                    : category === 'page'
                      ? 'text-gray-600 hover:bg-nexa-50 hover:text-nexa-600'
                      : 'text-gray-400 hover:bg-nexa-50 hover:text-nexa-600',
                  category !== 'page' && 'text-[11px]',
                )}
                onClick={() => handleSubItemClick(item)}
              >
                {ItemIcon && (
                  <ItemIcon
                    className={cn(
                      'size-3.5',
                      category !== 'page' && 'size-3',
                    )}
                  />
                )}
                <span className="flex-1 text-left text-[13px]">
                  {t(item.labelKey)}
                </span>
                {isItemActive && (
                  <span className="size-1.5 rounded-full bg-nexa-600" />
                )}
                <Star
                  className={cn(
                    'size-3 transition-opacity',
                    pinned
                      ? 'fill-amber-400 text-amber-400 opacity-100'
                      : 'text-gray-300 opacity-0 group-hover:opacity-100',
                  )}
                  onClick={(e) => handlePinClick(e, item)}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/mega-menu-item.tsx
git commit -m "feat: add MegaMenuItem accordion component"
```

---

### Task 10: Build the MegaMenu panel component

**Files:**
- Create: `apps/web/src/components/layout/mega-menu.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { X, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMegaMenuStore } from '@/stores/mega-menu-store';
import { useAuthStore } from '@/stores/auth-store';
import { NAVIGATION_MODULES, getFilteredModules } from '@/lib/navigation-config';
import { MegaMenuItem } from './mega-menu-item';

import { useI18n } from '@nexa/i18n';

export function MegaMenu() {
  const { t } = useI18n();
  const {
    isOpen,
    close,
    expandedModule,
    setExpandedModule,
    filterQuery,
    setFilterQuery,
  } = useMegaMenuStore();

  const permissions = useAuthStore((s) => s.permissions);
  const enabledModules = permissions?.enabledModules ?? [];
  const isSuperAdmin = permissions?.role === 'SUPER_ADMIN';

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const modulePermissions = permissions?.modules;

  // Get filtered modules based on user permissions (pass modulePermissions for resource-level filtering)
  const modules = getFilteredModules(enabledModules, isSuperAdmin, modulePermissions)
    .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));

  // Filter by search query
  const filteredModules = filterQuery
    ? modules.filter(
        (m) =>
          t(m.labelKey).toLowerCase().includes(filterQuery.toLowerCase()) ||
          m.items.some((item) =>
            t(item.labelKey).toLowerCase().includes(filterQuery.toLowerCase()),
          ),
      )
    : modules;

  // Focus filter input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => filterRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusableEls = panel.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t('navigation:megaMenu')}
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[380px] bg-white shadow-xl transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'max-sm:w-[300px]',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Panel header */}
        <div className="flex h-14 items-center gap-3 border-b border-gray-200 px-4">
          <button
            onClick={close}
            className="rounded-lg p-1.5 hover:bg-gray-100"
            aria-label={t('common:close')}
          >
            <X className="size-5 text-gray-500" />
          </button>
          <span className="font-heading font-bold text-gray-900">
            {t('navigation:allModules')}
          </span>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              ref={filterRef}
              type="text"
              placeholder={t('navigation:filterModules')}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-40 rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs focus:border-nexa-400 focus:outline-none"
              aria-label={t('navigation:filterModules')}
            />
          </div>
        </div>

        {/* Module list */}
        <div className="h-[calc(100%-56px)] overflow-y-auto p-3">
          {filteredModules.map((module, index) => {
            // Insert dividers at specific boundaries.
            // Use displayOrder groups: 1-7 = Operations, 8-11 = Other, 12-14 = AI/System
            // Divider shows when the "group" changes (defined by explicit thresholds)
            const DIVIDER_AFTER = [7, 11]; // After Inventory/WMS (7), after Manufacturing (11)
            const prevOrder = filteredModules[index - 1]?.displayOrder ?? 0;
            const showDivider =
              index > 0 &&
              DIVIDER_AFTER.some(
                (threshold) =>
                  (prevOrder ?? 0) <= threshold &&
                  (module.displayOrder ?? 99) > threshold,
              );

            return (
              <div key={module.key}>
                {showDivider && (
                  <div className="my-2 border-t border-gray-100" />
                )}
                <MegaMenuItem
                  module={module}
                  isExpanded={expandedModule === module.key}
                  isActive={pathname.startsWith('/' + module.key)}
                  onToggle={() =>
                    setExpandedModule(
                      expandedModule === module.key ? null : module.key,
                    )
                  }
                  activePath={pathname}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/mega-menu.tsx
git commit -m "feat: add MegaMenu slide-out panel with filter and accordion"
```

---

## Chunk 4: Favourites Toolbar + Module Context Bar

### Task 11: Build the FavouritesToolbar component

**Files:**
- Create: `apps/web/src/components/layout/favourites-toolbar.tsx`

- [ ] **Step 1: Write the component**

Uses `ResizeObserver` to measure available width and calculate how many chips to show before collapsing into "+N more".

```typescript
import { useEffect, useRef, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFavouritePages } from '@/hooks/use-favourite-pages';
import { useMegaMenuStore } from '@/stores/mega-menu-store';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useI18n } from '@nexa/i18n';

function resolveIcon(name: string): LucideIcon | undefined {
  return (icons as Record<string, LucideIcon>)[name];
}

export function FavouritesToolbar() {
  const { t } = useI18n();
  const { pages, isLoading } = useFavouritePages();
  const openMegaMenu = useMegaMenuStore((s) => s.open);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(pages.length);

  // ResizeObserver to calculate visible chip count
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pages.length === 0) return;

    const observer = new ResizeObserver(() => {
      // Approximate: label (60px) + divider (20px) + add button (60px) = 140px reserved
      const available = container.clientWidth - 140;
      // Average chip width ~110px (icon + label + padding)
      const avgChipWidth = 110;
      const maxVisible = Math.max(1, Math.floor(available / avgChipWidth));
      setVisibleCount(Math.min(maxVisible, pages.length));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [pages.length]);

  const visiblePages = pages.slice(0, visibleCount);
  const overflowPages = pages.slice(visibleCount);

  if (isLoading) {
    return (
      <div className="flex h-10 items-center border-b border-gray-200 bg-white px-4">
        <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-10 items-center gap-0.5 border-b border-gray-200 bg-white px-4"
    >
      <span className="mr-2 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {t('navigation:favourites')}
      </span>
      <div className="mx-1.5 h-5 w-px shrink-0 bg-gray-200" />

      {/* Visible chips */}
      {visiblePages.map((page) => {
        const Icon = resolveIcon(page.iconKey);
        const isActive = pathname === page.path || pathname.startsWith(page.path + '/');
        return (
          <Link
            key={page.id}
            to={page.path}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all',
              isActive
                ? 'bg-nexa-100 text-nexa-600'
                : 'text-gray-600 hover:bg-nexa-50 hover:text-nexa-600',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {page.label}
          </Link>
        );
      })}

      {/* Overflow dropdown */}
      {overflowPages.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-nexa-50 hover:text-nexa-600">
              +{overflowPages.length} more
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {overflowPages.map((page) => {
              const Icon = resolveIcon(page.iconKey);
              return (
                <Link
                  key={page.id}
                  to={page.path}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-gray-600 hover:bg-nexa-50 hover:text-nexa-600"
                >
                  {Icon && <Icon className="size-3.5" />}
                  {page.label}
                </Link>
              );
            })}
          </PopoverContent>
        </Popover>
      )}

      {/* Empty state or Add button */}
      {pages.length === 0 ? (
        <button
          onClick={openMegaMenu}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-nexa-600"
        >
          {t('navigation:pinPagesHint')}
        </button>
      ) : (
        <button
          onClick={openMegaMenu}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-400 hover:border-nexa-300 hover:text-nexa-600"
        >
          <Plus className="size-3" />
          {t('common:add')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/favourites-toolbar.tsx
git commit -m "feat: add FavouritesToolbar with ResizeObserver overflow"
```

---

### Task 12: Build the ModuleContextBar component

**Files:**
- Create: `apps/web/src/components/layout/module-context-bar.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useActiveModule } from '@/hooks/use-active-module';
import { useAuthStore } from '@/stores/auth-store';
import {
  NAVIGATION_MODULES,
  getFilteredModules,
  getModuleItemsByCategory,
} from '@/lib/navigation-config';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useI18n } from '@nexa/i18n';

function resolveIcon(name: string): LucideIcon | undefined {
  return (icons as Record<string, LucideIcon>)[name];
}

type Category = 'page' | 'setting' | 'report';

export function ModuleContextBar() {
  const { t } = useI18n();
  const activeModuleKey = useActiveModule();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const permissions = useAuthStore((s) => s.permissions);
  const [activeCategory, setActiveCategory] = useState<Category>('page');

  if (!activeModuleKey) return null;

  const enabledModules = permissions?.enabledModules ?? [];
  const isSuperAdmin = permissions?.role === 'SUPER_ADMIN';
  const modules = getFilteredModules(enabledModules, isSuperAdmin);
  const currentModule = modules.find((m) => m.key === activeModuleKey);

  if (!currentModule) return null;

  const ModuleIcon = resolveIcon(currentModule.icon);

  const categories: { key: Category; labelKey: string }[] = [
    { key: 'page', labelKey: 'navigation:contextBar.pages' },
    { key: 'setting', labelKey: 'navigation:contextBar.settings' },
    { key: 'report', labelKey: 'navigation:contextBar.reports' },
  ];

  // Only show pills that have items
  const visibleCategories = categories.filter(
    (cat) => getModuleItemsByCategory(currentModule, cat.key).length > 0,
  );

  return (
    <div className="flex h-8 items-center gap-1 border-b border-nexa-100 bg-[#faf9ff] px-4">
      {ModuleIcon && <ModuleIcon className="mr-1 size-4 text-nexa-600" />}
      <span className="mr-3 font-heading text-xs font-bold text-nexa-800">
        {t(currentModule.labelKey)}
      </span>
      <div className="mx-1 h-4 w-px bg-nexa-200" />

      {visibleCategories.map((cat) => {
        const items = getModuleItemsByCategory(currentModule, cat.key);
        return (
          <Popover key={cat.key}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] transition-all',
                  activeCategory === cat.key
                    ? 'bg-nexa-600 text-white'
                    : 'text-gray-500 hover:bg-nexa-100 hover:text-nexa-600',
                )}
                onClick={() => setActiveCategory(cat.key)}
              >
                {t(cat.labelKey)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              {items.map((item) => {
                const ItemIcon = resolveIcon(item.icon);
                const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-all',
                      isActive
                        ? 'font-medium text-nexa-600'
                        : 'text-gray-600 hover:bg-nexa-50 hover:text-nexa-600',
                    )}
                  >
                    {ItemIcon && <ItemIcon className="size-3.5" />}
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/module-context-bar.tsx
git commit -m "feat: add ModuleContextBar with auto-detected module pills"
```

---

## Chunk 5: Layout Integration + Header Changes

### Task 13: Update AppHeader — hamburger visible at all breakpoints

**Files:**
- Modify: `apps/web/src/components/layout/app-header.tsx`

- [ ] **Step 1: Read the current app-header.tsx**

Read the file to find the hamburger button (should be around line 39-48, with `lg:hidden` class).

- [ ] **Step 2: Make hamburger always visible and wire to mega-menu store**

Changes:
1. Import `useMegaMenuStore` instead of `useSidebarStore`
2. Remove `lg:hidden` from the hamburger button
3. Change `onClick` from `toggleSidebar` to `megaMenuStore.toggle()`
4. Keep the rest of the header unchanged

- [ ] **Step 3: Add a pin star to the header for current page**

Add a star icon button next to the page title/breadcrumbs area that toggles pinning the current page to the favourites toolbar.

Import `useFavouritePages` and wire the star button to `togglePin()`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/app-header.tsx
git commit -m "feat: hamburger visible at all breakpoints, add page pin star"
```

---

### Task 14: Update AppLayout — remove sidebar, add new navigation layers

**Files:**
- Modify: `apps/web/src/components/layout/app-layout.tsx`

- [ ] **Step 1: Read the current app-layout.tsx**

Read the full file to understand the current structure (sidebar wrapper, mobile drawer, content area, bottom tabs).

- [ ] **Step 2: Replace sidebar with mega-menu + toolbar + context bar**

Key changes:
1. Remove the sidebar `<aside>` block (desktop inline, tablet hover-expand, mobile Sheet drawer)
2. Remove imports of `AppSidebar`, `useSidebarStore`, `Sheet` (sidebar-related)
3. Add imports: `MegaMenu`, `FavouritesToolbar`, `ModuleContextBar`
4. After `<AppHeader>`, add:
   ```tsx
   <FavouritesToolbar />
   <ModuleContextBar />
   ```
5. Add `<MegaMenu />` at the top level (it's a fixed-position overlay, position doesn't matter in DOM)
6. Remove the left-margin/padding that was compensating for the sidebar width
7. Content area becomes full-width

- [ ] **Step 3: Update mobile bottom tabs section**

The bottom tabs section should check the user's `mobileNavStyle` preference and render the appropriate mobile navigation. For now, keep the existing `BottomTabBar` for the Classic Tabs mode. The other two modes will be handled in Task 15.

- [ ] **Step 4: Verify the app renders correctly**

Run: `cd apps/web && pnpm dev`
Open `http://localhost:5110` and verify:
- No sidebar visible
- Hamburger in header opens mega-menu
- Favourites toolbar visible below header
- Module context bar appears when navigating to a module page
- Content area is full-width

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/app-layout.tsx
git commit -m "feat: replace sidebar with mega-menu, favourites toolbar, and context bar"
```

---

### Task 15: Update BottomTabBar — support 3 mobile nav modes

**Files:**
- Modify: `apps/web/src/components/layout/bottom-tab-bar.tsx`

- [ ] **Step 1: Read the current bottom-tab-bar.tsx**

Read the file to understand the current 5-tab structure.

- [ ] **Step 2: Add mode prop and conditional rendering**

The component should accept a `mode` prop (or read from user store) and render differently:

- `CLASSIC_TABS`: Keep existing 5-tab layout (Home, Modules, AI, Notifications, Profile). "Modules" tab now triggers `megaMenuStore.open()` instead of toggling the sidebar Sheet.
- `MINIMAL`: Don't render the component at all (return null). The mobile favourites bar is rendered separately by AppLayout.
- `MY_SHORTCUTS`: Render user's pinned favourite pages (first 4) as tab items + "More" button. Use `useFavouritePages()` to get the pinned pages. Resolve icons from the `iconKey` field.

- [ ] **Step 3: Wire up the user's mobileNavStyle preference**

Read `mobileNavStyle` from the auth store (it comes from the user profile API). Pass it to BottomTabBar or have it read from the store directly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/bottom-tab-bar.tsx
git commit -m "feat: support 3 mobile nav modes in BottomTabBar"
```

---

### Task 16: Update useBreakpoint — remove sidebar auto-sync

**Files:**
- Modify: `apps/web/src/hooks/use-breakpoint.ts`

- [ ] **Step 1: Remove the sidebar store side effect**

In `useBreakpoint()`, remove the lines that call `useSidebarStore.setMode()` on breakpoint change. The hook should only return the breakpoint value without side effects.

Keep `usePrefersReducedMotion()` unchanged.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-breakpoint.ts
git commit -m "refactor: remove sidebar auto-sync from useBreakpoint hook"
```

---

## Chunk 6: i18n Keys + Testing + Cleanup

### Task 17: Add i18n translation keys

**Files:**
- Modify: The i18n translation files (find via `grep -r "navigation:" apps/web/` or check `packages/i18n/`)

- [ ] **Step 1: Find the i18n files**

Look for the English translation file that contains `navigation:` keys.

- [ ] **Step 2: Add new keys**

```json
{
  "navigation:megaMenu": "Navigation menu",
  "navigation:allModules": "All Modules",
  "navigation:filterModules": "Filter...",
  "navigation:favourites": "Favourites",
  "navigation:pinPagesHint": "Pin your most-used pages here",
  "navigation:contextBar.pages": "Pages",
  "navigation:contextBar.settings": "Settings",
  "navigation:contextBar.reports": "Reports",
  "navigation:mobileNavStyle": "Mobile Navigation Style",
  "navigation:mobileNavStyle.classicTabs": "Classic Tabs",
  "navigation:mobileNavStyle.minimal": "Minimal",
  "navigation:mobileNavStyle.myShortcuts": "My Shortcuts"
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/
git commit -m "feat: add i18n keys for mega-menu, favourites toolbar, and context bar"
```

---

### Task 18: Update existing tests

**Files:**
- Modify: `apps/web/src/components/layout/app-layout.test.tsx`
- Modify: `apps/web/src/components/layout/app-header.test.tsx`

- [ ] **Step 1: Update app-layout.test.tsx**

Remove/update tests that assert sidebar rendering. Add tests for:
- MegaMenu renders but is hidden by default
- FavouritesToolbar renders
- ModuleContextBar renders when on a module route
- ModuleContextBar does NOT render on Dashboard

- [ ] **Step 2: Update app-header.test.tsx**

Update tests to verify:
- Hamburger button is always visible (remove any `lg:hidden` assertions)
- Hamburger click opens mega-menu (not sidebar)

- [ ] **Step 3: Run all tests**

Run: `cd apps/web && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/*.test.tsx
git commit -m "test: update layout and header tests for new navigation"
```

---

### Task 19: Update BMAD documents

**Files:**
- Modify: `_bmad-output/planning-artifacts/ux-design-specification/` (navigation section)
- Modify: `_bmad-output/planning-artifacts/data-models/` (User model section)
- Modify: `_bmad-output/planning-artifacts/prd/` (navigation FRs)

- [ ] **Step 1: Update UX Design Specification**

Replace sidebar navigation documentation with mega-menu + favourites toolbar + module context bar. Reference the design spec at `docs/superpowers/specs/2026-03-13-navigation-redesign-design.md`.

- [ ] **Step 2: Update Data Models**

Add `UserFavouritePage` model and `mobileNavStyle` field on User.

- [ ] **Step 3: Update PRD**

Update any functional requirements referencing sidebar navigation.

- [ ] **Step 4: Commit**

```bash
git add _bmad-output/planning-artifacts/
git commit -m "docs: update BMAD specs for navigation redesign"
```

---

### Task 20: Default Favourites Seeding for New Users

**Files:**
- Create: `apps/api/src/modules/system/favourite-pages-seeder.ts`
- Modify: `apps/api/src/modules/system/favourite-pages.service.ts`

- [ ] **Step 1: Write the seeder module**

```typescript
// apps/api/src/modules/system/favourite-pages-seeder.ts
import type { PrismaClient } from '@nexa/db';
import { NAVIGATION_MODULES } from '../../../../web/src/lib/navigation-config';

interface DefaultFavourite {
  path: string;
  label: string;
  iconKey: string;
}

/** Default pages pinned for new users — filtered by enabledModules */
const DEFAULT_FAVOURITES: DefaultFavourite[] = [
  { path: '/', label: 'Dashboard', iconKey: 'LayoutDashboard' },
  { path: '/ar/invoices', label: 'Invoices', iconKey: 'FileText' },
  { path: '/sales/orders', label: 'Sales Orders', iconKey: 'ShoppingCart' },
];

/**
 * Returns which module a path belongs to, based on NAVIGATION_MODULES pathPrefix.
 * Dashboard ('/') is always allowed.
 */
function getModuleForPath(path: string): string | null {
  if (path === '/') return null; // Dashboard — always allowed
  for (const mod of NAVIGATION_MODULES) {
    if (mod.pathPrefix && path.startsWith(mod.pathPrefix)) {
      return mod.key;
    }
  }
  return null;
}

/**
 * Seed default favourite pages for a user, filtered by their enabledModules.
 * Call this when a user is first created or first logs in.
 */
export async function seedDefaultFavourites(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
  enabledModules: string[],
): Promise<void> {
  // Check if user already has favourites (avoid re-seeding)
  const existing = await prisma.userFavouritePage.count({
    where: { userId, companyId },
  });
  if (existing > 0) return;

  // Filter defaults by user's enabled modules
  const filtered = DEFAULT_FAVOURITES.filter((fav) => {
    const moduleKey = getModuleForPath(fav.path);
    if (moduleKey === null) return true; // Dashboard always included
    return enabledModules.includes(moduleKey);
  });

  // Create in batch
  await prisma.userFavouritePage.createMany({
    data: filtered.map((fav, index) => ({
      userId,
      companyId,
      path: fav.path,
      label: fav.label,
      iconKey: fav.iconKey,
      displayOrder: index,
    })),
  });
}
```

- [ ] **Step 2: Integrate seeder into the list endpoint**

In `favourite-pages.service.ts`, add a call to `seedDefaultFavourites` at the start of `listFavouritePages()` — it's a no-op if the user already has favourites:

```typescript
import { seedDefaultFavourites } from './favourite-pages-seeder';

// At the start of listFavouritePages():
export async function listFavouritePages(prisma: PrismaClient, userId: string, companyId: string, enabledModules: string[]) {
  // Seed defaults on first access
  await seedDefaultFavourites(prisma, userId, companyId, enabledModules);

  return prisma.userFavouritePage.findMany({
    where: { userId, companyId },
    orderBy: { displayOrder: 'asc' },
  });
}
```

- [ ] **Step 3: Verify seeding works**

Run: `curl -s http://localhost:5100/system/favourite-pages -H "Authorization: Bearer $TOKEN" | jq`

Expected: New user gets Dashboard + permitted defaults; existing user keeps their current favourites.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/system/favourite-pages-seeder.ts apps/api/src/modules/system/favourite-pages.service.ts
git commit -m "feat: seed default favourite pages for new users"
```

---

### Task 21: Mobile Navigation Style Settings UI

**Files:**
- Create: `apps/web/src/features/settings/components/mobile-nav-settings.tsx`
- Modify: User settings/profile page (find via `grep -r "Display Preferences\|user-settings\|profile" apps/web/src/`)

- [ ] **Step 1: Write the mobile nav settings component**

```tsx
// apps/web/src/features/settings/components/mobile-nav-settings.tsx
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const MOBILE_NAV_OPTIONS = [
  {
    value: 'CLASSIC_TABS' as const,
    labelKey: 'settings.mobileNav.classicTabs',
    descriptionKey: 'settings.mobileNav.classicTabsDesc',
  },
  {
    value: 'MINIMAL' as const,
    labelKey: 'settings.mobileNav.minimal',
    descriptionKey: 'settings.mobileNav.minimalDesc',
  },
  {
    value: 'MY_SHORTCUTS' as const,
    labelKey: 'settings.mobileNav.myShortcuts',
    descriptionKey: 'settings.mobileNav.myShortcutsDesc',
  },
] as const;

export function MobileNavSettings() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const currentStyle = user?.mobileNavStyle ?? 'CLASSIC_TABS';

  async function handleChange(value: 'CLASSIC_TABS' | 'MINIMAL' | 'MY_SHORTCUTS') {
    if (value === currentStyle) return;

    const response = await apiClient.patch('/system/users/me', {
      mobileNavStyle: value,
    });

    if (response.success && user) {
      setUser({ ...user, mobileNavStyle: value });
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        {t('settings.mobileNav.title', 'Mobile Navigation Style')}
      </h3>
      <p className="text-xs text-gray-500">
        {t('settings.mobileNav.description', 'Choose how navigation appears on mobile devices.')}
      </p>
      <div className="space-y-2">
        {MOBILE_NAV_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleChange(option.value)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              currentStyle === option.value
                ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-200'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            <div className="text-sm font-medium text-gray-900">
              {t(option.labelKey)}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {t(option.descriptionKey)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to user settings/profile page**

Find the user settings or display preferences page and add `<MobileNavSettings />` in the appropriate section.

- [ ] **Step 3: Verify the settings UI renders and persists**

Open the app on mobile viewport, navigate to user settings, change the mobile nav style. Verify the selection persists after page refresh.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/settings/components/mobile-nav-settings.tsx
git commit -m "feat: add mobile navigation style user preference UI"
```

---

### Task 22: Feature Flag for Navigation Rollout

**Files:**
- Modify: `apps/web/src/components/layout/app-layout.tsx`

- [ ] **Step 1: Add feature flag check**

The env var `NEXT_PUBLIC_USE_NEW_NAVIGATION` (default `true`) controls which navigation renders. In `app-layout.tsx`, the conditional has already been set up in Task 14. Verify the flag is respected:

```typescript
// In app-layout.tsx (should already exist from Task 14)
const useNewNavigation = import.meta.env.VITE_USE_NEW_NAVIGATION !== 'false';
```

Note: Vite uses `VITE_` prefix (not `NEXT_PUBLIC_` — that's Next.js). The spec said `NEXT_PUBLIC_USE_NEW_NAVIGATION` but our app uses Vite, so the env var is `VITE_USE_NEW_NAVIGATION`.

- [ ] **Step 2: Add the env var to `.env.example`**

```env
# Navigation redesign (set to 'false' to revert to sidebar)
VITE_USE_NEW_NAVIGATION=true
```

- [ ] **Step 3: Verify flag works**

Set `VITE_USE_NEW_NAVIGATION=false` in `.env`, restart dev server. Verify sidebar appears. Set back to `true`, restart, verify mega-menu appears.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/app-layout.tsx .env.example
git commit -m "feat: add VITE_USE_NEW_NAVIGATION feature flag for navigation rollout"
```

---

### Task 23: Final integration verification

- [ ] **Step 1: Start all dev servers**

Run: `pnpm dev`

- [ ] **Step 2: Manual verification checklist**

Open the app and verify each item:

- [ ] Hamburger visible on desktop — click opens 380px mega-menu from left
- [ ] Mega-menu shows all modules filtered by permissions
- [ ] Clicking a module expands sub-items (accordion, one at a time)
- [ ] Filter input filters modules and sub-items
- [ ] Clicking a sub-item navigates and closes mega-menu
- [ ] Escape key closes mega-menu
- [ ] Focus is trapped within mega-menu when open
- [ ] Star icons in mega-menu toggle pin/unpin
- [ ] Favourites toolbar shows pinned pages below header
- [ ] Clicking a favourite chip navigates to that page
- [ ] Active chip highlighted in purple
- [ ] Overflow chips collapse into "+N more" dropdown
- [ ] "+ Add" button opens mega-menu
- [ ] Module context bar appears when on a module page (e.g., /sales/*)
- [ ] Module context bar hidden on Dashboard
- [ ] Pills (Pages/Settings/Reports) open dropdowns with categorised items
- [ ] No sidebar visible anywhere
- [ ] Content area is full-width
- [ ] New user gets default favourites (Dashboard + permission-filtered defaults)
- [ ] Mobile: bottom tabs render (Classic Tabs mode by default)
- [ ] Mobile: hamburger opens mega-menu adapted to 300px width
- [ ] Mobile nav style setting in user preferences changes mobile navigation
- [ ] Feature flag `VITE_USE_NEW_NAVIGATION=false` reverts to sidebar

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final integration fixes for navigation redesign"
```
