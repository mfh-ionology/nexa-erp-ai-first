import type { FastifyInstance } from 'fastify';
import { prisma, resolveUserRole } from '@nexa/db';
import { updateCompanyAiSettings } from './company-profile.service.js';

import {
  companySwitchParamsSchema,
  companySwitchResponseSchema,
  companyListResponseSchema,
} from './company.schema.js';
import type { CompanySwitchParams, CompanySwitchResponse, CompanyItem } from './company.schema.js';
import { tServer } from '@nexa/i18n/server';
import { AuthError } from '../../core/errors/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { createPermissionGuard } from '../../core/rbac/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a company name to a URL-friendly slug (kebab-case). */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// System company routes plugin
// ---------------------------------------------------------------------------

async function companyRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /system/companies — List companies accessible to the current user
  // -------------------------------------------------------------------------
  fastify.get(
    '/companies',
    {
      schema: {
        response: { 200: successEnvelope(companyListResponseSchema) },
      },
      preHandler: createPermissionGuard('system.companies.list', 'view'),
    },
    async (request, reply) => {
      // Find all company roles for the current user
      const userRoles = await prisma.userCompanyRole.findMany({
        where: { userId: request.userId },
        select: { companyId: true },
      });

      // A null companyId means a global role — user has access to all companies
      const hasGlobalRole = userRoles.some((r) => r.companyId === null);

      let companies;
      if (hasGlobalRole) {
        companies = await prisma.companyProfile.findMany({
          where: { isActive: true },
          select: { id: true, name: true, baseCurrencyCode: true, isDefault: true },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
      } else {
        const companyIds = userRoles
          .map((r) => r.companyId)
          .filter((id): id is string => id !== null);

        companies = await prisma.companyProfile.findMany({
          where: { id: { in: companyIds }, isActive: true },
          select: { id: true, name: true, baseCurrencyCode: true, isDefault: true },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
      }

      const result: CompanyItem[] = companies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: toSlug(c.name),
        baseCurrencyCode: c.baseCurrencyCode,
        isDefault: c.isDefault,
      }));

      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /system/companies/:id/switch
  // -------------------------------------------------------------------------
  fastify.post<{ Params: CompanySwitchParams }>(
    '/companies/:id/switch',
    {
      schema: {
        params: companySwitchParamsSchema,
        response: { 200: successEnvelope(companySwitchResponseSchema) },
      },
      preHandler: createPermissionGuard('system.companies.detail', 'edit'),
    },
    async (request, reply) => {
      const { id: targetCompanyId } = request.params;

      // Verify target company exists and is active.
      // Security: use uniform 403 for both "not found" and "inactive" to prevent
      // company-ID enumeration via 404-vs-403 distinction.
      const company = await prisma.companyProfile.findUnique({
        where: { id: targetCompanyId },
        select: { name: true, isActive: true },
      });

      if (!company || !company.isActive) {
        throw new AuthError(
          'COMPANY_ACCESS_DENIED',
          tServer('errors:COMPANY_ACCESS_DENIED'),
          403,
          'errors:COMPANY_ACCESS_DENIED',
        );
      }

      // 7.4 — Verify user has access to target company
      const role = await resolveUserRole(prisma, request.userId, targetCompanyId);

      // 7.5 — If no access: return 403
      if (!role) {
        throw new AuthError(
          'COMPANY_ACCESS_DENIED',
          tServer('errors:COMPANY_ACCESS_DENIED'),
          403,
          'errors:COMPANY_ACCESS_DENIED',
        );
      }

      // 7.6 — Update User.companyId in database to the new company ID
      await prisma.user.update({
        where: { id: request.userId },
        data: { companyId: targetCompanyId },
      });

      // TODO: E3 — emit company.switched event

      // 7.7 — Return success response
      const responseData: CompanySwitchResponse = {
        companyId: targetCompanyId,
        companyName: company.name,
        role,
      };

      return sendSuccess(reply, responseData);
    },
  );
  // -------------------------------------------------------------------------
  // PATCH /system/company/ai-settings — update a single AI settings key
  // -------------------------------------------------------------------------
  fastify.patch(
    '/company/ai-settings',
    { preHandler: [createPermissionGuard('system.settings.detail', 'edit')] },
    async (request, reply) => {
      const { key, value } = request.body as { key: string; value: unknown };
      const companyId = request.companyId;
      const result = await updateCompanyAiSettings(prisma, companyId, key, value);
      return sendSuccess(reply, { settings: result.settings });
    },
  );
}

export const companyRoutesPlugin = companyRoutes;
