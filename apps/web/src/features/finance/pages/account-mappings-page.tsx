/* eslint-disable i18next/no-literal-string */
/**
 * FE5: Account Mappings Page — /finance/account-mappings
 *
 * Editable grid of 27 mapping types with GL account picker.
 * Uses T7 (SettingsPage) template with grouped sections by mapping category.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, DollarSign, Receipt, TrendingUp, Warehouse } from 'lucide-react';

import { SettingsPage } from '@/components/templates/settings-page';

import {
  useAccountMappings,
  useUpdateAccountMappings,
  useResetAccountMappings,
} from '../hooks/use-account-mappings';
import { GlAccountPicker } from '../components/gl-account-picker';
import type { AccountMapping, AccountListItem } from '../types';

// ---------------------------------------------------------------------------
// Category → Icon map
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'General Ledger': <BookOpen className="size-5" />,
  Revenue: <TrendingUp className="size-5" />,
  'Cost of Goods Sold': <DollarSign className="size-5" />,
  Expenses: <Receipt className="size-5" />,
  Inventory: <Warehouse className="size-5" />,
};

// ---------------------------------------------------------------------------
// Mapping Row Component
// ---------------------------------------------------------------------------

interface MappingRowProps {
  mapping: AccountMapping;
  localValue: string | null;
  onChangeLocal: (mappingType: string, accountId: string | null) => void;
}

function MappingRow({ mapping, localValue, onChangeLocal }: MappingRowProps) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium">{mapping.label}</p>
        <p className="text-xs text-muted-foreground">{mapping.description}</p>
      </div>
      <div className="sm:w-[360px]">
        <GlAccountPicker
          value={localValue}
          onChange={(accountId: string | null, _account: AccountListItem | null) => {
            onChangeLocal(mapping.mappingType, accountId);
          }}
          placeholder="Select GL account..."
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function AccountMappingsPage() {
  const { data: mappings, isLoading } = useAccountMappings();
  const updateMutation = useUpdateAccountMappings();
  const resetMutation = useResetAccountMappings();

  // Local state for unsaved edits
  const [localMappings, setLocalMappings] = useState<Record<string, string | null>>({});
  const [isInitialised, setIsInitialised] = useState(false);

  // Initialise local state from API data
  useEffect(() => {
    if (mappings && !isInitialised) {
      const initial: Record<string, string | null> = {};
      for (const m of mappings) {
        initial[m.mappingType] = m.accountId;
      }
      setLocalMappings(initial);
      setIsInitialised(true);
    }
  }, [mappings, isInitialised]);

  // Reset initialised flag when data changes externally (e.g. after reset)
  useEffect(() => {
    if (mappings && isInitialised) {
      const serverState: Record<string, string | null> = {};
      for (const m of mappings) {
        serverState[m.mappingType] = m.accountId;
      }
      setLocalMappings(serverState);
    }
    // Only re-sync when the actual data reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappings]);

  // Track dirty state
  const isDirty = useMemo(() => {
    if (!mappings) return false;
    return mappings.some((m) => localMappings[m.mappingType] !== m.accountId);
  }, [mappings, localMappings]);

  const handleChangeLocal = useCallback((mappingType: string, accountId: string | null) => {
    setLocalMappings((prev) => ({ ...prev, [mappingType]: accountId }));
  }, []);

  // Save handler
  const handleSave = useCallback(() => {
    if (!mappings) return;
    const changed = mappings.filter((m) => localMappings[m.mappingType] !== m.accountId);
    if (changed.length === 0) return;

    updateMutation.mutate({
      mappings: changed.map((m) => ({
        mappingType: m.mappingType,
        accountId: localMappings[m.mappingType] ?? null,
      })),
    });
  }, [mappings, localMappings, updateMutation]);

  // Reset handler
  const handleReset = useCallback(() => {
    resetMutation.mutate();
    setIsInitialised(false);
  }, [resetMutation]);

  // Group mappings by category
  const groupedMappings = useMemo(() => {
    if (!mappings) return new Map<string, AccountMapping[]>();
    const groups = new Map<string, AccountMapping[]>();
    for (const m of mappings) {
      const existing = groups.get(m.category) ?? [];
      existing.push(m);
      groups.set(m.category, existing);
    }
    return groups;
  }, [mappings]);

  // Build SettingsPage groups from categories
  const settingsGroups = useMemo(() => {
    return Array.from(groupedMappings.entries()).map(([category, categoryMappings]) => ({
      key: category,
      labelKey: category,
      descriptionKey: `Configure GL account mappings for ${category}`,
      icon: CATEGORY_ICONS[category] ?? <BookOpen className="size-5" />,
      isCollapsible: true,
      defaultOpen: true,
      content: (
        <div className="divide-y">
          {categoryMappings.map((mapping) => (
            <MappingRow
              key={mapping.mappingType}
              mapping={mapping}
              localValue={localMappings[mapping.mappingType] ?? null}
              onChangeLocal={handleChangeLocal}
            />
          ))}
        </div>
      ),
    }));
  }, [groupedMappings, localMappings, handleChangeLocal]);

  return (
    <SettingsPage
      title="Account Mappings"
      subtitle="Map system account types to your chart of accounts"
      breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Account Mappings' }]}
      isLoading={isLoading}
      groups={settingsGroups}
      isDirty={isDirty}
      onSave={handleSave}
      onReset={handleReset}
    />
  );
}
