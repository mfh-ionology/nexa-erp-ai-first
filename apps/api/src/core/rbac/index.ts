// Granular RBAC (E2b)
export { createPermissionGuard, type PermissionAction } from './permission.guard.js';
export { resolvePermissions, hasPermission, getFieldVisibility } from './permission.service.js';
export { permissionCache, type ResolvedPermissions } from './permission-cache.js';
export { filterFieldsByPermission } from './field-filter.hook.js';

// Legacy RBAC (E2) — kept for backward compatibility during migration
/** @deprecated Use createPermissionGuard instead */
export { createRbacGuard } from './rbac.guard.js';
export { ROLE_LEVEL, hasMinimumRole, type RbacGuardOptions } from './rbac.types.js';
