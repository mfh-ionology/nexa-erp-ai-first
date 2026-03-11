import type { TaskAssignee } from '../types';

function getInitials(assignee: TaskAssignee): string {
  if (assignee.displayName) {
    return assignee.displayName
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (assignee.email) {
    return assignee.email.charAt(0).toUpperCase();
  }
  return '?';
}

function getDisplayName(assignee: TaskAssignee): string {
  return assignee.displayName ?? assignee.email ?? 'Unknown';
}

interface AssigneeAvatarsProps {
  assignees: TaskAssignee[];
  max?: number;
}

export function AssigneeAvatars({ assignees, max = 3 }: AssigneeAvatarsProps) {
  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-[#ede9fe] text-[9px] font-semibold text-[#5b21b6]"
          title={getDisplayName(a)}
        >
          {getInitials(a)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-[9px] font-semibold text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
