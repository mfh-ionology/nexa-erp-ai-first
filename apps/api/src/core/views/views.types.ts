import type { FieldDataType, FilterOperator, LovType, PinPosition, ViewScope } from '@nexa/db';

// ---------------------------------------------------------------------------
// DTOs — API response shapes (match API Contracts §3.13)
// ---------------------------------------------------------------------------

export interface DataViewDto {
  id: string;
  viewKey: string;
  viewName: string;
  entityTable: string;
  idField: string;
  defaultSortField: string;
  defaultSortDir: 'ASC' | 'DESC';
}

export interface DataViewFieldDto {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldDataType;
  defaultVisible: boolean;
  defaultOrder: number;
  defaultWidth: number;
  sortable: boolean;
  filterable: boolean;
  advancedFilterOnly: boolean;
  pinnable: boolean;
  lovType: LovType;
  lovScope: string | null;
  lovStaticValues: LovStaticValue[] | null;
  lovDependsOn: string | null;
  lovSearchMin: number;
}

export interface LovStaticValue {
  value: string;
  label: string;
}

export interface DateRangePresetDto {
  id: string;
  presetKey: string;
  presetName: string;
  orderInList: number;
}

export interface SavedViewConditionDto {
  id: string;
  dataViewFieldId: string;
  operator: FilterOperator;
  value: string | null;
  valueList: string[] | null;
  datePresetId: string | null;
  groupId: number;
  groupLogic: 'AND' | 'OR';
  outerLogic: 'AND' | 'OR';
  conditionOrder: number;
}

export interface SortConfigItem {
  field: string;
  direction: 'ASC' | 'DESC';
  priority: number;
}

export interface ColumnConfigItem {
  fieldId: string;
  visible: boolean;
  order: number;
  width: number;
  pinned: PinPosition;
}

export interface SavedViewDto {
  id: string;
  name: string;
  groupName: string;
  scope: ViewScope;
  createdBy: string;
  dataViewId: string;
  isFavourite: boolean;
  favouriteOrder: number;
  isDefault: boolean;
  filterLogic: 'AND' | 'OR';
  sortConfig: SortConfigItem[];
  columnConfig: ColumnConfigItem[];
  conditions: SavedViewConditionDto[];
}

/** Extended DTO for GET /views/favourites — includes viewKey from joined DataView */
export interface FavouriteViewDto extends SavedViewDto {
  viewKey: string;
}

export interface UserColumnPreferenceDto {
  dataViewFieldId: string;
  visible: boolean;
  displayOrder: number;
  width: number;
  pinned: PinPosition;
}

/** Bundled init response — returned by GET /views/init */
export interface ViewInitResponse {
  dataView: DataViewDto;
  fields: DataViewFieldDto[];
  datePresets: DateRangePresetDto[];
  savedViews: SavedViewDto[];
  userColumnPreferences: UserColumnPreferenceDto[] | null;
}

// ---------------------------------------------------------------------------
// Request input types (match API Contracts §3.13)
// ---------------------------------------------------------------------------

export interface CreateSavedViewConditionInput {
  dataViewFieldId: string;
  operator: FilterOperator;
  value?: string;
  valueList?: string[];
  datePresetId?: string;
  groupId?: number;
  groupLogic?: 'AND' | 'OR';
  outerLogic?: 'AND' | 'OR';
  conditionOrder: number;
}

export interface CreateSavedViewInput {
  viewKey: string;
  name: string;
  groupName: string;
  scope: ViewScope;
  roleId?: string;
  isFavourite?: boolean;
  isDefault?: boolean;
  filterLogic: 'AND' | 'OR';
  sortConfig: SortConfigItem[];
  columnConfig: ColumnConfigItem[];
  conditions: CreateSavedViewConditionInput[];
}

export interface UpdateSavedViewInput {
  name?: string;
  groupName?: string;
  filterLogic?: 'AND' | 'OR';
  sortConfig?: SortConfigItem[];
  columnConfig?: ColumnConfigItem[];
  conditions?: CreateSavedViewConditionInput[];
  isFavourite?: boolean;
  isDefault?: boolean;
}

export interface BatchLovRequestItem {
  fieldId: string;
  lovScope: string;
  search?: string;
  parentValue?: string;
  limit?: number;
}

export interface BatchLovResponse {
  results: Record<string, LovStaticValue[]>;
}

export interface UpdateColumnWidthInput {
  width: number;
}

export interface ColumnPrefInput {
  dataViewFieldId: string;
  visible: boolean;
  displayOrder: number;
  width: number;
  pinned: PinPosition;
}
