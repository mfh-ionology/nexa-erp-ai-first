/**
 * Finance feature — TypeScript types.
 *
 * Mirrors backend finance settings schema from settings.schema.ts.
 * These types represent the API response shape for GET/PUT /finance/settings.
 */

// ---------------------------------------------------------------------------
// Tab-level settings interfaces
// ---------------------------------------------------------------------------

export interface GeneralSettings {
  fiscalYearStartMonth: number;
  baseCurrency: string;
  defaultPaymentTerms: number;
  retainedEarningsAccount?: string;
}

export interface VatSettings {
  vatScheme: 'STANDARD' | 'FLAT_RATE' | 'NONE';
  vatRegistrationNumber?: string;
  mtdEnabled: boolean;
  flatRatePercentage?: number;
}

export interface SubSystemsSettings {
  arEnabled: boolean;
  apEnabled: boolean;
  stockEnabled: boolean;
  payrollEnabled: boolean;
}

export interface TagsSettings {
  enableDepartments: boolean;
  enableCostCentres: boolean;
  enableProjects: boolean;
}

export interface DataEntrySettings {
  requireDescription: boolean;
  autoPopulateVat: boolean;
  defaultSource: 'MANUAL' | 'IMPORT' | 'API';
  warnUnbalanced: boolean;
}

export interface ReconciliationSettings {
  autoMatchEnabled: boolean;
  autoMatchThreshold: number;
  suggestThreshold: number;
}

export interface MultiCurrencySettings {
  multiCurrencyEnabled: boolean;
  autoFetchRates: boolean;
  rateSource: 'BOE' | 'ECB' | 'MANUAL';
}

export interface ReportingSettings {
  defaultReportFormat: 'PDF' | 'EXCEL' | 'CSV';
  includeZeroBalances: boolean;
  showAccountCodes: boolean;
}

// ---------------------------------------------------------------------------
// Combined settings (all 8 tabs)
// ---------------------------------------------------------------------------

export interface FinanceSettings {
  general: GeneralSettings;
  vat: VatSettings;
  subSystems: SubSystemsSettings;
  tags: TagsSettings;
  dataEntry: DataEntrySettings;
  reconciliation: ReconciliationSettings;
  multiCurrency: MultiCurrencySettings;
  reporting: ReportingSettings;
}

// ---------------------------------------------------------------------------
// Update input — all tabs are partial/optional
// ---------------------------------------------------------------------------

export interface UpdateFinanceSettingsInput {
  general?: Partial<GeneralSettings>;
  vat?: Partial<VatSettings>;
  subSystems?: Partial<SubSystemsSettings>;
  tags?: Partial<TagsSettings>;
  dataEntry?: Partial<DataEntrySettings>;
  reconciliation?: Partial<ReconciliationSettings>;
  multiCurrency?: Partial<MultiCurrencySettings>;
  reporting?: Partial<ReportingSettings>;
}

// ---------------------------------------------------------------------------
// Tab key type for navigation
// ---------------------------------------------------------------------------

export type FinanceSettingsTab =
  | 'general'
  | 'vat'
  | 'subSystems'
  | 'tags'
  | 'dataEntry'
  | 'reconciliation'
  | 'multiCurrency'
  | 'reporting';

// ---------------------------------------------------------------------------
// Chart of Accounts — Account types
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const NORMAL_BALANCES = ['DEBIT', 'CREDIT'] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number];

// ---------------------------------------------------------------------------
// Account list item (flat list response)
// ---------------------------------------------------------------------------

export interface AccountListItem {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentCode: string | null;
  isPostable: boolean;
  isControl: boolean;
  isBankAccount: boolean;
  isSystemAccount: boolean;
  isActive: boolean;
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Account classification
// ---------------------------------------------------------------------------

export interface AccountClassification {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  reportSection: string;
}

// ---------------------------------------------------------------------------
// Account detail (single record)
// ---------------------------------------------------------------------------

export interface AccountDetail extends AccountListItem {
  classificationId: string | null;
  classification: AccountClassification | null;
  taxCode: string | null;
  departmentCode: string | null;
  currencyCode: string | null;
  createdBy: string;
  updatedBy: string;
  children?: AccountListItem[];
}

// ---------------------------------------------------------------------------
// Account tree node (recursive, for ?tree=true)
// ---------------------------------------------------------------------------

export interface AccountTreeNode extends AccountListItem {
  children: AccountTreeNode[];
}

// ---------------------------------------------------------------------------
// Create / Update input types
// ---------------------------------------------------------------------------

export interface CreateAccountInput {
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
  classificationId?: string;
  isPostable?: boolean;
  isControl?: boolean;
  isBankAccount?: boolean;
  isSystemAccount?: boolean;
  taxCode?: string;
  departmentCode?: string;
  currencyCode?: string;
  openingBalance?: number;
}

export interface UpdateAccountInput {
  name?: string;
  accountType?: AccountType;
  normalBalance?: NormalBalance;
  parentCode?: string | null;
  classificationId?: string | null;
  isPostable?: boolean;
  isControl?: boolean;
  isBankAccount?: boolean;
  isActive?: boolean;
  taxCode?: string | null;
  departmentCode?: string | null;
  currencyCode?: string | null;
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export interface ListAccountsParams {
  search?: string;
  accountType?: AccountType;
  isActive?: boolean;
  isPostable?: boolean;
  parentCode?: string;
  classificationId?: string;
  tree?: boolean;
  cursor?: string;
  limit?: number;
}

export interface SearchAccountsParams {
  search: string;
  accountType?: AccountType;
  isActive?: boolean;
  limit?: number;
}

// ---------------------------------------------------------------------------
// List response shape
// ---------------------------------------------------------------------------

export interface AccountListResponse {
  items: AccountListItem[];
  meta?: {
    cursor?: string;
    hasMore?: boolean;
    total?: number;
  };
}

// ---------------------------------------------------------------------------
// FE5: Account Mappings
// ---------------------------------------------------------------------------

export interface AccountMapping {
  mappingType: string;
  label: string;
  description: string;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  category: string;
}

export interface UpdateAccountMappingInput {
  mappings: Array<{
    mappingType: string;
    accountId: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// FE6: Financial Reports
// ---------------------------------------------------------------------------

export interface ReportParams {
  fiscalYear: number;
  periodFrom: number;
  periodTo: number;
  includeZeroBalances?: boolean;
  comparePriorYear?: boolean;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
  };
  generatedAt: string;
}

export interface ReportSection {
  sectionName: string;
  rows: ReportLineItem[];
  subtotal: number;
}

export interface ReportLineItem {
  accountCode: string;
  accountName: string;
  amount: number;
  priorYearAmount?: number;
}

export interface ProfitAndLossReport {
  revenue: ReportSection;
  costOfGoodsSold: ReportSection;
  grossProfit: number;
  operatingExpenses: ReportSection;
  operatingProfit: number;
  otherIncome: ReportSection;
  otherExpenses: ReportSection;
  netProfit: number;
  generatedAt: string;
}

export interface BalanceSheetReport {
  assets: {
    currentAssets: ReportSection;
    fixedAssets: ReportSection;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: ReportSection;
    longTermLiabilities: ReportSection;
    totalLiabilities: number;
  };
  equity: ReportSection;
  totalLiabilitiesAndEquity: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// FE7: Bank Accounts
// ---------------------------------------------------------------------------

export type BankAccountStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  iban?: string | null;
  bic?: string | null;
  currencyCode: string;
  glAccountId: string;
  glAccountCode: string;
  glAccountName: string;
  status: BankAccountStatus;
  currentBalance: number;
  lastReconciledDate: string | null;
  lastReconciledBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccountDetail extends BankAccount {
  openingBalance: number;
  openingDate: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  createdBy: string;
  updatedBy: string;
}

export interface CreateBankAccountInput {
  name: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  iban?: string;
  bic?: string;
  currencyCode: string;
  glAccountId: string;
  status?: BankAccountStatus;
  openingBalance?: number;
  openingDate?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

export interface UpdateBankAccountInput {
  name?: string;
  bankName?: string;
  accountNumber?: string;
  sortCode?: string;
  iban?: string | null;
  bic?: string | null;
  currencyCode?: string;
  glAccountId?: string;
  status?: BankAccountStatus;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

export interface BankAccountListParams {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: BankAccountStatus;
}

export interface BankAccountListResponse {
  data: BankAccount[];
  meta: {
    cursor?: string;
    hasMore: boolean;
  };
}

// ---------------------------------------------------------------------------
// FE8: Bank Reconciliation
// ---------------------------------------------------------------------------

export type BankTransactionType = 'CREDIT' | 'DEBIT';
export type BankTransactionStatus = 'UNMATCHED' | 'MATCHED' | 'EXCLUDED';

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  reference: string | null;
  amount: number;
  type: BankTransactionType;
  status: BankTransactionStatus;
  matchedJournalLineId: string | null;
  createdAt: string;
}

export interface JournalLineForMatching {
  id: string;
  journalEntryId: string;
  journalNumber: string;
  date: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  amount: number;
  reference: string | null;
  isMatched: boolean;
}

export interface ReconciliationSummary {
  bankAccountId: string;
  bankAccountName: string;
  statementBalance: number;
  bookBalance: number;
  unmatchedBankCount: number;
  unmatchedJournalCount: number;
  difference: number;
  lastReconciledDate: string | null;
}

export interface MatchResult {
  bankTransactionId: string;
  journalLineId: string;
  matchedAt: string;
}

export interface UnmatchResult {
  bankTransactionId: string;
  unmatchedAt: string;
}

// ---------------------------------------------------------------------------
// FE9: VAT Returns
// ---------------------------------------------------------------------------

export type VatReturnStatus = 'DRAFT' | 'CALCULATED' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

export interface VatReturn {
  id: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  status: VatReturnStatus;
  /** 9-box VAT return fields (HMRC MTD) */
  box1: string;
  box2: string;
  box3: string;
  box4: string;
  box5: string;
  box6: string;
  box7: string;
  box8: string;
  box9: string;
  submittedAt: string | null;
  submittedBy: string | null;
  hmrcCorrelationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VatReturnListResponse {
  items: VatReturn[];
  total: number;
}

export interface VatReturnListParams {
  status?: string;
  year?: number;
  limit?: number;
  offset?: number;
}

export interface CreateVatReturnInput {
  periodStart: string;
  periodEnd: string;
}

// ---------------------------------------------------------------------------
// FE10: Budgets
// ---------------------------------------------------------------------------

export type BudgetStatus = 'DRAFT' | 'APPROVED' | 'CLOSED';

export interface BudgetPeriodAmount {
  period: number;
  amount: string;
}

export interface BudgetLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  periods: BudgetPeriodAmount[];
  total: string;
}

export interface Budget {
  id: string;
  companyId: string;
  name: string;
  fiscalYear: number;
  status: BudgetStatus;
  description: string | null;
  lines: BudgetLine[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetListResponse {
  items: Budget[];
  total: number;
}

export interface BudgetListParams {
  fiscalYear?: number;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateBudgetInput {
  name: string;
  fiscalYear: number;
  description?: string;
}

export interface UpdateBudgetInput {
  name?: string;
  description?: string;
  lines?: Array<{
    accountId: string;
    periods: BudgetPeriodAmount[];
  }>;
}

// ---------------------------------------------------------------------------
// FE11: Journal Templates
// ---------------------------------------------------------------------------

export type TemplateFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'MANUAL';

export interface JournalTemplateLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debitFormula: string | null;
  creditFormula: string | null;
}

export interface JournalTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  frequency: TemplateFrequency;
  nextDueDate: string | null;
  isActive: boolean;
  lines: JournalTemplateLine[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalTemplateListResponse {
  items: JournalTemplate[];
  total: number;
}

export interface JournalTemplateListParams {
  frequency?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateJournalTemplateInput {
  name: string;
  description?: string;
  frequency: TemplateFrequency;
  nextDueDate?: string;
  lines: Array<{
    accountId: string;
    description: string;
    debitFormula?: string;
    creditFormula?: string;
  }>;
}

export interface UpdateJournalTemplateInput {
  name?: string;
  description?: string;
  frequency?: TemplateFrequency;
  nextDueDate?: string;
  isActive?: boolean;
  lines?: Array<{
    accountId: string;
    description: string;
    debitFormula?: string;
    creditFormula?: string;
  }>;
}

// ---------------------------------------------------------------------------
// FE12: Additional Reports
// ---------------------------------------------------------------------------

export interface TransactionJournalEntry {
  id: string;
  date: string;
  journalNumber: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: string;
  credit: string;
  reference: string;
  createdBy: string;
}

export interface TransactionJournalParams {
  dateFrom: string;
  dateTo: string;
  accountId?: string;
  search?: string;
}

export interface BudgetVarianceRow {
  accountCode: string;
  accountName: string;
  budgetAmount: string;
  actualAmount: string;
  variance: string;
  variancePercent: string;
}

export interface BudgetVarianceParams {
  budgetId: string;
  periodFrom?: number;
  periodTo?: number;
}

export interface ReportDataResponse<T> {
  rows: T[];
  totals?: Record<string, string>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// FE13: Finance Dashboard
// ---------------------------------------------------------------------------

export interface FinanceDashboardData {
  cashPosition: string;
  cashTrend: 'up' | 'down' | 'neutral';
  cashPreviousValue: string;
  revenueYtd: string;
  revenueTrend: 'up' | 'down' | 'neutral';
  revenuePreviousValue: string;
  expensesYtd: string;
  expensesTrend: 'up' | 'down' | 'neutral';
  expensesPreviousValue: string;
  profitYtd: string;
  profitTrend: 'up' | 'down' | 'neutral';
  profitPreviousValue: string;
  pendingJournals: number;
  unreconciledTransactions: number;
  overdueInvoices: number;
  upcomingPayments: number;
  alerts: DashboardAlert[];
  recentActivity: DashboardActivity[];
}

export interface DashboardAlert {
  id: string;
  severity: 'info' | 'warning' | 'error';
  titleKey: string;
  description: string;
}

export interface DashboardActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userId: string;
  userName: string;
}

// ---------------------------------------------------------------------------
// FE14: Year-End Close
// ---------------------------------------------------------------------------

export type YearEndStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface YearEndValidation {
  step: string;
  labelKey: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message: string | null;
}

export interface YearEndCloseResult {
  fiscalYear: number;
  status: YearEndStatus;
  validations: YearEndValidation[];
  closedAt: string | null;
  closedBy: string | null;
}

export interface YearEndCloseInput {
  fiscalYear: number;
  retainedEarningsAccountId: string;
}

// ---------------------------------------------------------------------------
// FE14: Opening Balances
// ---------------------------------------------------------------------------

export interface OpeningBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
}

export interface OpeningBalanceImportResult {
  imported: number;
  errors: Array<{ row: number; message: string }>;
}

export interface ManualOpeningBalanceInput {
  date: string;
  lines: Array<{
    accountId: string;
    debit?: string;
    credit?: string;
  }>;
}

// ---------------------------------------------------------------------------
// FE15: Month-End Close
// ---------------------------------------------------------------------------

export type MonthEndStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED';

export interface MonthEndStep {
  id: string;
  key: string;
  labelKey: string;
  description: string;
  isAutomatic: boolean;
  status: MonthEndStepStatus;
  completedAt: string | null;
  completedBy: string | null;
  error: string | null;
}

export interface MonthEndPeriod {
  id: string;
  companyId: string;
  fiscalYear: number;
  period: number;
  periodLabel: string;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  steps: MonthEndStep[];
  progress: number;
  closedAt: string | null;
  closedBy: string | null;
}

export interface MonthEndListResponse {
  items: MonthEndPeriod[];
  total: number;
}

export interface MonthEndListParams {
  fiscalYear?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Visual Constants (FE9-FE15)
// ---------------------------------------------------------------------------

export const VAT_RETURN_STATUS_CONFIG: Record<
  VatReturnStatus,
  { i18nKey: string; color: string; bg: string }
> = {
  DRAFT: { i18nKey: 'finance.vatReturn.status.draft', color: '#6b7280', bg: '#f3f4f6' },
  CALCULATED: { i18nKey: 'finance.vatReturn.status.calculated', color: '#d97706', bg: '#fef3c7' },
  SUBMITTED: { i18nKey: 'finance.vatReturn.status.submitted', color: '#3b82f6', bg: '#dbeafe' },
  ACCEPTED: { i18nKey: 'finance.vatReturn.status.accepted', color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { i18nKey: 'finance.vatReturn.status.rejected', color: '#dc2626', bg: '#fee2e2' },
};

export const BUDGET_STATUS_CONFIG: Record<
  BudgetStatus,
  { i18nKey: string; color: string; bg: string }
> = {
  DRAFT: { i18nKey: 'finance.budget.status.draft', color: '#6b7280', bg: '#f3f4f6' },
  APPROVED: { i18nKey: 'finance.budget.status.approved', color: '#16a34a', bg: '#dcfce7' },
  CLOSED: { i18nKey: 'finance.budget.status.closed', color: '#64748b', bg: '#f1f5f9' },
};

export const TEMPLATE_FREQUENCY_CONFIG: Record<TemplateFrequency, { i18nKey: string }> = {
  DAILY: { i18nKey: 'finance.template.frequency.daily' },
  WEEKLY: { i18nKey: 'finance.template.frequency.weekly' },
  MONTHLY: { i18nKey: 'finance.template.frequency.monthly' },
  QUARTERLY: { i18nKey: 'finance.template.frequency.quarterly' },
  YEARLY: { i18nKey: 'finance.template.frequency.yearly' },
  MANUAL: { i18nKey: 'finance.template.frequency.manual' },
};
