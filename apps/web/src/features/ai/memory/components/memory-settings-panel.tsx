import { useI18n } from '@nexa/i18n';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import type { MemoryCategory, MemorySettings } from '../types';

const CATEGORIES: { key: MemoryCategory; i18nKey: string }[] = [
  { key: 'PREFERENCE', i18nKey: 'memory.settings.preference' },
  { key: 'WORKFLOW', i18nKey: 'memory.settings.workflow' },
  { key: 'DECISION', i18nKey: 'memory.settings.decision' },
  { key: 'INSTRUCTION', i18nKey: 'memory.settings.instruction' },
  { key: 'ENTITY_CONTEXT', i18nKey: 'memory.settings.entityContext' },
];

const RETENTION_OPTIONS = [
  { value: '30', i18nKey: 'memory.settings.retentionDays', params: { days: '30' } },
  { value: '60', i18nKey: 'memory.settings.retentionDays', params: { days: '60' } },
  { value: '90', i18nKey: 'memory.settings.retentionDays', params: { days: '90' } },
  { value: '180', i18nKey: 'memory.settings.retentionDays', params: { days: '180' } },
  { value: '365', i18nKey: 'memory.settings.retentionDays', params: { days: '365' } },
  { value: '0', i18nKey: 'memory.settings.retentionNever', params: undefined },
];

interface MemorySettingsPanelProps {
  settings: MemorySettings;
  onUpdate: (patch: Partial<MemorySettings>) => void;
  onForgetAll: () => void;
}

export function MemorySettingsPanel({ settings, onUpdate, onForgetAll }: MemorySettingsPanelProps) {
  const { t } = useI18n('ai');

  const handleToggleEnabled = (checked: boolean) => {
    onUpdate({ isEnabled: checked });
  };

  const handleToggleCategory = (category: MemoryCategory) => {
    const current = settings.enabledCategories;
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    onUpdate({ enabledCategories: updated });
  };

  const handleRetentionChange = (value: string) => {
    onUpdate({ retentionDays: Number(value) });
  };

  const disabled = !settings.isEnabled;

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <h2 className="font-serif text-lg font-semibold text-foreground">
        {t('memory.settings.enableAiMemory')}
      </h2>

      {/* Enable toggle */}
      <div className="mt-4 flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium text-foreground">
            {t('memory.settings.enableAiMemory')}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('memory.settings.enableAiMemoryDesc')}
          </p>
        </div>
        <Switch
          checked={settings.isEnabled}
          onCheckedChange={handleToggleEnabled}
          className="data-[state=checked]:bg-[#7c3aed]"
          aria-label={t('memory.settings.enableAiMemory')}
        />
      </div>

      {/* Category checkboxes */}
      <div className="mt-5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('memory.settings.categories')}
        </Label>
        <div className="mt-2 flex flex-wrap gap-3">
          {CATEGORIES.map(({ key, i18nKey }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={settings.enabledCategories.includes(key)}
                onCheckedChange={() => handleToggleCategory(key)}
                disabled={disabled}
                className="border-border data-[state=checked]:border-[#7c3aed] data-[state=checked]:bg-[#7c3aed]"
                aria-label={t(i18nKey)}
              />
              {t(i18nKey)}
            </label>
          ))}
        </div>
      </div>

      {/* Retention selector */}
      <div className="mt-5 flex items-center gap-3">
        <Label className="shrink-0 text-sm text-foreground">{t('memory.settings.retention')}</Label>
        <Select
          value={String(settings.retentionDays)}
          onValueChange={handleRetentionChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-36 rounded-md" aria-label={t('memory.settings.retention')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETENTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.params ? t(opt.i18nKey, opt.params) : t(opt.i18nKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Forget Everything — danger zone */}
      <div className="mt-6 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[#991b1b]" />
          <div>
            <p className="text-sm font-medium text-[#991b1b]">{t('memory.settings.forgetAll')}</p>
            <p className="mt-0.5 text-xs text-[#991b1b]/70">{t('memory.forgetAllBody')}</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={onForgetAll}
              className="mt-3 rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c]"
              aria-label={t('memory.settings.forgetAll')}
            >
              {t('memory.settings.forgetAll')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
