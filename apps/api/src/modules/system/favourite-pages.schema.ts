// ---------------------------------------------------------------------------
// Favourite Pages Schemas — Nav Redesign Task 3
// Zod schemas for request/response validation on favourite page routes.
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

export const favouritePageResponseSchema = z.object({
  id: z.string(),
  path: z.string(),
  label: z.string(),
  iconKey: z.string(),
  displayOrder: z.number(),
});

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const createFavouritePageBodySchema = z.object({
  path: z
    .string()
    .min(1)
    .max(255)
    .regex(/^\/[a-zA-Z0-9\-\/]*$/),
  label: z.string().min(1).max(100),
  iconKey: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9]+$/),
});

export const deleteFavouritePageParamsSchema = z.object({
  id: z.string().uuid(),
});

export const unpinByPathBodySchema = z.object({
  path: z
    .string()
    .min(1)
    .max(255)
    .regex(/^\/[a-zA-Z0-9\-\/]*$/),
});

export const reorderFavouritePagesBodySchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type CreateFavouritePageBody = z.infer<typeof createFavouritePageBodySchema>;
export type DeleteFavouritePageParams = z.infer<typeof deleteFavouritePageParamsSchema>;
export type UnpinByPathBody = z.infer<typeof unpinByPathBodySchema>;
export type ReorderFavouritePagesBody = z.infer<typeof reorderFavouritePagesBodySchema>;
