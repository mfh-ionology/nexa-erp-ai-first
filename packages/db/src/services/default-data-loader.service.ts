import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ResourceType } from '../../generated/prisma/client';
import type { TransactionClient } from './number-series.service';

// ---------------------------------------------------------------------------
// Types for company-defaults.json structure
// ---------------------------------------------------------------------------

interface DefaultResourceEntry {
  code: string;
  name: string;
  module: string;
  type: string;
  parentCode: string | null;
  sortOrder: number;
  icon: string | null;
  description: string | null;
}

interface DefaultPermissionEntry {
  resourceCode: string;
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface DefaultAccessGroupEntry {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: DefaultPermissionEntry[];
}

interface CompanyDefaults {
  resources: DefaultResourceEntry[];
  accessGroups: DefaultAccessGroupEntry[];
}

// ---------------------------------------------------------------------------
// Cached defaults — loaded once at module initialization, not per-call
// ---------------------------------------------------------------------------

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultsPath = resolve(currentDir, '../../default-data/company-defaults.json');

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const cachedDefaults: CompanyDefaults = JSON.parse(readFileSync(defaultsPath, 'utf-8'));

// ---------------------------------------------------------------------------
// loadDefaultResources — upserts resources from company-defaults.json
// ---------------------------------------------------------------------------

/**
 * Upserts resources from the cached company-defaults.json into the
 * Resource table. Each resource is matched by its unique `code`.
 *
 * - Creates the resource if it does not exist
 * - Updates name, module, type, sortOrder, parentCode, icon, description if it does exist
 * - Handles individual resource failures gracefully (logs and continues)
 *
 * Accepts PrismaClient or TransactionClient (both satisfy TransactionClient
 * structurally) so it can be called inside an existing $transaction.
 *
 * @param db - PrismaClient or TransactionClient instance
 * @returns Counts of created and updated resources
 */
export async function loadDefaultResources(
  db: TransactionClient,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const failures: string[] = [];

  // Topological sort: parents (parentCode === null) before children,
  // ensuring self-referential FK inserts never fail due to ordering
  const sorted = [...cachedDefaults.resources].sort((a, b) => {
    const aIsParent = a.parentCode === null ? 0 : 1;
    const bIsParent = b.parentCode === null ? 0 : 1;
    return aIsParent - bIsParent;
  });

  for (const entry of sorted) {
    try {
      // Check if resource already exists to track created vs updated
      const existing = await db.resource.findUnique({
        where: { code: entry.code },
        select: { id: true },
      });

      await db.resource.upsert({
        where: { code: entry.code },
        create: {
          code: entry.code,
          name: entry.name,
          module: entry.module,
          type: entry.type as ResourceType,
          parentCode: entry.parentCode,
          sortOrder: entry.sortOrder,
          icon: entry.icon,
          description: entry.description,
        },
        update: {
          name: entry.name,
          module: entry.module,
          type: entry.type as ResourceType,
          parentCode: entry.parentCode,
          sortOrder: entry.sortOrder,
          icon: entry.icon,
          description: entry.description,
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to upsert resource "${entry.code}": ${msg}`);
      failures.push(entry.code);
    }
  }

  // eslint-disable-next-line no-console -- seed utility, no structured logger available
  console.info(`Default resources loaded: ${String(created)} created, ${String(updated)} updated`);

  if (failures.length > 0) {
    throw new Error(
      `Failed to load ${String(failures.length)} default resources: ${failures.join(', ')}`,
    );
  }

  return { created, updated };
}

// ---------------------------------------------------------------------------
// loadDefaultAccessGroups — upserts access groups and replaces permissions
// ---------------------------------------------------------------------------

/**
 * Upserts access groups from the cached company-defaults.json for a
 * specific company. Each group is matched by `{ companyId, code }`.
 *
 * - Creates the group if it does not exist
 * - Updates name/description if it already exists (preserves isSystem)
 * - Replaces all permissions for each group with the default set
 * - Handles individual group failures gracefully (logs and continues)
 *
 * Accepts PrismaClient or TransactionClient (both satisfy TransactionClient
 * structurally). When called from within an existing $transaction (e.g.,
 * company creation), per-group operations inherit the outer transaction's
 * atomicity. When called with a bare PrismaClient (e.g., from seed),
 * per-group operations are NOT individually transactional — the caller
 * should wrap in $transaction if atomicity is required.
 *
 * No file I/O is performed — defaults are cached at module load time.
 *
 * @param db - PrismaClient or TransactionClient instance
 * @param companyId - The company to seed access groups for
 * @param createdByUserId - The user ID for audit fields
 * @returns Counts of created and updated access groups
 */
export async function loadDefaultAccessGroups(
  db: TransactionClient,
  companyId: string,
  createdByUserId: string,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const failures: string[] = [];

  for (const entry of cachedDefaults.accessGroups) {
    try {
      // Check if group already exists to track created vs updated
      const existing = await db.accessGroup.findUnique({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          companyId_code: { companyId, code: entry.code },
        },
        select: { id: true },
      });

      const group = await db.accessGroup.upsert({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          companyId_code: { companyId, code: entry.code },
        },
        create: {
          companyId,
          code: entry.code,
          name: entry.name,
          description: entry.description,
          isSystem: entry.isSystem,
          createdBy: createdByUserId,
          updatedBy: createdByUserId,
        },
        update: {
          name: entry.name,
          description: entry.description,
          updatedBy: createdByUserId,
        },
      });

      // Replace-all pattern: delete existing permissions, recreate from defaults
      await db.accessGroupPermission.deleteMany({
        where: { accessGroupId: group.id },
      });

      if (entry.permissions.length > 0) {
        await db.accessGroupPermission.createMany({
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

      if (existing) {
        updated++;
      } else {
        created++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to upsert access group "${entry.code}": ${msg}`);
      failures.push(entry.code);
    }
  }

  // eslint-disable-next-line no-console -- seed utility, no structured logger available
  console.info(`Default access groups loaded: ${String(created)} created, ${String(updated)} updated`);

  if (failures.length > 0) {
    throw new Error(
      `Failed to load ${String(failures.length)} default access groups: ${failures.join(', ')}`,
    );
  }

  return { created, updated };
}

// ---------------------------------------------------------------------------
// assignFullAccessGroup — assigns FULL_ACCESS group to a user
// ---------------------------------------------------------------------------

/**
 * Finds the FULL_ACCESS access group for a company and creates a
 * UserAccessGroup record assigning it to the specified user.
 *
 * @param db - PrismaClient or TransactionClient instance
 * @param companyId - The company to look up the FULL_ACCESS group in
 * @param userId - The user to assign the group to (also used as assignedBy)
 */
export async function assignFullAccessGroup(
  db: TransactionClient,
  companyId: string,
  userId: string,
): Promise<void> {
  const fullAccessGroup = await db.accessGroup.findUnique({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      companyId_code: { companyId, code: 'FULL_ACCESS' },
    },
    select: { id: true },
  });

  if (!fullAccessGroup) {
    // eslint-disable-next-line no-console -- seed utility, no structured logger available
    console.error(`FULL_ACCESS group not found for company ${companyId} — cannot assign admin user`);
    return;
  }

  await db.userAccessGroup.upsert({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      userId_accessGroupId_companyId: {
        userId,
        accessGroupId: fullAccessGroup.id,
        companyId,
      },
    },
    create: {
      userId,
      accessGroupId: fullAccessGroup.id,
      companyId,
      assignedBy: userId,
    },
    update: {
      assignedBy: userId,
    },
  });
}
