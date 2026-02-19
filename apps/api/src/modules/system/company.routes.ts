import type { FastifyInstance } from 'fastify';
import { prisma, resolveUserRole, UserRole } from '@nexa/db';

import { companySwitchParamsSchema, companySwitchResponseSchema } from './company.schema.js';
import type { CompanySwitchParams, CompanySwitchResponse } from './company.schema.js';
import { AuthError } from '../../core/errors/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { createRbacGuard } from '../../core/rbac/index.js';

// ---------------------------------------------------------------------------
// System company routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function companyRoutes(fastify: FastifyInstance): Promise<void> {
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
      preHandler: createRbacGuard({ minimumRole: UserRole.VIEWER }),
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
        throw new AuthError('COMPANY_ACCESS_DENIED', 'You do not have access to this company', 403);
      }

      // 7.4 — Verify user has access to target company
      const role = await resolveUserRole(prisma, request.userId, targetCompanyId);

      // 7.5 — If no access: return 403
      if (!role) {
        throw new AuthError('COMPANY_ACCESS_DENIED', 'You do not have access to this company', 403);
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
}

export const companyRoutesPlugin = companyRoutes;
