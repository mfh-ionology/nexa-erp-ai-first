/**
 * Finance feature module -- barrel exports.
 *
 * Provides finance settings page, hooks, and types
 * for the Finance module frontend.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  FinanceSettings,
  UpdateFinanceSettingsInput,
  GeneralSettings,
  VatSettings,
  SubSystemsSettings,
  TagsSettings,
  DataEntrySettings,
  ReconciliationSettings,
  MultiCurrencySettings,
  ReportingSettings,
  FinanceSettingsTab,
} from './types';

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export { FinanceSettingsPage } from './pages/FinanceSettingsPage';

// FE9: VAT Returns
export { VatReturnListPage } from './pages/VatReturnListPage';
export { VatReturnDetailPage } from './pages/VatReturnDetailPage';

// FE10: Budgets
export { BudgetListPage } from './pages/BudgetListPage';
export { BudgetDetailPage } from './pages/BudgetDetailPage';

// FE11: Journal Templates
export { JournalTemplateListPage } from './pages/JournalTemplateListPage';

// FE12: Additional Reports
export { TransactionJournalPage } from './pages/TransactionJournalPage';
export { BudgetVariancePage } from './pages/BudgetVariancePage';

// Enhanced Reports (Wave 10)
export { GlDetailPage } from './pages/GlDetailPage';
export { GeneralLedgerPage } from './pages/GeneralLedgerPage';
export { DepartmentalPnlPage } from './pages/DepartmentalPnlPage';

// Import
export { FinanceImportPage } from './pages/FinanceImportPage';

// FE13: Finance Dashboard
export { FinanceDashboardPage } from './pages/FinanceDashboardPage';

// FE14: Year-End & Opening Balances
export { YearEndWizardPage } from './pages/YearEndWizardPage';
export { OpeningBalancesPage } from './pages/OpeningBalancesPage';

// FE15: Month-End Close
export { MonthEndListPage } from './pages/MonthEndListPage';
export { MonthEndClosePage } from './pages/MonthEndClosePage';

// ---------------------------------------------------------------------------
// Hooks (FE9-FE15)
// ---------------------------------------------------------------------------

export {
  useVatReturns,
  useVatReturn,
  useCreateVatReturn,
  useCalculateVatReturn,
  useSubmitVatReturn,
} from './hooks/use-vat-returns';

export {
  useBudgets,
  useBudget,
  useCreateBudget,
  useUpdateBudget,
  useApproveBudget,
  useCopyBudget,
} from './hooks/use-budgets';

export {
  useJournalTemplates,
  useJournalTemplate,
  useCreateJournalTemplate,
  useUpdateJournalTemplate,
  useDeleteJournalTemplate,
  useExecuteJournalTemplate,
} from './hooks/use-journal-templates';

export { useTransactionJournal, useBudgetVarianceReport } from './hooks/use-additional-reports';

export { useGlDetail, useGeneralLedger, useDepartmentalPnl } from './hooks/use-enhanced-reports';

export { useFinanceDashboard } from './hooks/use-finance-dashboard';

export {
  useYearEndStatus,
  useCloseYearEnd,
  useOpeningBalances,
  useImportOpeningBalances,
  useManualOpeningBalances,
} from './hooks/use-year-end';

export {
  useMonthEndPeriods,
  useMonthEndPeriod,
  useCloseMonthEnd,
  useCompleteMonthEndStep,
} from './hooks/use-month-end';

// ---------------------------------------------------------------------------
// Types (FE9-FE15)
// ---------------------------------------------------------------------------

export type {
  VatReturn,
  VatReturnStatus,
  VatReturnListResponse,
  VatReturnListParams,
  CreateVatReturnInput,
  Budget,
  BudgetStatus,
  BudgetLine,
  BudgetPeriodAmount,
  BudgetListResponse,
  BudgetListParams,
  CreateBudgetInput,
  UpdateBudgetInput,
  JournalTemplate,
  TemplateFrequency,
  JournalTemplateLine,
  JournalTemplateListResponse,
  JournalTemplateListParams,
  CreateJournalTemplateInput,
  UpdateJournalTemplateInput,
  TransactionJournalEntry,
  TransactionJournalParams,
  BudgetVarianceRow,
  BudgetVarianceParams,
  ReportDataResponse,
  FinanceDashboardData,
  DashboardAlert,
  DashboardActivity,
  YearEndCloseResult,
  YearEndCloseInput,
  YearEndValidation,
  OpeningBalanceLine,
  OpeningBalanceImportResult,
  ManualOpeningBalanceInput,
  MonthEndPeriod,
  MonthEndStep,
  MonthEndStepStatus,
  MonthEndListResponse,
  MonthEndListParams,
} from './types';
