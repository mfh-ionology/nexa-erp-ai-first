import type { PrismaClient, UserRole } from '../../generated/prisma/client';

/**
 * Resolves the effective role for a user in a specific company context.
 * Resolution order (Project Context §2 RBAC):
 *   1. Company-specific role (UserCompanyRole where companyId = target)
 *   2. Global role (UserCompanyRole where companyId = null)
 *   3. No access (null)
 */
export async function resolveUserRole(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
): Promise<UserRole | null> {
  // 1. Check for company-specific role
  const companyRole = await prisma.userCompanyRole.findUnique({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Prisma compound unique key
      userId_companyId: { userId, companyId },
    },
  });
  if (companyRole) return companyRole.role;

  // 2. Fall back to global role (companyId = null)
  const globalRole = await prisma.userCompanyRole.findFirst({
    where: { userId, companyId: null },
  });
  if (globalRole) return globalRole.role;

  // 3. No access
  return null;
}
