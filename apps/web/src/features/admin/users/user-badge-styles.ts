import type { UserRole } from './api/types';

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN:
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  ADMIN:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  MANAGER:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  STAFF: 'bg-secondary text-secondary-foreground border-transparent',
  VIEWER: 'bg-muted text-muted-foreground border-transparent',
};

export const STATUS_BADGE_STYLES = {
  active:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  inactive: 'bg-muted text-muted-foreground border-transparent',
} as const;
