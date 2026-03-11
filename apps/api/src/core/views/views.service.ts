import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { ViewsRepository, SavedViewWithConditions } from './views.repository.js';
import type {
  ViewInitResponse,
  DataViewDto,
  DataViewFieldDto,
  DateRangePresetDto,
  SavedViewDto,
  SavedViewConditionDto,
  UserColumnPreferenceDto,
  FavouriteViewDto,
  CreateSavedViewInput,
  UpdateSavedViewInput,
  ColumnPrefInput,
  SortConfigItem,
  ColumnConfigItem,
  LovStaticValue,
} from './views.types.js';
import {
  ViewNotFoundError,
  ViewScopeForbiddenError,
  DuplicateViewNameError,
} from './views.errors.js';
import type {
  DataView,
  DataViewField,
  DateRangePreset,
  SavedViewCondition,
  UserColumnPreference,
} from '@nexa/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Redis TTL for view metadata cache (1 hour) */
const METADATA_CACHE_TTL_SECONDS = 3600;

/** Admin roles that can create GLOBAL views */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// ---------------------------------------------------------------------------
// Cached metadata shape (stored in Redis)
// ---------------------------------------------------------------------------

interface CachedViewMetadata {
  dataView: DataViewDto;
  fields: DataViewFieldDto[];
  datePresets: DateRangePresetDto[];
}

// ---------------------------------------------------------------------------
// DTO mappers
// ---------------------------------------------------------------------------

export function toDataViewDto(dv: DataView): DataViewDto {
  return {
    id: dv.id,
    viewKey: dv.viewKey,
    viewName: dv.viewName,
    entityTable: dv.entityTable,
    idField: dv.idField,
    defaultSortField: dv.defaultSortField,
    defaultSortDir: dv.defaultSortDir as 'ASC' | 'DESC',
  };
}

export function toDataViewFieldDto(f: DataViewField): DataViewFieldDto {
  return {
    id: f.id,
    fieldKey: f.fieldKey,
    fieldLabel: f.fieldLabel,
    fieldType: f.fieldType,
    defaultVisible: f.defaultVisible,
    defaultOrder: f.defaultOrder,
    defaultWidth: f.defaultWidth,
    sortable: f.sortable,
    filterable: f.filterable,
    advancedFilterOnly: f.advancedFilterOnly,
    pinnable: f.pinnable,
    lovType: f.lovType,
    lovScope: f.lovScope,
    lovStaticValues: f.lovStaticValues as LovStaticValue[] | null,
    lovDependsOn: f.lovDependsOn,
    lovSearchMin: f.lovSearchMin,
  };
}

export function toDateRangePresetDto(p: DateRangePreset): DateRangePresetDto {
  return {
    id: p.id,
    presetKey: p.presetKey,
    presetName: p.presetName,
    orderInList: p.orderInList,
  };
}

function toSavedViewConditionDto(c: SavedViewCondition): SavedViewConditionDto {
  return {
    id: c.id,
    dataViewFieldId: c.dataViewFieldId,
    operator: c.operator,
    value: c.value,
    valueList: c.valueList as string[] | null,
    datePresetId: c.datePresetId,
    groupId: c.groupId,
    groupLogic: c.groupLogic as 'AND' | 'OR',
    outerLogic: c.outerLogic as 'AND' | 'OR',
    conditionOrder: c.conditionOrder,
  };
}

function toSavedViewDto(sv: SavedViewWithConditions): SavedViewDto {
  return {
    id: sv.id,
    name: sv.name,
    groupName: sv.groupName,
    scope: sv.scope,
    createdBy: sv.createdBy,
    dataViewId: sv.dataViewId,
    isFavourite: sv.isFavourite,
    favouriteOrder: sv.favouriteOrder,
    isDefault: sv.isDefault,
    filterLogic: sv.filterLogic as 'AND' | 'OR',
    sortConfig: sv.sortConfig as unknown as SortConfigItem[],
    columnConfig: sv.columnConfig as unknown as ColumnConfigItem[],
    conditions: sv.conditions.map(toSavedViewConditionDto),
  };
}

function toUserColumnPreferenceDto(p: UserColumnPreference): UserColumnPreferenceDto {
  return {
    dataViewFieldId: p.dataViewFieldId,
    visible: p.visible,
    displayOrder: p.displayOrder,
    width: p.width,
    pinned: p.pinned,
  };
}

// ---------------------------------------------------------------------------
// ViewsService — business logic layer
// ---------------------------------------------------------------------------

export class ViewsService {
  constructor(
    private repo: ViewsRepository,
    private redis: Redis | null,
    private logger: Logger,
  ) {}

  // -------------------------------------------------------------------------
  // Cache helpers
  // -------------------------------------------------------------------------

  private metadataCacheKey(companyId: string, viewKey: string): string {
    return `${companyId}:views:meta:${viewKey}`;
  }

  private async getCachedMetadata(
    companyId: string,
    viewKey: string,
  ): Promise<CachedViewMetadata | null> {
    if (!this.redis) return null;
    const key = this.metadataCacheKey(companyId, viewKey);
    const cached = await this.redis.get(key);
    if (!cached) return null;

    try {
      return JSON.parse(cached) as CachedViewMetadata;
    } catch {
      this.logger.warn({ key }, 'Failed to parse cached view metadata, invalidating');
      await this.redis.del(key);
      return null;
    }
  }

  private async setCachedMetadata(
    companyId: string,
    viewKey: string,
    data: CachedViewMetadata,
  ): Promise<void> {
    if (!this.redis) return;
    const key = this.metadataCacheKey(companyId, viewKey);
    await this.redis.set(key, JSON.stringify(data), 'EX', METADATA_CACHE_TTL_SECONDS);
  }

  async invalidateMetadataCache(companyId: string, viewKey: string): Promise<void> {
    if (!this.redis) return;
    const key = this.metadataCacheKey(companyId, viewKey);
    await this.redis.del(key);
  }

  // -------------------------------------------------------------------------
  // Bundled init — single call for all page-mount data (AC: #3)
  // -------------------------------------------------------------------------

  async getViewInit(
    companyId: string,
    userId: string,
    roleIds: string[],
    viewKey: string,
  ): Promise<ViewInitResponse> {
    // Try cache first for metadata (dataView + fields + datePresets)
    let metadata = await this.getCachedMetadata(companyId, viewKey);

    if (!metadata) {
      // Cache miss — fetch from DB
      const dataViewWithFields = await this.repo.getDataViewWithFields(companyId, viewKey);
      if (!dataViewWithFields) {
        throw new ViewNotFoundError(`View '${viewKey}' not found`, 'views.error.notFound', {
          viewKey,
        });
      }

      const datePresets = await this.repo.getDatePresets(companyId);

      metadata = {
        dataView: toDataViewDto(dataViewWithFields),
        fields: dataViewWithFields.fields.map(toDataViewFieldDto),
        datePresets: datePresets.map(toDateRangePresetDto),
      };

      // Populate cache
      await this.setCachedMetadata(companyId, viewKey, metadata);
    }

    // User-specific data — always fresh from DB (not cached)
    const dataViewId = metadata.dataView.id;
    const fieldIds = metadata.fields.map((f) => f.id);

    const [savedViews, columnPrefs] = await Promise.all([
      this.repo.getSavedViews(companyId, userId, roleIds, dataViewId),
      fieldIds.length > 0
        ? this.repo.getUserColumnPreferences(userId, fieldIds)
        : Promise.resolve([]),
    ]);

    return {
      dataView: metadata.dataView,
      fields: metadata.fields,
      datePresets: metadata.datePresets,
      savedViews: savedViews.map(toSavedViewDto),
      userColumnPreferences:
        columnPrefs.length > 0 ? columnPrefs.map(toUserColumnPreferenceDto) : null,
    };
  }

  // -------------------------------------------------------------------------
  // Saved views list (DTO-mapped)
  // -------------------------------------------------------------------------

  async getSavedViews(
    companyId: string,
    userId: string,
    roleIds: string[],
    viewKey: string,
  ): Promise<SavedViewDto[]> {
    const dataView = await this.repo.getDataViewWithFields(companyId, viewKey);
    if (!dataView) {
      throw new ViewNotFoundError(`View '${viewKey}' not found`, 'views.error.notFound', {
        viewKey,
      });
    }

    const savedViews = await this.repo.getSavedViews(companyId, userId, roleIds, dataView.id);
    return savedViews.map(toSavedViewDto);
  }

  // -------------------------------------------------------------------------
  // Saved view CRUD with scope enforcement (AC: #4)
  // -------------------------------------------------------------------------

  async createSavedView(
    companyId: string,
    userId: string,
    userRole: string,
    input: CreateSavedViewInput,
  ): Promise<SavedViewDto> {
    // Scope enforcement: only ADMIN+ can create GLOBAL views
    if (input.scope === 'GLOBAL' && !ADMIN_ROLES.includes(userRole)) {
      throw new ViewScopeForbiddenError(
        'Only administrators can create global views',
        'views.error.globalScopeForbidden',
      );
    }

    // Resolve dataView to get dataViewId
    const dataView = await this.repo.getDataViewWithFields(companyId, input.viewKey);
    if (!dataView) {
      throw new ViewNotFoundError(`View '${input.viewKey}' not found`, 'views.error.notFound', {
        viewKey: input.viewKey,
      });
    }

    try {
      const savedView = await this.repo.createSavedView({
        companyId,
        dataViewId: dataView.id,
        name: input.name,
        groupName: input.groupName,
        scope: input.scope,
        roleId: input.roleId,
        createdBy: userId,
        isFavourite: input.isFavourite ?? false,
        isDefault: input.isDefault ?? false,
        filterLogic: input.filterLogic,
        sortConfig: input.sortConfig,
        columnConfig: input.columnConfig,
        conditions: input.conditions,
      });

      return toSavedViewDto(savedView);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new DuplicateViewNameError(
          `A view named '${input.name}' already exists`,
          'views.error.duplicateName',
          { name: input.name },
        );
      }
      throw error;
    }
  }

  async updateSavedView(
    companyId: string,
    id: string,
    userId: string,
    userRole: string,
    input: UpdateSavedViewInput,
  ): Promise<SavedViewDto> {
    const existing = await this.repo.getSavedViewById(id, companyId);
    if (!existing) {
      throw new ViewNotFoundError('Saved view not found', 'views.error.savedViewNotFound');
    }

    // Only owner or ADMIN+ can update
    if (existing.createdBy !== userId && !ADMIN_ROLES.includes(userRole)) {
      throw new ViewScopeForbiddenError(
        'You can only update your own views',
        'views.error.updateForbidden',
      );
    }

    const updated = await this.repo.updateSavedView(id, companyId, {
      name: input.name,
      groupName: input.groupName,
      filterLogic: input.filterLogic,
      sortConfig: input.sortConfig,
      columnConfig: input.columnConfig,
      conditions: input.conditions,
      isFavourite: input.isFavourite,
      isDefault: input.isDefault,
    });

    return toSavedViewDto(updated);
  }

  async deleteSavedView(
    companyId: string,
    id: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const existing = await this.repo.getSavedViewById(id, companyId);
    if (!existing) {
      throw new ViewNotFoundError('Saved view not found', 'views.error.savedViewNotFound');
    }

    // Only owner or ADMIN+ can delete
    if (existing.createdBy !== userId && !ADMIN_ROLES.includes(userRole)) {
      throw new ViewScopeForbiddenError(
        'You can only delete your own views',
        'views.error.deleteForbidden',
      );
    }

    await this.repo.deleteSavedView(id, companyId);
  }

  // -------------------------------------------------------------------------
  // Favourites & defaults
  // -------------------------------------------------------------------------

  async toggleFavourite(
    companyId: string,
    id: string,
    userId: string,
    roleIds: string[],
  ): Promise<void> {
    const existing = await this.repo.getSavedViewById(id, companyId);
    if (!existing) {
      throw new ViewNotFoundError('Saved view not found', 'views.error.savedViewNotFound');
    }

    // Verify the user can actually see this view (visibility check)
    const canSee =
      existing.scope === 'GLOBAL' ||
      (existing.scope === 'PERSONAL' && existing.createdBy === userId) ||
      (existing.scope === 'ROLE' && existing.roleId && roleIds.includes(existing.roleId));

    if (!canSee) {
      throw new ViewScopeForbiddenError(
        'You do not have access to this view',
        'views.error.viewNotVisible',
      );
    }

    // KNOWN LIMITATION (E7.2): isFavourite is stored on the SavedView record
    // itself. For PERSONAL views this is correct (only the owner can see/toggle).
    // For ROLE/GLOBAL views, toggling mutates the shared record — one user's
    // toggle affects all users who see that view.
    //
    // Resolution: A future migration (tracked as backlog item) should add a
    // `user_saved_view_favourites` junction table for per-user favouriting of
    // shared views. Until then, ROLE/GLOBAL favourites are shared toggles.
    if (existing.scope !== 'PERSONAL') {
      this.logger.warn(
        { viewId: id, scope: existing.scope, userId },
        'Favourite toggle on shared view — affects all users (known limitation)',
      );
    }
    await this.repo.toggleFavourite(id, companyId, !existing.isFavourite);
  }

  async setDefault(companyId: string, id: string, userId: string, userRole: string): Promise<void> {
    const existing = await this.repo.getSavedViewById(id, companyId);
    if (!existing) {
      throw new ViewNotFoundError('Saved view not found', 'views.error.savedViewNotFound');
    }

    // Only owner or ADMIN+ can set default
    if (existing.createdBy !== userId && !ADMIN_ROLES.includes(userRole)) {
      throw new ViewScopeForbiddenError(
        'You can only modify your own views',
        'views.error.updateForbidden',
      );
    }

    await this.repo.setDefault(id, companyId, existing.dataViewId, userId, existing.scope);
  }

  async getFavourites(
    companyId: string,
    userId: string,
    roleIds: string[],
  ): Promise<FavouriteViewDto[]> {
    const favourites = await this.repo.getFavourites(companyId, userId, roleIds);
    // Favourites don't include conditions by default (lightweight list)
    return favourites.map((sv) => ({
      id: sv.id,
      name: sv.name,
      groupName: sv.groupName,
      scope: sv.scope,
      createdBy: sv.createdBy,
      dataViewId: sv.dataViewId,
      viewKey: sv.dataView.viewKey,
      isFavourite: sv.isFavourite,
      favouriteOrder: sv.favouriteOrder,
      isDefault: sv.isDefault,
      filterLogic: sv.filterLogic as 'AND' | 'OR',
      sortConfig: sv.sortConfig as unknown as SortConfigItem[],
      columnConfig: sv.columnConfig as unknown as ColumnConfigItem[],
      conditions: [],
    }));
  }

  // -------------------------------------------------------------------------
  // Column preferences
  // -------------------------------------------------------------------------

  async saveColumnPreferences(
    userId: string,
    viewKey: string,
    companyId: string,
    prefs: ColumnPrefInput[],
  ): Promise<void> {
    // Resolve the data view to get field IDs
    const dataView = await this.repo.getDataViewWithFields(companyId, viewKey);
    if (!dataView) {
      throw new ViewNotFoundError(`View '${viewKey}' not found`, 'views.error.notFound', {
        viewKey,
      });
    }

    const fieldIds = dataView.fields.map((f) => f.id);
    await this.repo.upsertColumnPreferences(userId, fieldIds, prefs);
  }

  async updateColumnWidth(
    companyId: string,
    userId: string,
    viewKey: string,
    dataViewFieldId: string,
    width: number,
  ): Promise<void> {
    // Use Redis metadata cache for field validation to meet 50ms SLA (AC #7).
    // The cache is populated by getViewInit; if cache misses, fall back to DB.
    let metadata = await this.getCachedMetadata(companyId, viewKey);

    if (!metadata) {
      // Cache miss — fetch from DB and populate cache for next time
      const dataView = await this.repo.getDataViewWithFields(companyId, viewKey);
      if (!dataView) {
        throw new ViewNotFoundError(`View '${viewKey}' not found`, 'views.error.notFound', {
          viewKey,
        });
      }

      const datePresets = await this.repo.getDatePresets(companyId);
      metadata = {
        dataView: toDataViewDto(dataView),
        fields: dataView.fields.map(toDataViewFieldDto),
        datePresets: datePresets.map(toDateRangePresetDto),
      };
      await this.setCachedMetadata(companyId, viewKey, metadata);
    }

    const field = metadata.fields.find((f) => f.id === dataViewFieldId);
    if (!field) {
      throw new ViewNotFoundError('Field not found in view', 'views.error.fieldNotFound', {
        fieldId: dataViewFieldId,
      });
    }

    await this.repo.updateColumnWidth(userId, dataViewFieldId, width, field.defaultOrder);
  }
}
