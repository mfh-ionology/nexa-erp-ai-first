import type { PrismaClient, Resource } from '@nexa/db';
import type { ListResourcesQuery } from './resources.schema.js';

// ---------------------------------------------------------------------------
// listResources
// ---------------------------------------------------------------------------

export async function listResources(
  prisma: PrismaClient,
  filters: ListResourcesQuery,
): Promise<{ data: Resource[]; meta: { total: number; cursor?: string; hasMore: boolean } }> {
  // CRITICAL: Resource table is GLOBAL (no companyId) — do NOT add companyId
  const where: Record<string, unknown> = {};
  const { cursor, limit } = filters;

  if (filters.module !== undefined) {
    where.module = filters.module;
  }

  if (filters.type !== undefined) {
    where.type = filters.type;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    }),
    prisma.resource.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  return { data, meta: { total, cursor: nextCursor, hasMore } };
}
