import { Circle, CircleDot, CheckCircle2, XCircle } from 'lucide-react';
import type { TaskStatus } from '../types';

const statusIconMap: Record<TaskStatus, { icon: typeof Circle; color: string }> = {
  OPEN: { icon: Circle, color: '#9ca3af' },
  IN_PROGRESS: { icon: CircleDot, color: '#3b82f6' },
  COMPLETED: { icon: CheckCircle2, color: '#10b981' },
  CANCELLED: { icon: XCircle, color: '#9ca3af' },
};

interface TaskStatusIconProps {
  status: TaskStatus;
  onClick?: () => void;
  overdue?: boolean;
  className?: string;
}

export function TaskStatusIcon({ status, onClick, overdue, className = '' }: TaskStatusIconProps) {
  const { icon: Icon, color } = statusIconMap[status];
  const effectiveColor =
    overdue && (status === 'OPEN' || status === 'IN_PROGRESS') ? '#ef4444' : color;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'COMPLETED' || status === 'CANCELLED'}
      className={`shrink-0 transition-transform hover:scale-110 disabled:cursor-default disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30 rounded ${className}`}
      aria-label={`Task status: ${status.replace('_', ' ').toLowerCase()}`}
    >
      <Icon className="h-4.5 w-4.5" style={{ color: effectiveColor }} />
    </button>
  );
}
