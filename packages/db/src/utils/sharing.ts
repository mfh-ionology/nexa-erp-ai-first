import type { PrismaClient } from '../../generated/prisma/client';

/**
 * Returns the set of companyIds visible to the given company for the given entity type,
 * based on RegisterSharingRule configuration.
 * See: Project Context §1 Multi-Company Architecture
 */
export async function getVisibleCompanyIds(
  prisma: PrismaClient,
  companyId: string,
  entityType: string,
): Promise<string[]> {
  const rules = await prisma.registerSharingRule.findMany({
    where: {
      OR: [
        { sourceCompanyId: companyId, entityType },
        { targetCompanyId: companyId, entityType },
        { sharingMode: 'ALL_COMPANIES', entityType },
      ],
    },
  });

  const ids = new Set([companyId]);
  for (const rule of rules) {
    if (rule.sharingMode === 'ALL_COMPANIES') {
      const allCompanies = await prisma.companyProfile.findMany({
        select: { id: true },
      });
      allCompanies.forEach((c: { id: string }) => ids.add(c.id));
    } else {
      ids.add(rule.sourceCompanyId);
      if (rule.targetCompanyId) ids.add(rule.targetCompanyId);
    }
  }
  return Array.from(ids);
}
