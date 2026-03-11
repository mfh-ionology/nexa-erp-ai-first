import { AlertTriangle } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

interface TaskOverdueBadgeProps {
  days?: number;
}

export function TaskOverdueBadge({ days }: TaskOverdueBadgeProps) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 text-[#ef4444]">
      <AlertTriangle className="h-3 w-3" />
      <span className="text-xs font-semibold">
        {days ? t('tasks.overdueDays', { count: days }) : t('tasks.overdue')}
      </span>
    </span>
  );
}
