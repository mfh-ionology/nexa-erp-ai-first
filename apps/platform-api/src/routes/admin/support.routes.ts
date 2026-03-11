// ---------------------------------------------------------------------------
// Support Console Routes — Tenant search for support purposes
// Source: API Contracts §21.8, FR217, AC#5
// Story: E13b.5 Task 3.2
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import { getPlatformPrisma } from '../../client.js';

import {
  supportSearchQuerySchema,
  supportSearchResponseSchema,
  type SupportSearchQuery,
  type SupportSearchResult,
} from './support.schema.js';

const MAX_RESULTS = 50;

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

async function supportRoutesFn(fastify: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /admin/support/search — Search tenants by domain, name, email, ID
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: SupportSearchQuery }>(
    '/admin/support/search',
    {
      schema: {
        querystring: supportSearchQuerySchema,
        response: { 200: successEnvelope(supportSearchResponseSchema) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN', 'PLATFORM_VIEWER')],
      config: {
        audit: {
          action: 'platform.support_search',
          targetType: 'tenant',
        },
      },
    },
    async (request, reply) => {
      const { q, type } = request.query;
      const prisma = getPlatformPrisma();

      const results: SupportSearchResult[] = [];

      // --- Search by type ---

      if (type === 'id') {
        // Exact match on tenant id
        const tenant = await prisma.tenant.findUnique({
          where: { id: q },
          include: { plan: { select: { code: true } } },
        });
        if (tenant) {
          results.push(mapTenantResult(tenant, 'id', tenant.id));
        }
      } else if (type === 'domain') {
        // Exact match on tenant code
        const tenant = await prisma.tenant.findUnique({
          where: { code: q },
          include: { plan: { select: { code: true } } },
        });
        if (tenant) {
          results.push(mapTenantResult(tenant, 'code', tenant.code));
        }
      } else if (type === 'name') {
        // Case-insensitive contains on displayName / legalName
        const tenants = await prisma.tenant.findMany({
          where: {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { legalName: { contains: q, mode: 'insensitive' } },
            ],
          },
          include: { plan: { select: { code: true } } },
          take: MAX_RESULTS,
        });
        for (const t of tenants) {
          const matchedField = t.displayName.toLowerCase().includes(q.toLowerCase())
            ? 'displayName'
            : 'legalName';
          const matchedValue = matchedField === 'displayName' ? t.displayName : (t.legalName ?? '');
          results.push(mapTenantResult(t, matchedField, matchedValue));
        }
      } else if (type === 'email') {
        // Cross-reference: search PlatformUser.email, find related tenants
        // via ImpersonationSession; also search tenant code for email domain
        await searchByEmail(prisma, q, results);
      } else {
        // No type specified — general search across all fields
        await searchGeneral(prisma, q, results);
      }

      return sendSuccess(reply, {
        items: results.slice(0, MAX_RESULTS),
        total: results.length,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

interface TenantWithPlan {
  id: string;
  code: string;
  displayName: string;
  status: string;
  billingStatus: string;
  lastActivityAt: Date | null;
  plan: { code: string };
}

function mapTenantResult(
  tenant: TenantWithPlan,
  matchField: string,
  matchValue: string,
): SupportSearchResult {
  return {
    id: tenant.id,
    code: tenant.code,
    displayName: tenant.displayName,
    status: tenant.status,
    planCode: tenant.plan.code,
    billingStatus: tenant.billingStatus,
    lastActivityAt: tenant.lastActivityAt?.toISOString() ?? null,
    matchField,
    matchValue,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchByEmail(prisma: any, q: string, results: SupportSearchResult[]) {
  // NOTE: PlatformUser has no tenantId — platform users are vendor staff, not
  // tenant users. Tenant users live in each tenant's isolated database. The best
  // we can do from the platform DB is match the email domain/local parts against
  // tenant code/displayName/legalName. Full tenant-user email search would
  // require cross-database queries (future enhancement).

  const existingIds = new Set(results.map((r: SupportSearchResult) => r.id));
  const planInclude = { plan: { select: { code: true } } };

  // Strategy 1: Extract domain from email and match against tenant code/displayName
  if (q.includes('@')) {
    const domain = q.split('@')[1]!.split('.')[0]!;
    if (domain.length >= 2) {
      const tenants = await prisma.tenant.findMany({
        where: {
          OR: [
            { code: { contains: domain, mode: 'insensitive' } },
            { displayName: { contains: domain, mode: 'insensitive' } },
            { legalName: { contains: domain, mode: 'insensitive' } },
          ],
        },
        include: planInclude,
        take: MAX_RESULTS,
      });
      for (const t of tenants) {
        if (!existingIds.has(t.id)) {
          existingIds.add(t.id);
          const matchField = t.code.toLowerCase().includes(domain.toLowerCase())
            ? 'code'
            : 'displayName';
          const matchValue = matchField === 'code' ? t.code : t.displayName;
          results.push(mapTenantResult(t, matchField, matchValue));
        }
      }
    }
  }

  // Strategy 2: Search local part of email against tenant code/displayName
  const localPart = q.includes('@') ? q.split('@')[0]! : q;
  if (localPart.length >= 2) {
    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { code: { contains: localPart, mode: 'insensitive' } },
          { displayName: { contains: localPart, mode: 'insensitive' } },
        ],
      },
      include: planInclude,
      take: MAX_RESULTS,
    });
    for (const t of tenants) {
      if (!existingIds.has(t.id)) {
        existingIds.add(t.id);
        const matchField = t.code.toLowerCase().includes(localPart.toLowerCase())
          ? 'code'
          : 'displayName';
        const matchValue = matchField === 'code' ? t.code : t.displayName;
        results.push(mapTenantResult(t, matchField, matchValue));
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchGeneral(prisma: any, q: string, results: SupportSearchResult[]) {
  // E13b.5 Fix: Run independent queries in parallel for better performance.
  const planInclude = { plan: { select: { code: true } } };

  const [byId, byCode, byName] = await Promise.all([
    // Exact match on id
    prisma.tenant.findUnique({ where: { id: q }, include: planInclude }),
    // Exact match on code
    prisma.tenant.findUnique({ where: { code: q }, include: planInclude }),
    // Case-insensitive contains on displayName / legalName
    prisma.tenant.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { legalName: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: planInclude,
      take: MAX_RESULTS,
    }),
  ]);

  if (byId) {
    results.push(mapTenantResult(byId, 'id', byId.id));
  }

  if (byCode && byCode.id !== byId?.id) {
    results.push(mapTenantResult(byCode, 'code', byCode.code));
  }

  const existingIds = new Set(results.map((r) => r.id));
  for (const t of byName) {
    if (!existingIds.has(t.id)) {
      existingIds.add(t.id);
      const matchedField = t.displayName.toLowerCase().includes(q.toLowerCase())
        ? 'displayName'
        : 'legalName';
      const matchedValue = matchedField === 'displayName' ? t.displayName : (t.legalName ?? '');
      results.push(mapTenantResult(t, matchedField, matchedValue));
    }
  }

  // If query looks like an email, also do email search
  if (q.includes('@')) {
    await searchByEmail(prisma, q, results);
  }
}

export const supportRoutesPlugin = fp(supportRoutesFn, {
  name: 'support-routes',
});
