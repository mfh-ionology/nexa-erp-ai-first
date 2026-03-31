/* eslint-disable i18next/no-literal-string */
/**
 * FinanceSettingsPage — T7 Settings layout for Finance module settings.
 *
 * 8 tabs: General, VAT, Sub-Systems, Tags, Data Entry, Reconciliation,
 * Multi-Currency, Reporting.
 *
 * Uses the SettingsPage template with tab-based navigation.
 * Each tab renders form fields that map to the API tab groups.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calculator,
  Coins,
  FileText,
  Globe,
  Layers,
  Receipt,
  Settings,
  Tags,
} from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { SettingsPage } from '@/components/templates/settings-page';

import {
  useFinanceSettings,
  useUpdateFinanceSettings,
  useResetFinanceSettings,
} from '../hooks/use-finance-settings';
import type { FinanceSettings, FinanceSettingsTab } from '../types';

// ---------------------------------------------------------------------------
// Default settings (used for initial form state before API loads)
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: FinanceSettings = {
  general: {
    fiscalYearStartMonth: 1,
    baseCurrency: 'GBP',
    defaultPaymentTerms: 30,
    retainedEarningsAccount: undefined,
  },
  vat: {
    vatScheme: 'STANDARD',
    vatRegistrationNumber: undefined,
    mtdEnabled: false,
    flatRatePercentage: undefined,
  },
  subSystems: {
    arEnabled: true,
    apEnabled: true,
    stockEnabled: true,
    payrollEnabled: false,
  },
  tags: {
    enableDepartments: false,
    enableCostCentres: false,
    enableProjects: false,
  },
  dataEntry: {
    requireDescription: false,
    autoPopulateVat: true,
    defaultSource: 'MANUAL',
    warnUnbalanced: true,
  },
  reconciliation: {
    autoMatchEnabled: true,
    autoMatchThreshold: 95,
    suggestThreshold: 60,
  },
  multiCurrency: {
    multiCurrencyEnabled: false,
    autoFetchRates: false,
    rateSource: 'BOE',
  },
  reporting: {
    defaultReportFormat: 'PDF',
    includeZeroBalances: false,
    showAccountCodes: true,
  },
};

// ---------------------------------------------------------------------------
// Month names for fiscal year dropdown
// ---------------------------------------------------------------------------

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// ---------------------------------------------------------------------------
// Deep equality check for settings objects
// ---------------------------------------------------------------------------

function settingsEqual(a: FinanceSettings, b: FinanceSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// FinanceSettingsPage
// ---------------------------------------------------------------------------

export function FinanceSettingsPage() {
  const { t } = useI18n();

  // API hooks
  const { settings: serverSettings, isLoading } = useFinanceSettings();
  const updateMutation = useUpdateFinanceSettings();
  const resetMutation = useResetFinanceSettings();

  // Local form state
  const [formState, setFormState] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<FinanceSettingsTab>('general');

  // Sync server → local form when data loads
  useEffect(() => {
    if (serverSettings) {
      setFormState(serverSettings);
    }
  }, [serverSettings]);

  // Dirty detection
  const isDirty = useMemo(() => {
    if (!serverSettings) return false;
    return !settingsEqual(formState, serverSettings);
  }, [formState, serverSettings]);

  // --- Updaters ---
  const updateGeneral = useCallback((patch: Partial<FinanceSettings['general']>) => {
    setFormState((prev) => ({
      ...prev,
      general: { ...prev.general, ...patch },
    }));
  }, []);

  const updateVat = useCallback((patch: Partial<FinanceSettings['vat']>) => {
    setFormState((prev) => ({
      ...prev,
      vat: { ...prev.vat, ...patch },
    }));
  }, []);

  const updateSubSystems = useCallback((patch: Partial<FinanceSettings['subSystems']>) => {
    setFormState((prev) => ({
      ...prev,
      subSystems: { ...prev.subSystems, ...patch },
    }));
  }, []);

  const updateTags = useCallback((patch: Partial<FinanceSettings['tags']>) => {
    setFormState((prev) => ({
      ...prev,
      tags: { ...prev.tags, ...patch },
    }));
  }, []);

  const updateDataEntry = useCallback((patch: Partial<FinanceSettings['dataEntry']>) => {
    setFormState((prev) => ({
      ...prev,
      dataEntry: { ...prev.dataEntry, ...patch },
    }));
  }, []);

  const updateReconciliation = useCallback((patch: Partial<FinanceSettings['reconciliation']>) => {
    setFormState((prev) => ({
      ...prev,
      reconciliation: { ...prev.reconciliation, ...patch },
    }));
  }, []);

  const updateMultiCurrency = useCallback((patch: Partial<FinanceSettings['multiCurrency']>) => {
    setFormState((prev) => ({
      ...prev,
      multiCurrency: { ...prev.multiCurrency, ...patch },
    }));
  }, []);

  const updateReporting = useCallback((patch: Partial<FinanceSettings['reporting']>) => {
    setFormState((prev) => ({
      ...prev,
      reporting: { ...prev.reporting, ...patch },
    }));
  }, []);

  // --- Save / Reset handlers ---
  const handleSave = useCallback(() => {
    updateMutation.mutate(formState);
  }, [formState, updateMutation]);

  const handleReset = useCallback(() => {
    resetMutation.mutate(undefined, {
      onSuccess: (data) => {
        setFormState(data);
      },
    });
  }, [resetMutation]);

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [{ label: t('navigation:finance'), path: '/finance' }, { label: 'Settings' }],
    [t],
  );

  // --- Tab content wrapped in settings groups for the T7 template ---
  const settingsGroups = useMemo(
    () => [
      {
        key: 'tabs',
        labelKey: 'finance.settings.title',
        content: (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as FinanceSettingsTab)}
            className="w-full"
          >
            <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
              <TabsTrigger value="general" className="gap-1.5">
                <Settings className="size-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="vat" className="gap-1.5">
                <Receipt className="size-3.5" />
                VAT
              </TabsTrigger>
              <TabsTrigger value="subSystems" className="gap-1.5">
                <Layers className="size-3.5" />
                Sub-Systems
              </TabsTrigger>
              <TabsTrigger value="tags" className="gap-1.5">
                <Tags className="size-3.5" />
                Tags
              </TabsTrigger>
              <TabsTrigger value="dataEntry" className="gap-1.5">
                <FileText className="size-3.5" />
                Data Entry
              </TabsTrigger>
              <TabsTrigger value="reconciliation" className="gap-1.5">
                <Calculator className="size-3.5" />
                Reconciliation
              </TabsTrigger>
              <TabsTrigger value="multiCurrency" className="gap-1.5">
                <Globe className="size-3.5" />
                Multi-Currency
              </TabsTrigger>
              <TabsTrigger value="reporting" className="gap-1.5">
                <Coins className="size-3.5" />
                Reporting
              </TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general">
              <GeneralTabContent settings={formState.general} onUpdate={updateGeneral} />
            </TabsContent>

            {/* VAT Tab */}
            <TabsContent value="vat">
              <VatTabContent settings={formState.vat} onUpdate={updateVat} />
            </TabsContent>

            {/* Sub-Systems Tab */}
            <TabsContent value="subSystems">
              <SubSystemsTabContent settings={formState.subSystems} onUpdate={updateSubSystems} />
            </TabsContent>

            {/* Tags Tab */}
            <TabsContent value="tags">
              <TagsTabContent settings={formState.tags} onUpdate={updateTags} />
            </TabsContent>

            {/* Data Entry Tab */}
            <TabsContent value="dataEntry">
              <DataEntryTabContent settings={formState.dataEntry} onUpdate={updateDataEntry} />
            </TabsContent>

            {/* Reconciliation Tab */}
            <TabsContent value="reconciliation">
              <ReconciliationTabContent
                settings={formState.reconciliation}
                onUpdate={updateReconciliation}
              />
            </TabsContent>

            {/* Multi-Currency Tab */}
            <TabsContent value="multiCurrency">
              <MultiCurrencyTabContent
                settings={formState.multiCurrency}
                onUpdate={updateMultiCurrency}
              />
            </TabsContent>

            {/* Reporting Tab */}
            <TabsContent value="reporting">
              <ReportingTabContent settings={formState.reporting} onUpdate={updateReporting} />
            </TabsContent>
          </Tabs>
        ),
      },
    ],
    [
      activeTab,
      formState,
      updateGeneral,
      updateVat,
      updateSubSystems,
      updateTags,
      updateDataEntry,
      updateReconciliation,
      updateMultiCurrency,
      updateReporting,
    ],
  );

  return (
    <SettingsPage
      title="Finance Settings"
      subtitle="Configure your finance module preferences"
      breadcrumbs={breadcrumbs}
      isLoading={isLoading}
      groups={settingsGroups}
      isDirty={isDirty}
      onSave={handleSave}
      onReset={handleReset}
    />
  );
}

// ===========================================================================
// Tab Content Components
// ===========================================================================

// ---------------------------------------------------------------------------
// Shared styling helpers
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function TabSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#7c3aed]">{icon}</span>
        <div>
          <h3 className="text-base font-semibold font-[family-name:var(--font-heading,'Plus_Jakarta_Sans',sans-serif)]">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------

function GeneralTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['general'];
  onUpdate: (patch: Partial<FinanceSettings['general']>) => void;
}) {
  return (
    <TabSection
      icon={<Building2 className="size-5" />}
      title="General Settings"
      description="Core financial configuration for your company"
    >
      <SettingRow
        label="Fiscal Year Start Month"
        description="The month your financial year begins"
      >
        <Select
          value={String(settings.fiscalYearStartMonth)}
          onValueChange={(v) => onUpdate({ fiscalYearStartMonth: Number(v) })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="Base Currency" description="Primary currency for all financial reporting">
        <Input
          className="w-24 text-center font-mono"
          value={settings.baseCurrency}
          onChange={(e) => onUpdate({ baseCurrency: e.target.value.toUpperCase().slice(0, 3) })}
          maxLength={3}
        />
      </SettingRow>

      <SettingRow
        label="Default Payment Terms (days)"
        description="Default number of days for invoice payment"
      >
        <Input
          className="w-24 text-center font-mono"
          type="number"
          min={0}
          max={365}
          value={settings.defaultPaymentTerms}
          onChange={(e) => onUpdate({ defaultPaymentTerms: Number(e.target.value) })}
        />
      </SettingRow>

      <SettingRow
        label="Retained Earnings Account"
        description="GL account code for retained earnings"
      >
        <Input
          className="w-40 font-mono"
          value={settings.retainedEarningsAccount ?? ''}
          onChange={(e) => onUpdate({ retainedEarningsAccount: e.target.value || undefined })}
          placeholder="e.g. 3100"
        />
      </SettingRow>
    </TabSection>
  );
}

// ---------------------------------------------------------------------------
// VAT Tab
// ---------------------------------------------------------------------------

function VatTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['vat'];
  onUpdate: (patch: Partial<FinanceSettings['vat']>) => void;
}) {
  return (
    <TabSection
      icon={<Receipt className="size-5" />}
      title="VAT Configuration"
      description="Value Added Tax scheme and HMRC integration"
    >
      <SettingRow label="VAT Scheme" description="Choose Standard, Flat Rate, or None">
        <Select
          value={settings.vatScheme}
          onValueChange={(v) => onUpdate({ vatScheme: v as 'STANDARD' | 'FLAT_RATE' | 'NONE' })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STANDARD">Standard</SelectItem>
            <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
            <SelectItem value="NONE">None</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="VAT Registration Number" description="Your HMRC VAT registration number">
        <Input
          className="w-48 font-mono"
          value={settings.vatRegistrationNumber ?? ''}
          onChange={(e) => onUpdate({ vatRegistrationNumber: e.target.value || undefined })}
          placeholder="GB 123 4567 89"
        />
      </SettingRow>

      <SettingRow
        label="Making Tax Digital (MTD)"
        description="Enable HMRC MTD integration for VAT returns"
      >
        <Switch
          checked={settings.mtdEnabled}
          onCheckedChange={(checked) => onUpdate({ mtdEnabled: checked })}
        />
      </SettingRow>

      {settings.vatScheme === 'FLAT_RATE' && (
        <SettingRow
          label="Flat Rate Percentage"
          description="Your HMRC-approved flat rate percentage"
        >
          <Input
            className="w-24 text-center font-mono"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={settings.flatRatePercentage ?? ''}
            onChange={(e) =>
              onUpdate({
                flatRatePercentage: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="%"
          />
        </SettingRow>
      )}
    </TabSection>
  );
}

// ---------------------------------------------------------------------------
// Sub-Systems Tab
// ---------------------------------------------------------------------------

function SubSystemsTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['subSystems'];
  onUpdate: (patch: Partial<FinanceSettings['subSystems']>) => void;
}) {
  return (
    <TabSection
      icon={<Layers className="size-5" />}
      title="Sub-System Integration"
      description="Enable or disable integration with other ERP modules"
    >
      <SettingRow
        label="Accounts Receivable (AR)"
        description="Enable customer invoicing and receipts"
      >
        <Switch
          checked={settings.arEnabled}
          onCheckedChange={(checked) => onUpdate({ arEnabled: checked })}
        />
      </SettingRow>

      <SettingRow label="Accounts Payable (AP)" description="Enable supplier bills and payments">
        <Switch
          checked={settings.apEnabled}
          onCheckedChange={(checked) => onUpdate({ apEnabled: checked })}
        />
      </SettingRow>

      <SettingRow
        label="Stock / Inventory"
        description="Enable inventory tracking and stock valuation"
      >
        <Switch
          checked={settings.stockEnabled}
          onCheckedChange={(checked) => onUpdate({ stockEnabled: checked })}
        />
      </SettingRow>

      <SettingRow label="Payroll" description="Enable payroll journal integration">
        <Switch
          checked={settings.payrollEnabled}
          onCheckedChange={(checked) => onUpdate({ payrollEnabled: checked })}
        />
      </SettingRow>
    </TabSection>
  );
}

// ---------------------------------------------------------------------------
// Tags Tab
// ---------------------------------------------------------------------------

function TagsTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['tags'];
  onUpdate: (patch: Partial<FinanceSettings['tags']>) => void;
}) {
  return (
    <TabSection
      icon={<Tags className="size-5" />}
      title="Tagging & Dimensions"
      description="Enable additional tagging dimensions for financial analysis"
    >
      <SettingRow label="Departments" description="Tag transactions with department codes">
        <Switch
          checked={settings.enableDepartments}
          onCheckedChange={(checked) => onUpdate({ enableDepartments: checked })}
        />
      </SettingRow>

      <SettingRow label="Cost Centres" description="Tag transactions with cost centre codes">
        <Switch
          checked={settings.enableCostCentres}
          onCheckedChange={(checked) => onUpdate({ enableCostCentres: checked })}
        />
      </SettingRow>

      <SettingRow label="Projects" description="Tag transactions with project codes">
        <Switch
          checked={settings.enableProjects}
          onCheckedChange={(checked) => onUpdate({ enableProjects: checked })}
        />
      </SettingRow>
    </TabSection>
  );
}

// ---------------------------------------------------------------------------
// Data Entry Tab
// ---------------------------------------------------------------------------

function DataEntryTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['dataEntry'];
  onUpdate: (patch: Partial<FinanceSettings['dataEntry']>) => void;
}) {
  return (
    <TabSection
      icon={<FileText className="size-5" />}
      title="Data Entry Defaults"
      description="Configure default behaviour for journal entry and transaction input"
    >
      <SettingRow
        label="Require Description"
        description="Require a description on every journal entry line"
      >
        <Switch
          checked={settings.requireDescription}
          onCheckedChange={(checked) => onUpdate({ requireDescription: checked })}
        />
      </SettingRow>

      <SettingRow
        label="Auto-populate VAT"
        description="Automatically calculate VAT based on account VAT code"
      >
        <Switch
          checked={settings.autoPopulateVat}
          onCheckedChange={(checked) => onUpdate({ autoPopulateVat: checked })}
        />
      </SettingRow>

      <SettingRow label="Default Source" description="Default data source for new journal entries">
        <Select
          value={settings.defaultSource}
          onValueChange={(v) => onUpdate({ defaultSource: v as 'MANUAL' | 'IMPORT' | 'API' })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="IMPORT">Import</SelectItem>
            <SelectItem value="API">API</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        label="Warn on Unbalanced"
        description="Show a warning when journal entries do not balance"
      >
        <Switch
          checked={settings.warnUnbalanced}
          onCheckedChange={(checked) => onUpdate({ warnUnbalanced: checked })}
        />
      </SettingRow>
    </TabSection>
  );
}

// ---------------------------------------------------------------------------
// Reconciliation Tab
// ---------------------------------------------------------------------------

function ReconciliationTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['reconciliation'];
  onUpdate: (patch: Partial<FinanceSettings['reconciliation']>) => void;
}) {
  return (
    <TabSection
      icon={<Calculator className="size-5" />}
      title="Bank Reconciliation"
      description="Configure automatic matching thresholds for bank reconciliation"
    >
      <SettingRow
        label="Auto-Match Enabled"
        description="Automatically match bank transactions to journal entries"
      >
        <Switch
          checked={settings.autoMatchEnabled}
          onCheckedChange={(checked) => onUpdate({ autoMatchEnabled: checked })}
        />
      </SettingRow>

      {settings.autoMatchEnabled && (
        <>
          <SettingRow
            label="Auto-Match Threshold"
            description={`Confidence level for auto-matching: ${settings.autoMatchThreshold}%`}
          >
            <div className="flex items-center gap-3 w-48">
              <Slider
                min={50}
                max={100}
                step={1}
                value={[settings.autoMatchThreshold]}
                onValueChange={([v]) => onUpdate({ autoMatchThreshold: v })}
              />
              <span className="text-sm font-mono w-10 text-right">
                {settings.autoMatchThreshold}%
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label="Suggest Threshold"
            description={`Confidence level for suggested matches: ${settings.suggestThreshold}%`}
          >
            <div className="flex items-center gap-3 w-48">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[settings.suggestThreshold]}
                onValueChange={([v]) => onUpdate({ suggestThreshold: v })}
              />
              <span className="text-sm font-mono w-10 text-right">
                {settings.suggestThreshold}%
              </span>
            </div>
          </SettingRow>
        </>
      )}
    </TabSection>
  );
}

// ---------------------------------------------------------------------------
// Multi-Currency Tab
// ---------------------------------------------------------------------------

function MultiCurrencyTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['multiCurrency'];
  onUpdate: (patch: Partial<FinanceSettings['multiCurrency']>) => void;
}) {
  return (
    <TabSection
      icon={<Globe className="size-5" />}
      title="Multi-Currency"
      description="Enable and configure foreign currency handling"
    >
      <SettingRow
        label="Multi-Currency Enabled"
        description="Enable transactions in foreign currencies"
      >
        <Switch
          checked={settings.multiCurrencyEnabled}
          onCheckedChange={(checked) => onUpdate({ multiCurrencyEnabled: checked })}
        />
      </SettingRow>

      {settings.multiCurrencyEnabled && (
        <>
          <SettingRow
            label="Auto-Fetch Rates"
            description="Automatically fetch exchange rates daily"
          >
            <Switch
              checked={settings.autoFetchRates}
              onCheckedChange={(checked) => onUpdate({ autoFetchRates: checked })}
            />
          </SettingRow>

          <SettingRow label="Rate Source" description="Source for exchange rate data">
            <Select
              value={settings.rateSource}
              onValueChange={(v) => onUpdate({ rateSource: v as 'BOE' | 'ECB' | 'MANUAL' })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOE">Bank of England</SelectItem>
                <SelectItem value="ECB">European Central Bank</SelectItem>
                <SelectItem value="MANUAL">Manual Entry</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}
    </TabSection>
  );
}

// ---------------------------------------------------------------------------
// Reporting Tab
// ---------------------------------------------------------------------------

function ReportingTabContent({
  settings,
  onUpdate,
}: {
  settings: FinanceSettings['reporting'];
  onUpdate: (patch: Partial<FinanceSettings['reporting']>) => void;
}) {
  return (
    <TabSection
      icon={<Coins className="size-5" />}
      title="Reporting Preferences"
      description="Configure default output format and display options for financial reports"
    >
      <SettingRow
        label="Default Report Format"
        description="Default export format for financial reports"
      >
        <Select
          value={settings.defaultReportFormat}
          onValueChange={(v) => onUpdate({ defaultReportFormat: v as 'PDF' | 'EXCEL' | 'CSV' })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="EXCEL">Excel</SelectItem>
            <SelectItem value="CSV">CSV</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        label="Include Zero Balances"
        description="Show accounts with zero balance in reports"
      >
        <Switch
          checked={settings.includeZeroBalances}
          onCheckedChange={(checked) => onUpdate({ includeZeroBalances: checked })}
        />
      </SettingRow>

      <SettingRow
        label="Show Account Codes"
        description="Display account codes alongside account names in reports"
      >
        <Switch
          checked={settings.showAccountCodes}
          onCheckedChange={(checked) => onUpdate({ showAccountCodes: checked })}
        />
      </SettingRow>
    </TabSection>
  );
}
