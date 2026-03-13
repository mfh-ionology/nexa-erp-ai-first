// ---------------------------------------------------------------------------
// Favourite Pages Service — Nav Redesign Task 2
// CRUD operations for user favourite page pins (per-user, per-company).
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';

import { seedDefaultFavourites } from './favourite-pages-seeder.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateFavouritePageInput {
  path: string;
  label: string;
  iconKey: string;
}

export interface ReorderFavouritePagesInput {
  orderedIds: string[];
}

// ---------------------------------------------------------------------------
// listFavouritePages — returns all favourite pages for a user/company
// ---------------------------------------------------------------------------

export async function listFavouritePages(
  db: PrismaClient,
  userId: string,
  companyId: string,
  enabledModules: string[] = [],
) {
  // Seed defaults on first access (no-op if user already has favourites)
  await seedDefaultFavourites(db, userId, companyId, enabledModules);

  return db.userFavouritePage.findMany({
    where: { userId, companyId },
    orderBy: { displayOrder: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// createFavouritePage — add a new favourite page pin
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// deleteFavouritePage — remove a favourite page pin by ID
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// deleteFavouritePageByPath — remove a favourite page pin by path (unpin)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// reorderFavouritePages — reorder favourite page pins
// ---------------------------------------------------------------------------

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
