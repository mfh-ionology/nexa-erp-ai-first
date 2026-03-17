import type { PrismaClient } from '@nexa/db';
import { UserRole, loadDefaultAccessGroups, assignFullAccessGroup } from '@nexa/db';
import type { RequestContext } from '../../core/types/request-context.js';
import type {
  CreateCompanyProfileRequest,
  UpdateCompanyProfileRequest,
  ImportDefaultsRequest,
  ExportDefaultsResponse,
  ImportDefaultsResponse,
} from './company-profile.schema.js';
import { NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';

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
  { entityType: 'JOURNAL_ENTRY', prefix: 'JE-' },
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

    // Seed default access groups and assign FULL_ACCESS to the creator
    await loadDefaultAccessGroups(tx, company.id, ctx.userId);
    await assignFullAccessGroup(tx, company.id, ctx.userId);

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

// ---------------------------------------------------------------------------
// exportPermissionConfig — export access groups, permissions, field overrides
// ---------------------------------------------------------------------------

export async function exportPermissionConfig(
  prisma: PrismaClient,
  companyId: string,
): Promise<ExportDefaultsResponse> {
  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  if (!company) {
    throw new NotFoundError('NOT_FOUND', 'Company profile not found');
  }

  const groups = await prisma.accessGroup.findMany({
    where: { companyId, isActive: true },
    include: {
      permissions: {
        select: {
          resourceCode: true,
          canAccess: true,
          canNew: true,
          canView: true,
          canEdit: true,
          canDelete: true,
        },
      },
      fieldOverrides: {
        select: {
          resourceCode: true,
          fieldPath: true,
          visibility: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    exportedFrom: company.name,
    accessGroups: groups.map((g) => ({
      code: g.code,
      name: g.name,
      description: g.description,
      isSystem: g.isSystem,
      permissions: g.permissions,
      fieldOverrides: g.fieldOverrides,
    })),
  };
}

// ---------------------------------------------------------------------------
// updateCompanyAiSettings
// ---------------------------------------------------------------------------

export async function updateCompanyAiSettings(
  prisma: PrismaClient,
  companyId: string,
  key: string,
  value: unknown,
) {
  const profile = await prisma.companyProfile.findUnique({ where: { id: companyId } });
  if (!profile) throw new NotFoundError('NOT_FOUND', 'Company profile not found');

  const currentSettings = (profile.settings as Record<string, unknown>) ?? {};
  const updatedSettings = { ...currentSettings, [key]: value };

  return prisma.companyProfile.update({
    where: { id: companyId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    data: { settings: updatedSettings as any },
  });
}

// ---------------------------------------------------------------------------
// importPermissionConfig — import access groups with upsert + replace-all
// ---------------------------------------------------------------------------

// Internal class used to abort transaction for dryRun without side effects
class DryRunAbort {
  constructor(public readonly result: ImportDefaultsResponse) {}
}

interface ImportSummary {
  accessGroupsCreated: number;
  accessGroupsUpdated: number;
  permissionsSet: number;
  fieldOverridesSet: number;
}

export async function importPermissionConfig(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  data: ImportDefaultsRequest,
  userId: string,
): Promise<ImportDefaultsResponse> {
  // TODO: Populate warnings when resource code validation is added
  // (e.g., "Skipped unknown resourceCode: foo.bar")
  const warnings: string[] = [];

  const result = await prisma
    .$transaction(async (tx) => {
      const summary: ImportSummary = {
        accessGroupsCreated: 0,
        accessGroupsUpdated: 0,
        permissionsSet: 0,
        fieldOverridesSet: 0,
      };

      for (const entry of data.accessGroups) {
        // Check if group already exists to track created vs updated
        const existing = await tx.accessGroup.findUnique({
          where: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            companyId_code: { companyId, code: entry.code },
          },
          select: { id: true, isSystem: true },
        });

        const group = await tx.accessGroup.upsert({
          where: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            companyId_code: { companyId, code: entry.code },
          },
          create: {
            companyId,
            code: entry.code,
            name: entry.name,
            description: entry.description ?? null,
            isSystem: entry.isSystem ?? false,
            createdBy: userId,
            updatedBy: userId,
          },
          update: {
            name: entry.name,
            description: entry.description ?? null,
            // isSystem is NOT updated — preserved from existing
            updatedBy: userId,
          },
        });

        // Replace-all permissions
        await tx.accessGroupPermission.deleteMany({
          where: { accessGroupId: group.id },
        });
        if (entry.permissions.length > 0) {
          await tx.accessGroupPermission.createMany({
            data: entry.permissions.map((p) => ({
              accessGroupId: group.id,
              resourceCode: p.resourceCode,
              canAccess: p.canAccess,
              canNew: p.canNew,
              canView: p.canView,
              canEdit: p.canEdit,
              canDelete: p.canDelete,
            })),
          });
        }

        // Replace-all field overrides
        await tx.accessGroupFieldOverride.deleteMany({
          where: { accessGroupId: group.id },
        });
        if (entry.fieldOverrides.length > 0) {
          await tx.accessGroupFieldOverride.createMany({
            data: entry.fieldOverrides.map((fo) => ({
              accessGroupId: group.id,
              resourceCode: fo.resourceCode,
              fieldPath: fo.fieldPath,
              visibility: fo.visibility,
            })),
          });
        }

        if (existing) {
          summary.accessGroupsUpdated++;
        } else {
          summary.accessGroupsCreated++;
        }
        summary.permissionsSet += entry.permissions.length;
        summary.fieldOverridesSet += entry.fieldOverrides.length;
      }

      const importResult: ImportDefaultsResponse = {
        status: data.dryRun ? 'DRY_RUN' : 'APPLIED',
        summary,
        warnings,
      };

      // If dryRun, abort the transaction to rollback all changes
      if (data.dryRun) {
        throw new DryRunAbort(importResult);
      }

      return importResult;
    })
    .catch((err: unknown) => {
      if (err instanceof DryRunAbort) return err.result;
      throw err;
    });

  // Emit event only for actual (non-dryRun) imports
  if (result.status === 'APPLIED') {
    eventBus.emit('company.defaultData.imported', {
      companyId,
      importedBy: userId,
      version: data.version ?? '1.0.0',
    });
  }

  return result;
}
