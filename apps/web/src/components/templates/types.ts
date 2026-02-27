import type { ColumnDef } from '@tanstack/react-table';
import type { FilterConditionState, SortRuleState } from '@/features/views/types';

/** Common props shared by all page templates */
export interface BaseTemplateProps {
  /** Page title — should be a translation key passed through t() by the caller */
  title: string;
  /** Optional subtitle (e.g., record number) */
  subtitle?: string;
  /** Breadcrumb segments — each segment has label (translation key) and optional path */
  breadcrumbs: BreadcrumbSegment[];
  /** Whether the page is in a loading state */
  isLoading?: boolean;
  /** Children rendered in the template's main content area */
  children?: React.ReactNode;
}

export interface BreadcrumbSegment {
  label: string;
  path?: string;
}

/** T1: EntityListPage props */
export interface EntityListPageProps<TData> extends BaseTemplateProps {
  /** Column definitions for TanStack Table */
  columns: ColumnDef<TData>[];
  /** Data rows */
  data: TData[];
  /** Entity type identifier (for query keys, i18n) */
  entityType: string;
  /** Optional view key — when provided, enables the metadata-driven DataTable
   *  with auto-generated columns from DataView metadata, SavedViewSelector,
   *  ViewsColumnsButton, column resize, and column pinning. */
  viewKey?: string;
  /** Resource code for permission gating (e.g., 'sales.orders.list').
   *  When provided, [+ New] is hidden if canNew=false, batch actions are
   *  filtered by their permissionAction, and resourceCode is available
   *  for ActionBar contexts. */
  resourceCode?: string;
  /** Whether more data is available (cursor pagination) */
  hasMore?: boolean;
  /** Callback to load next page */
  onLoadMore?: () => void;
  /** Whether next page is currently loading */
  isLoadingMore?: boolean;
  /** Search value (controlled) */
  searchValue?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Custom search placeholder text */
  searchPlaceholder?: string;
  /** Slot for filter bar content */
  filterSlot?: React.ReactNode;
  /** Slot for saved view selector */
  savedViewSlot?: React.ReactNode;
  /** Whether the user can create new records (controls [+ New] visibility) */
  canCreate?: boolean;
  /** Callback when [+ New] is clicked */
  onCreateNew?: () => void;
  /** Batch actions configuration — shown when rows are selected */
  batchActions?: BatchAction[];
  /** Row click handler (navigate to detail) */
  onRowClick?: (row: TData) => void;
  /** Unique row key extractor */
  getRowId?: (row: TData) => string;
  /** Overflow menu items for the list page [... More] */
  overflowActions?: OverflowAction[];
  /** Callback when filters are applied via the Filter & Sort modal.
   *  Receives serialised filter conditions for the data fetching hook to
   *  include in API calls. Only relevant when viewKey is provided. */
  onFilterChange?: (
    conditions: FilterConditionState[],
    sortRules: SortRuleState[],
    filterLogic: 'AND' | 'OR',
  ) => void;
}

export interface BatchAction {
  key: string;
  labelKey: string;
  icon?: string;
  variant?: 'default' | 'destructive';
  onAction: (selectedIds: string[]) => void;
  /** Permission check: required action flag (e.g., 'canDelete' for batch delete).
   *  When EntityListPage receives a resourceCode, batch actions whose required
   *  permission is denied are hidden from the selection toolbar. */
  permissionAction?: 'canAccess' | 'canNew' | 'canView' | 'canEdit' | 'canDelete';
}

export interface OverflowAction {
  key: string;
  labelKey: string;
  icon?: string;
  onAction: () => void;
  section?: string;
}

/** T2: RecordDetailPage props */
export interface RecordDetailPageProps extends BaseTemplateProps {
  /** Entity type identifier */
  entityType: string;
  /** Resource code for permission gating (e.g., 'sales.orders.detail').
   *  Callers should pass the same resourceCode to the ActionBar rendered
   *  in actionBarSlot. Used for edit mode toggle and delete visibility. */
  resourceCode?: string;
  /** Current entity status (for StatusBadge) */
  status?: string;
  /** Tab definitions */
  tabs: TabDefinition[];
  /** Active tab key (controlled) */
  activeTab?: string;
  /** Tab change handler */
  onTabChange?: (tabKey: string) => void;
  /** Slot for action bar component (rendered by E6.4) */
  actionBarSlot?: React.ReactNode;
  /** Related entities configuration */
  relatedEntities?: RelatedEntityConfig[];
  /** Slot for EventFlowTracker component (optional) */
  eventFlowSlot?: React.ReactNode;
}

export interface TabDefinition {
  key: string;
  labelKey: string;
  content: React.ReactNode;
  icon?: string;
}

export interface RelatedEntityConfig {
  key: string;
  labelKey: string;
  count: number;
  path?: string;
}

/** T3: HeaderLinesPage props */
export interface HeaderLinesPageProps<TLine> extends BaseTemplateProps {
  /** Entity type identifier */
  entityType: string;
  /** Resource code for permission gating (e.g., 'finance.invoices.detail').
   *  Callers should pass the same resourceCode to the ActionBar rendered
   *  in actionBarSlot. Used for edit mode toggle and delete visibility. */
  resourceCode?: string;
  /** Current entity status (for StatusBadge) */
  status?: string;
  /** Tab definitions for header section */
  headerTabs: TabDefinition[];
  /** Active header tab key (controlled) */
  activeHeaderTab?: string;
  /** Header tab change handler */
  onHeaderTabChange?: (tabKey: string) => void;
  /** Line item column definitions */
  lineColumns: ColumnDef<TLine>[];
  /** Line items data */
  lines: TLine[];
  /** Callback to add a new line */
  onAddLine?: () => void;
  /** Callback to remove a line by index */
  onRemoveLine?: (index: number) => void;
  /** Callback when a line cell is edited */
  onLineChange?: (index: number, field: string, value: unknown) => void;
  /** Whether lines are editable (false for read-only/approved docs) */
  isEditable?: boolean;
  /** Totals configuration */
  totals?: TotalsConfig;
  /** Slot for action bar component */
  actionBarSlot?: React.ReactNode;
  /** Slot for EventFlowTracker */
  eventFlowSlot?: React.ReactNode;
  /** Unique line key extractor */
  getLineId?: (line: TLine) => string;
}

export interface TotalsConfig {
  subtotal: string;
  vatAmount?: string;
  vatRate?: string;
  total: string;
  additionalLines?: { labelKey: string; value: string }[];
}

/** T4: BriefingPage props */
export interface BriefingPageProps extends BaseTemplateProps {
  /** Briefing cards to display */
  cards: BriefingCardConfig[];
  /** Optional greeting message key */
  greetingKey?: string;
  /** User's first name for greeting */
  userName?: string;
  /** Optional summary/headline metrics */
  summaryMetrics?: SummaryMetric[];
}

export interface BriefingCardConfig {
  id: string;
  type: 'kpi' | 'action' | 'alert';
  titleKey: string;
  value?: string;
  previousValue?: string;
  format?: 'currency' | 'number' | 'percent';
  description?: string;
  actionLabelKey?: string;
  onAction?: () => void;
  severity?: 'info' | 'warning' | 'error';
  icon?: string;
}

export interface SummaryMetric {
  labelKey: string;
  value: string;
  previousValue?: string;
  format: 'currency' | 'number' | 'percent';
  trend?: 'up' | 'down' | 'neutral';
}

/** Default card shape used by the built-in card renderer when no renderCard is provided */
export interface DefaultBoardCardData {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  assignee?: string;
}

/** T5: BoardPage props */
export interface BoardPageProps<TCard> extends BaseTemplateProps {
  /** Column definitions for the board */
  columns: BoardColumn<TCard>[];
  /** Callback when a card is moved between columns */
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string) => void;
  /** Callback when a card is clicked */
  onCardClick?: (card: TCard) => void;
  /** Whether the user can create new cards */
  canCreate?: boolean;
  /** Callback when [+ New Card] is clicked */
  onCreateNew?: () => void;
  /** Slot for action bar */
  actionBarSlot?: React.ReactNode;
  /** Custom card renderer — overrides the default card layout.
   *  When not provided, the default renderer expects cards matching DefaultBoardCardData. */
  renderCard?: (card: TCard) => React.ReactNode;
}

export interface BoardColumn<TCard> {
  key: string;
  labelKey: string;
  cards: TCard[];
  color?: string;
}

/** T6: WizardPage props */
export interface WizardPageProps extends BaseTemplateProps {
  /** Step definitions */
  steps: WizardStep[];
  /** Current active step index (0-based) */
  activeStep: number;
  /** Callback to go to next step */
  onNext?: () => void;
  /** Callback to go to previous step */
  onBack?: () => void;
  /** Callback when wizard is completed */
  onComplete?: () => void;
  /** Whether the current step passes validation */
  isCurrentStepValid?: boolean;
  /** Slot for action bar */
  actionBarSlot?: React.ReactNode;
}

export interface WizardStep {
  key: string;
  labelKey: string;
  descriptionKey?: string;
  content: React.ReactNode;
  icon?: string;
  isOptional?: boolean;
}

/** T7: SettingsPage props */
export interface SettingsPageProps extends BaseTemplateProps {
  /** Setting group definitions */
  groups: SettingsGroup[];
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Callback to save settings */
  onSave?: () => void;
  /** Callback to reset to defaults */
  onReset?: () => void;
  /** Slot for action bar */
  actionBarSlot?: React.ReactNode;
}

export interface SettingsGroup {
  key: string;
  labelKey: string;
  descriptionKey?: string;
  content: React.ReactNode;
  icon?: string;
  isCollapsible?: boolean;
  defaultOpen?: boolean;
}

/** T8: ReportPage props */
export interface ReportPageProps<TResult> extends BaseTemplateProps {
  /** Parameter form content */
  parameterSlot: React.ReactNode;
  /** Whether the report has been run */
  hasResults?: boolean;
  /** Result column definitions */
  resultColumns?: ColumnDef<TResult>[];
  /** Result data rows */
  resultData?: TResult[];
  /** AI summary text slot */
  aiSummarySlot?: React.ReactNode;
  /** Callback to run the report */
  onRunReport?: () => void;
  /** Whether the report is currently running */
  isRunning?: boolean;
  /** Totals row data (optional) */
  totals?: Record<string, string>;
  /** Slot for action bar */
  actionBarSlot?: React.ReactNode;
}
