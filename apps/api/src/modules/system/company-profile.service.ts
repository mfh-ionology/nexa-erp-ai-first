import type { PrismaClient } from '@nexa/db';
import { UserRole } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type {
  CreateCompanyProfileRequest,
  UpdateCompanyProfileRequest,
} from './company-profile.schema.js';
import { NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// getCompanyProfile
// ---------------------------------------------------------------------------

export async function getCompanyProfile(prisma: PrismaClient, companyId: string) {
  const profile = await prisma.companyProfile.findUnique({
    where: { id: companyId },
  });

  if (!profile) {
    throw new NotFoundError('NOT_FOUND', 'Company profile not found');
  }

  return profile;
}

// ---------------------------------------------------------------------------
// createCompanyProfile
// ---------------------------------------------------------------------------

// Default number series seeded for every new company
const DEFAULT_NUMBER_SERIES: { entityType: string; prefix: string }[] = [
  { entityType: 'INVOICE', prefix: 'INV-' },
  { entityType: 'CREDIT_NOTE', prefix: 'CN-' },
  { entityType: 'SALES_ORDER', prefix: 'SO-' },
  { entityType: 'SALES_QUOTE', prefix: 'SQ-' },
  { entityType: 'PURCHASE_ORDER', prefix: 'PO-' },
  { entityType: 'JOURNAL', prefix: 'JNL-' },
  { entityType: 'CUSTOMER', prefix: 'CUST-' },
  { entityType: 'SUPPLIER', prefix: 'SUP-' },
  { entityType: 'EMPLOYEE', prefix: 'EMP-' },
];

export async function createCompanyProfile(
  prisma: PrismaClient,
  data: CreateCompanyProfileRequest,
  ctx: RequestContext,
) {
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.companyProfile.create({
      data: {
        ...data,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    // Seed default number series for the new company
    if (DEFAULT_NUMBER_SERIES.length > 0) {
      await tx.numberSeries.createMany({
        data: DEFAULT_NUMBER_SERIES.map((ns) => ({
          companyId: company.id,
          entityType: ns.entityType,
          prefix: ns.prefix,
          nextValue: 1,
          padding: 5,
          isActive: true,
        })),
      });
    }

    // Grant the creating user ADMIN access to the new company
    await tx.userCompanyRole.create({
      data: {
        userId: ctx.userId,
        companyId: company.id,
        role: UserRole.ADMIN,
      },
    });

    return company;
  });

  // TODO: E3 — emit company.created event
  return result;
}

// ---------------------------------------------------------------------------
// updateCompanyProfile
// ---------------------------------------------------------------------------

export async function updateCompanyProfile(
  prisma: PrismaClient,
  companyId: string,
  data: UpdateCompanyProfileRequest,
  ctx: RequestContext,
) {
  const existing = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Company profile not found');
  }

  const updated = await prisma.companyProfile.update({
    where: { id: companyId },
    data: {
      ...data,
      updatedBy: ctx.userId,
    },
  });

  // TODO: E3 — emit settings.updated event
  return updated;
}
