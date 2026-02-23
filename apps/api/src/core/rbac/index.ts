export { ROLE_LEVEL, hasMinimumRole, type RbacGuardOptions } from './rbac.types.js';
export { createRbacGuard } from './rbac.guard.js';

// E2b-4: Granular permission guard and service
export { createPermissionGuard } from './permission.guard.js';
export { PermissionService, permissionService, ACTION_FLAG_MAP } from './permission.service.js';
export { registerPermissionCacheListeners, resetPermissionCacheListeners } from './permission-cache-listeners.js';
export { filterFieldsByPermission } from './field-filter.hook.js';
export type {
  PermissionAction,
  ResourcePermission,
  FieldOverrides,
  EffectivePermissions,
  PermissionCacheEntry,
} from './permission.types.js';
