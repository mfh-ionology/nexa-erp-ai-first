/**
 * Filter controls for the Resource Registry page.
 *
 * Provides Module and Type dropdowns that compose with AND logic.
 * All labels use i18n translation keys.
 */

import { useI18n } from '@nexa/i18n';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Static list of known modules (matches the architecture's fixed module set)
const MODULES = [
  'system',
  'finance',
  'ar',
  'ap',
  'sales',
  'purchasing',
  'inventory',
  'crm',
  'hr',
  'manufacturing',
  'reporting',
] as const;

// ResourceType enum values
const RESOURCE_TYPES = ['PAGE', 'REPORT', 'SETTING', 'MAINTENANCE'] as const;

// Map resource type to i18n key
const TYPE_I18N_MAP: Record<(typeof RESOURCE_TYPES)[number], string> = {
  PAGE: 'resources.type.page',
  REPORT: 'resources.type.report',
  SETTING: 'resources.type.setting',
  MAINTENANCE: 'resources.type.maintenance',
};

export interface ResourceFiltersProps {
  /** Currently selected module filter value (or empty string for all) */
  module: string;
  /** Module filter change handler */
  onModuleChange: (module: string) => void;
  /** Currently selected type filter value (or empty string for all) */
  type: string;
  /** Type filter change handler */
  onTypeChange: (type: string) => void;
}

export function ResourceFilters({
  module,
  onModuleChange,
  type,
  onTypeChange,
}: ResourceFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      {/* Module filter */}
      <Select
        value={module || '_all'}
        onValueChange={(value) => onModuleChange(value === '_all' ? '' : value)}
      >
        <SelectTrigger aria-label={t('resources.filter.module')}>
          <SelectValue placeholder={t('resources.filter.allModules')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t('resources.filter.allModules')}</SelectItem>
          {MODULES.map((mod) => (
            <SelectItem key={mod} value={mod}>
              {t(`navigation:${mod}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type filter */}
      <Select
        value={type || '_all'}
        onValueChange={(value) => onTypeChange(value === '_all' ? '' : value)}
      >
        <SelectTrigger aria-label={t('resources.filter.type')}>
          <SelectValue placeholder={t('resources.filter.allTypes')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t('resources.filter.allTypes')}</SelectItem>
          {RESOURCE_TYPES.map((rt) => (
            <SelectItem key={rt} value={rt}>
              {t(TYPE_I18N_MAP[rt])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
