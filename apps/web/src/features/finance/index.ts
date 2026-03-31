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
