import type { PrismaClient, FieldVisibility } from '@nexa/db';
import { UserRole, loadDefaultData } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type {
  CreateCompanyProfileRequest,
  UpdateCompanyProfileRequest,
  ImportDefaultsRequest,
} from './company-profile.schema.js';
import { NotFoundError } from '../../core/errors/index.js';
import { permissionCache } from '../../core/rbac/index.js';

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

    // Seed default access groups with permissions and field overrides
    const defaults = loadDefaultData();
    let fullAccessGroupId: string | null = null;

    for (const agDef of defaults.accessGroups) {
      const ag = await tx.accessGroup.create({
        data: {
          companyId: company.id,
          code: agDef.code,
          name: agDef.name,
          description: agDef.description,
          isSystem: agDef.isSystem,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });

      if (agDef.code === 'FULL_ACCESS') {
        fullAccessGroupId = ag.id;
      }

      if (agDef.permissions.length > 0) {
        await tx.accessGroupPermission.createMany({
          data: agDef.permissions.map((p) => ({
            accessGroupId: ag.id,
            resourceCode: p.resourceCode,
            canAccess: p.canAccess,
            canNew: p.canNew,
            canView: p.canView,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
          })),
        });
      }

      if (agDef.fieldOverrides.length > 0) {
        await tx.accessGroupFieldOverride.createMany({
          data: agDef.fieldOverrides.map((fo) => ({
            accessGroupId: ag.id,
            resourceCode: fo.resourceCode,
            fieldPath: fo.fieldPath,
            visibility: fo.visibility as FieldVisibility,
          })),
        });
      }
    }

    // Assign the FULL_ACCESS group to the creating user
    if (fullAccessGroupId) {
      await tx.userAccessGroup.create({
        data: {
          userId: ctx.userId,
          companyId: company.id,
          accessGroupId: fullAccessGroupId,
          assignedBy: ctx.userId,
        },
      });
    }

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

// ---------------------------------------------------------------------------
// exportDefaults — export company's access groups, permissions, field overrides
// ---------------------------------------------------------------------------

export async function exportDefaults(prisma: PrismaClient, companyId: string) {
  const accessGroups = await prisma.accessGroup.findMany({
    where: { companyId },
    include: {
      permissions: { orderBy: { resourceCode: 'asc' } },
      fieldOverrides: { orderBy: [{ resourceCode: 'asc' }, { fieldPath: 'asc' }] },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    companyId,
    accessGroups: accessGroups.map((ag) => ({
      code: ag.code,
      name: ag.name,
      description: ag.description ?? '',
      isSystem: ag.isSystem,
      permissions: ag.permissions.map((p) => ({
        resourceCode: p.resourceCode,
        canAccess: p.canAccess,
        canNew: p.canNew,
        canView: p.canView,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      })),
      fieldOverrides: ag.fieldOverrides.map((fo) => ({
        resourceCode: fo.resourceCode,
        fieldPath: fo.fieldPath,
        visibility: fo.visibility,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// importDefaults — upsert access groups with permissions and field overrides
// ---------------------------------------------------------------------------

export async function importDefaults(
  prisma: PrismaClient,
  companyId: string,
  data: ImportDefaultsRequest,
  ctx: RequestContext,
) {
  const results = { created: 0, updated: 0 };

  for (const agData of data.accessGroups) {
    const existing = await prisma.accessGroup.findUnique({
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Prisma compound unique key
      where: { companyId_code: { companyId, code: agData.code } },
    });

    let groupId: string;

    if (existing) {
      await prisma.accessGroup.update({
        where: { id: existing.id },
        data: {
          name: agData.name,
          description: agData.description ?? null,
          updatedBy: ctx.userId,
        },
      });
      groupId = existing.id;
      results.updated++;
    } else {
      const created = await prisma.accessGroup.create({
        data: {
          companyId,
          code: agData.code,
          name: agData.name,
          description: agData.description ?? null,
          isSystem: agData.isSystem ?? false,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });
      groupId = created.id;
      results.created++;
    }

    // Replace permissions if provided
    if (agData.permissions.length > 0) {
      await prisma.$transaction([
        prisma.accessGroupPermission.deleteMany({ where: { accessGroupId: groupId } }),
        prisma.accessGroupPermission.createMany({
          data: agData.permissions.map((p) => ({
            accessGroupId: groupId,
            resourceCode: p.resourceCode,
            canAccess: p.canAccess,
            canNew: p.canNew,
            canView: p.canView,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
          })),
        }),
      ]);
    }

    // Replace field overrides if provided
    if (agData.fieldOverrides.length > 0) {
      await prisma.$transaction([
        prisma.accessGroupFieldOverride.deleteMany({ where: { accessGroupId: groupId } }),
        prisma.accessGroupFieldOverride.createMany({
          data: agData.fieldOverrides.map((fo) => ({
            accessGroupId: groupId,
            resourceCode: fo.resourceCode,
            fieldPath: fo.fieldPath,
            visibility: fo.visibility as FieldVisibility,
          })),
        }),
      ]);
    }
  }

  permissionCache.invalidateCompany(companyId);

  return results;
}
