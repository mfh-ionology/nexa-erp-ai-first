import type { PrismaClient } from '@nexa/db';
import { getVisibleCompanyIds } from '@nexa/db';

type SingleCompanyFilter = { companyId: string };
type MultiCompanyFilter = { companyId: { in: string[] } };
export type CompanyFilter = SingleCompanyFilter | MultiCompanyFilter;

/**
 * Builds a Prisma-compatible companyId filter.
 *
 * If entityType is provided, checks RegisterSharingRule configuration via
 * getVisibleCompanyIds(). When sharing rules expose multiple companies,
 * returns { companyId: { in: [...] } }. Otherwise returns { companyId }.
 */
export async function buildCompanyFilter(
  prisma: PrismaClient,
  companyId: string,
  entityType?: string,
): Promise<CompanyFilter> {
  if (!entityType) {
    return { companyId };
  }

  const visibleIds = await getVisibleCompanyIds(prisma, companyId, entityType);

  if (visibleIds.length > 1) {
    return { companyId: { in: visibleIds } };
  }

  return { companyId };
}
