import { useI18n } from '@nexa/i18n';

import type { TaskPriority } from '../types';
import { PRIORITY_CONFIG } from '../types';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
}

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const { t } = useI18n();
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none uppercase"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: cfg.border ? `1px solid ${cfg.border}` : undefined,
      }}
    >
      {t(cfg.i18nKey)}
    </span>
  );
}
