import type { PrismaClient } from '@nexa/db';
import type {
  DataView,
  DataViewField,
  DateRangePreset,
  SavedView,
  SavedViewCondition,
  UserColumnPreference,
} from '@nexa/db';
import type {
  ColumnPrefInput,
  CreateSavedViewConditionInput,
  SortConfigItem,
  ColumnConfigItem,
} from './views.types.js';
import type { ViewScope, PinPosition } from '@nexa/db';

/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment -- Prisma JSON fields are inherently untyped */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JSON input type
type JsonInput = any;

// ---------------------------------------------------------------------------
// Prisma result types with relations
// ---------------------------------------------------------------------------

export type DataViewWithFields = DataView & {
  fields: DataViewField[];
};

export type SavedViewWithConditions = SavedView & {
  conditions: SavedViewCondition[];
};

export type FavouriteSavedView = SavedView & {
  dataView: { viewKey: string };
};

// ---------------------------------------------------------------------------
// Input types for create/update operations
// ---------------------------------------------------------------------------

export interface CreateSavedViewData {
  companyId: string;
  dataViewId: string;
  name: string;
  groupName: string;
  scope: ViewScope;
  roleId?: string;
  createdBy: string;
  isFavourite: boolean;
  isDefault: boolean;
  filterLogic: string;
  sortConfig: SortConfigItem[];
  columnConfig: ColumnConfigItem[];
  conditions: CreateSavedViewConditionInput[];
}

export interface UpdateSavedViewData {
  name?: string;
  groupName?: string;
  filterLogic?: string;
  sortConfig?: SortConfigItem[];
  columnConfig?: ColumnConfigItem[];
  conditions?: CreateSavedViewConditionInput[];
  isFavourite?: boolean;
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapConditions(conditions: CreateSavedViewConditionInput[]) {
  return conditions.map((c) => ({
    dataViewFieldId: c.dataViewFieldId,
    operator: c.operator,
    value: c.value ?? null,
    valueList: (c.valueList ?? null) as JsonInput,
    datePresetId: c.datePresetId ?? null,
    groupId: c.groupId ?? 0,
    groupLogic: c.groupLogic ?? 'AND',
    outerLogic: c.outerLogic ?? 'AND',
    conditionOrder: c.conditionOrder,
  })) as JsonInput;
}

function buildScalarUpdates(data: UpdateSavedViewData): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.groupName !== undefined) updates.groupName = data.groupName;
  if (data.filterLogic !== undefined) updates.filterLogic = data.filterLogic;
  if (data.sortConfig !== undefined) updates.sortConfig = data.sortConfig as JsonInput;
  if (data.columnConfig !== undefined) updates.columnConfig = data.columnConfig as JsonInput;
  if (data.isFavourite !== undefined) updates.isFavourite = data.isFavourite;
  if (data.isDefault !== undefined) updates.isDefault = data.isDefault;
  return updates;
}

// ---------------------------------------------------------------------------
// ViewsRepository — database access layer
// ---------------------------------------------------------------------------

export class ViewsRepository {
  constructor(private db: PrismaClient) {}

  // -------------------------------------------------------------------------
  // DataView + fields lookup by viewKey and companyId
  // -------------------------------------------------------------------------

  async getDataViewWithFields(
    companyId: string,
    viewKey: string,
  ): Promise<DataViewWithFields | null> {
    const result = await this.db.dataView.findFirst({
      where: {
        companyId,
        viewKey,
        isActive: true,
      },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { defaultOrder: 'asc' },
        },
      },
    });
    return result as DataViewWithFields | null;
  }

  // -------------------------------------------------------------------------
  // Date range presets for company
  // -------------------------------------------------------------------------

  async getDatePresets(companyId: string): Promise<DateRangePreset[]> {
    return this.db.dateRangePreset.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { orderInList: 'asc' },
    });
  }

  // -------------------------------------------------------------------------
  // User's saved views (personal + matching role + global) for a data view
  // -------------------------------------------------------------------------

  async getSavedViews(
    companyId: string,
    userId: string,
    roleIds: string[],
    dataViewId: string,
  ): Promise<SavedViewWithConditions[]> {
    const result = await this.db.savedView.findMany({
      where: {
        companyId,
        dataViewId,
        OR: [
          { scope: 'PERSONAL', createdBy: userId },
          ...(roleIds.length > 0 ? [{ scope: 'ROLE' as const, roleId: { in: roleIds } }] : []),
          { scope: 'GLOBAL' },
        ],
      },
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
      orderBy: [{ isFavourite: 'desc' }, { favouriteOrder: 'asc' }, { name: 'asc' }],
    });
    return result as SavedViewWithConditions[];
  }

  // -------------------------------------------------------------------------
  // User column preferences for a data view's fields
  // -------------------------------------------------------------------------

  async getUserColumnPreferences(
    userId: string,
    dataViewFieldIds: string[],
  ): Promise<UserColumnPreference[]> {
    return this.db.userColumnPreference.findMany({
      where: {
        userId,
        dataViewFieldId: { in: dataViewFieldIds },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // -------------------------------------------------------------------------
  // Saved view CRUD
  // -------------------------------------------------------------------------

  async createSavedView(data: CreateSavedViewData): Promise<SavedViewWithConditions> {
    const result = await this.db.savedView.create({
      data: {
        companyId: data.companyId,
        dataViewId: data.dataViewId,
        name: data.name,
        groupName: data.groupName,
        scope: data.scope,
        roleId: data.roleId,
        createdBy: data.createdBy,
        isFavourite: data.isFavourite,
        isDefault: data.isDefault,
        filterLogic: data.filterLogic,
        sortConfig: data.sortConfig as JsonInput,
        columnConfig: data.columnConfig as JsonInput,
        conditions: {
          create: mapConditions(data.conditions),
        },
      },
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
    });
    return result as SavedViewWithConditions;
  }

  async updateSavedView(
    id: string,
    companyId: string,
    data: UpdateSavedViewData,
  ): Promise<SavedViewWithConditions> {
    const scalarUpdates = buildScalarUpdates(data);

    // If conditions are provided, delete existing and create new ones
    if (data.conditions !== undefined) {
      const result = await this.db.$transaction(async (tx) => {
        // Delete existing conditions
        await tx.savedViewCondition.deleteMany({
          where: { savedViewId: id },
        });

        // Update the saved view with new conditions
        return tx.savedView.update({
          where: { id, companyId },
          data: {
            ...scalarUpdates,
            conditions: {
              create: mapConditions(data.conditions!),
            },
          },
          include: {
            conditions: {
              orderBy: { conditionOrder: 'asc' },
            },
          },
        });
      });
      return result as SavedViewWithConditions;
    }

    // No conditions update — simple field update
    const result = await this.db.savedView.update({
      where: { id, companyId },
      data: scalarUpdates,
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
    });
    return result as SavedViewWithConditions;
  }

  async deleteSavedView(id: string, companyId: string): Promise<void> {
    await this.db.savedView.delete({
      where: { id, companyId },
    });
  }

  async getSavedViewById(id: string, companyId: string): Promise<SavedViewWithConditions | null> {
    const result = await this.db.savedView.findFirst({
      where: { id, companyId },
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
    });
    return result as SavedViewWithConditions | null;
  }

  // -------------------------------------------------------------------------
  // Favourites
  // -------------------------------------------------------------------------

  async toggleFavourite(id: string, companyId: string, isFavourite: boolean): Promise<void> {
    await this.db.savedView.update({
      where: { id, companyId },
      data: { isFavourite },
    });
  }

  async getFavourites(
    companyId: string,
    userId: string,
    roleIds: string[],
  ): Promise<FavouriteSavedView[]> {
    const result = await this.db.savedView.findMany({
      where: {
        companyId,
        isFavourite: true,
        OR: [
          { scope: 'PERSONAL', createdBy: userId },
          ...(roleIds.length > 0 ? [{ scope: 'ROLE' as const, roleId: { in: roleIds } }] : []),
          { scope: 'GLOBAL' },
        ],
      },
      include: {
        dataView: { select: { viewKey: true } },
      },
      orderBy: [{ favouriteOrder: 'asc' }, { name: 'asc' }],
    });
    return result as unknown as FavouriteSavedView[];
  }

  // -------------------------------------------------------------------------
  // Default view management
  // -------------------------------------------------------------------------

  async setDefault(
    id: string,
    companyId: string,
    dataViewId: string,
    userId: string,
    scope: ViewScope,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // Unset existing defaults for this user + dataView + scope.
      // For PERSONAL views: only the user's own defaults are unset.
      // For ROLE/GLOBAL views: unset any previous default in the same scope
      // set by this user, preventing multiple defaults per scope.
      await tx.savedView.updateMany({
        where: {
          companyId,
          dataViewId,
          createdBy: userId,
          scope,
          isDefault: true,
        },
        data: { isDefault: false },
      });

      // Set the new default (scoped to company)
      await tx.savedView.update({
        where: { id, companyId },
        data: { isDefault: true },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Column preferences
  // -------------------------------------------------------------------------

  async upsertColumnPreferences(
    userId: string,
    dataViewFieldIds: string[],
    prefs: ColumnPrefInput[],
  ): Promise<void> {
    // Filter prefs to only those whose dataViewFieldId belongs to the DataView
    const validFieldIdSet = new Set(dataViewFieldIds);
    const validPrefs = prefs.filter((p) => validFieldIdSet.has(p.dataViewFieldId));

    // Use a transaction to delete existing and create new
    await this.db.$transaction(async (tx) => {
      // Delete existing preferences for these fields
      await tx.userColumnPreference.deleteMany({
        where: {
          userId,
          dataViewFieldId: { in: dataViewFieldIds },
        },
      });

      // Create new preferences (only for validated field IDs)
      if (validPrefs.length > 0) {
        await tx.userColumnPreference.createMany({
          data: validPrefs.map((p) => ({
            userId,
            dataViewFieldId: p.dataViewFieldId,
            visible: p.visible,
            displayOrder: p.displayOrder,
            width: p.width,
            pinned: p.pinned,
          })),
        });
      }
    });
  }

  async updateColumnWidth(
    userId: string,
    dataViewFieldId: string,
    width: number,
    defaultDisplayOrder: number = 0,
  ): Promise<void> {
    // Upsert: update if exists, create with field's default order if not
    await this.db.userColumnPreference.upsert({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- Prisma compound key
        userId_dataViewFieldId: {
          userId,
          dataViewFieldId,
        },
      },
      update: { width },
      create: {
        userId,
        dataViewFieldId,
        visible: true,
        displayOrder: defaultDisplayOrder,
        width,
        pinned: 'NONE' as PinPosition,
      },
    });
  }
}
