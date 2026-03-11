import { z } from 'zod';

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const tenantIdParamsSchema = z.object({
  tenantId: z.uuid(),
});

export const articleIdParamsSchema = z.object({
  tenantId: z.uuid(),
  articleId: z.uuid(),
});

// ---------------------------------------------------------------------------
// GET /platform/tenants/:tenantId/knowledge/suggested
// ---------------------------------------------------------------------------

export const suggestedKnowledgeQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// POST /platform/tenants/:tenantId/knowledge/:articleId/respond
// ---------------------------------------------------------------------------

export const knowledgeRespondBodySchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
  tenantArticleId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const previousResponseSchema = z.object({
  status: z.string(),
  articleVersion: z.number(),
});

export const suggestedArticleResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  version: z.number(),
  publishedAt: z.string(),
  previousResponse: previousResponseSchema.nullable(),
});

/** Array of suggested articles — pagination comes from the envelope meta. */
export const suggestedArticleArraySchema = z.array(suggestedArticleResponseSchema);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type TenantIdParams = z.infer<typeof tenantIdParamsSchema>;
export type ArticleIdParams = z.infer<typeof articleIdParamsSchema>;
export type SuggestedKnowledgeQuery = z.infer<typeof suggestedKnowledgeQuerySchema>;
export type KnowledgeRespondBody = z.infer<typeof knowledgeRespondBodySchema>;
export type SuggestedArticleResponse = z.infer<typeof suggestedArticleResponseSchema>;
