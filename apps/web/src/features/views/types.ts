/**
 * Views feature types — frontend DTOs matching the backend ViewInitResponse
 * and related API contracts (§3.13 Views, Filters & Columns Endpoints).
 *
 * NOTE: SavedViewDto includes `createdBy` and `dataViewId` fields that are
 * required by the frontend for ownership checks and favourites navigation.
 * These were flagged as missing in E7.1 code review (ISSUE #8, #9) — the
 * backend must be patched to return them. The frontend types are defined
 * correctly here per the API contract spec.
 */

// ---------------------------------------------------------------------------
// Enum-like string literal types (match @nexa/db enums)
// ---------------------------------------------------------------------------

export type FieldDataType = 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'ENUM' | 'CURRENCY';

export type LovType = 'NONE' | 'STATIC' | 'GLOBAL' | 'VIEW_SPECIFIC';

export type PinPosition = 'NONE' | 'LEFT' | 'RIGHT';

export type ViewScope = 'PERSONAL' | 'ROLE' | 'GLOBAL';

export type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'BETWEEN'
  | 'IN'
  | 'NOT_IN'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

// ---------------------------------------------------------------------------
// DTOs — API response shapes (match backend ViewInitResponse)
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

export interface LovStaticValue {
  value: string;
  label: string;
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

export interface DateRangePresetDto {
  id: string;
  presetKey: string;
  presetName: string;
  orderInList: number;
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

export interface UserColumnPreferenceDto {
  dataViewFieldId: string;
  visible: boolean;
  displayOrder: number;
  width: number;
  pinned: PinPosition;
}

/**
 * Extended DTO returned by GET /views/favourites — includes viewKey
 * from the joined DataView for client-side route navigation.
 */
export interface FavouriteViewDto extends SavedViewDto {
  viewKey: string;
}

export interface ViewInitResponse {
  dataView: DataViewDto;
  fields: DataViewFieldDto[];
  datePresets: DateRangePresetDto[];
  savedViews: SavedViewDto[];
  userColumnPreferences: UserColumnPreferenceDto[] | null;
}

// ---------------------------------------------------------------------------
// Request types (match backend CreateSavedViewInput / UpdateSavedViewInput)
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

export interface CreateSavedViewRequest {
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

export interface UpdateSavedViewRequest {
  name?: string;
  groupName?: string;
  filterLogic?: 'AND' | 'OR';
  sortConfig?: SortConfigItem[];
  columnConfig?: ColumnConfigItem[];
  conditions?: CreateSavedViewConditionInput[];
  isFavourite?: boolean;
  isDefault?: boolean;
}

export interface ColumnPrefInput {
  dataViewFieldId: string;
  visible: boolean;
  displayOrder: number;
  width: number;
  pinned: PinPosition;
}

// ---------------------------------------------------------------------------
// Internal UI state types
// ---------------------------------------------------------------------------

export interface ColumnState {
  fieldId: string;
  fieldKey: string;
  fieldLabel: string;
  visible: boolean;
  order: number;
  width: number;
  pinned: PinPosition;
  pinnable: boolean;
  sortable: boolean;
  fieldType: FieldDataType;
}

/** Active filter condition in UI state (not yet saved) */
export interface FilterConditionState {
  id: string; // Client-generated UUID for key prop
  dataViewFieldId: string;
  fieldKey: string; // For display — resolved from field metadata
  fieldLabel: string;
  fieldType: FieldDataType;
  operator: FilterOperator;
  value: string | null;
  valueList: string[] | null;
  datePresetId: string | null;
  groupId: number;
  groupLogic: 'AND' | 'OR';
  outerLogic: 'AND' | 'OR';
  conditionOrder: number;
}

/** Active sort rule in UI state */
export interface SortRuleState {
  id: string; // Client-generated UUID
  field: string; // fieldKey
  fieldLabel: string; // For display
  direction: 'ASC' | 'DESC';
  priority: number;
}

/** Filter mode */
export type FilterMode = 'simple' | 'advanced';
