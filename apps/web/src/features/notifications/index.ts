// Notifications feature barrel exports

// Provider
export { NotificationProvider } from './notification-provider';

// Components
export { NotificationBell } from './components/notification-bell';
export { NotificationDropdown } from './components/notification-dropdown';

// Hooks
export { useNotifications } from './api/use-notifications';
export { useUnreadCount } from './api/use-unread-count';
export {
  useMarkAsRead,
  useDismissNotification,
  useMarkAllAsRead,
} from './api/use-notification-actions';

// Preferences
export { useNotificationPreferences } from './api/use-notification-preferences';
export { useUpdateNotificationPreferences } from './api/use-update-notification-preferences';
export { useResetNotificationPreferences } from './api/use-reset-notification-preferences';
export { useRoleDefaults, useUpdateRoleDefaults } from './api/use-role-defaults';
export { NotificationPreferencesPage } from './preferences/notification-preferences-page';
export { RoleDefaultsSection } from './preferences/role-defaults-section';
