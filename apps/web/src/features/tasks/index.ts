/**
 * Task feature module — barrel exports.
 *
 * Provides task management components, hooks, and types
 * for the My Tasks page and embedded TaskPanel on record detail pages.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  Task,
  TaskAssignee,
  TaskStatus,
  TaskPriority,
  TaskListResponse,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListParams,
  ViewFilter,
} from './types';

export { PRIORITY_CONFIG, STATUS_I18N_KEYS, cycleStatus } from './types';

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export { MyTasksPage } from './pages/MyTasksPage';

// ---------------------------------------------------------------------------
// Components (for embedding in other pages)
// ---------------------------------------------------------------------------

export { TaskPanel } from './components/TaskPanel';
export { TaskPanelItem } from './components/TaskPanelItem';
export { PanelDetailSheet } from './components/PanelDetailSheet';
