/**
 * Task feature — TypeScript types and constants.
 *
 * Mirrors backend Task/TaskAssignee models from E11.1 API endpoints.
 * Visual constants match the Concept D v0 reference.
 */

// ---------------------------------------------------------------------------
// Enums / Literal Types
// ---------------------------------------------------------------------------

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

// ---------------------------------------------------------------------------
// Entity Interfaces
// ---------------------------------------------------------------------------

export interface TaskAssignee {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
}

export interface Task {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  entityType: string | null;
  entityId: string | null;
  createdById: string;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  assignees: TaskAssignee[];
}

// ---------------------------------------------------------------------------
// API Request / Response Types
// ---------------------------------------------------------------------------

export interface TaskListResponse {
  items: Task[];
  total: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  entityType?: string;
  entityId?: string;
  assigneeIds?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface TaskListParams {
  status?: string;
  priority?: string;
  entityType?: string;
  entityId?: string;
  assigneeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// UI View Filter
// ---------------------------------------------------------------------------

export type ViewFilter = 'all' | 'open' | 'in_progress' | 'overdue';

// ---------------------------------------------------------------------------
// Visual Constants (Concept D)
// ---------------------------------------------------------------------------

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { i18nKey: string; color: string; bg: string; border?: string }
> = {
  URGENT: { i18nKey: 'tasks.priority.urgent', color: '#dc2626', bg: '#fee2e2' },
  HIGH: { i18nKey: 'tasks.priority.high', color: '#ef4444', bg: '#ffffff', border: '#fca5a5' },
  NORMAL: { i18nKey: 'tasks.priority.normal', color: '#d97706', bg: '#fef3c7' },
  LOW: { i18nKey: 'tasks.priority.low', color: '#3b82f6', bg: '#dbeafe' },
};

/** Maps TaskStatus to its i18n key under the `tasks` namespace. */
export const STATUS_I18N_KEYS: Record<TaskStatus, string> = {
  OPEN: 'tasks.status.open',
  IN_PROGRESS: 'tasks.status.inProgress',
  COMPLETED: 'tasks.status.completed',
  CANCELLED: 'tasks.status.cancelled',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Cycles task status: OPEN → IN_PROGRESS → COMPLETED.
 * Returns null for terminal states (COMPLETED, CANCELLED) — no-op.
 */
export function cycleStatus(current: TaskStatus): TaskStatus | null {
  switch (current) {
    case 'OPEN':
      return 'IN_PROGRESS';
    case 'IN_PROGRESS':
      return 'COMPLETED';
    case 'COMPLETED':
    case 'CANCELLED':
      return null;
  }
}
