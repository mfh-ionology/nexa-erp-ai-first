import { z } from 'zod';

// ---------------------------------------------------------------------------
// Params Schemas
// ---------------------------------------------------------------------------

export const userAccessGroupParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

// NOTE: No .min(1) here — empty array validation is handled at the route
// layer via DomainError to return 422 (AC #3), not Zod's default 400.
export const assignAccessGroupsSchema = z.object({
  accessGroupIds: z.array(z.uuid()).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: 'Duplicate access group IDs are not allowed' },
  ),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

// NOTE: Uses z.iso.datetime() (Zod v4) instead of z.date() for assignedAt
// to avoid serialization issues identified in E2b-2 code review (Issue #10).
export const userAccessGroupItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  assignedBy: z.uuid(),
  assignedAt: z.iso.datetime(),
});

export const userAccessGroupsResponseSchema = z.object({
  userId: z.uuid(),
  companyId: z.uuid(),
  accessGroups: z.array(userAccessGroupItemSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type AssignAccessGroupsInput = z.infer<typeof assignAccessGroupsSchema>;
export type UserAccessGroupItem = z.infer<typeof userAccessGroupItemSchema>;
export type UserAccessGroupsResponse = z.infer<typeof userAccessGroupsResponseSchema>;
