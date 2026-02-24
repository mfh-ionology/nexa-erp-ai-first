/**
 * TypeScript interfaces for the Access Group Management API.
 *
 * Matches the API contract from §3.12 Granular RBAC & Access Group Endpoints.
 */

export type FieldVisibility = 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';

// --- Response types ---

export interface AccessGroup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGroupDetail extends AccessGroup {
  companyId: string;
  permissions: AccessGroupPermission[];
  fieldOverrides: AccessGroupFieldOverride[];
  createdBy: string;
  updatedBy: string;
}

export interface AccessGroupPermission {
  resourceCode: string;
  resourceName: string;
  resourceModule: string;
  resourceType: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AccessGroupFieldOverride {
  resourceCode: string;
  resourceName: string;
  fieldPath: string;
  visibility: FieldVisibility;
}

// --- Request types ---

export interface CreateAccessGroupRequest {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateAccessGroupRequest {
  name?: string;
  description?: string | null;
}

export type SetPermissionsRequest = Array<{
  resourceCode: string;
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}>;

export interface SetFieldOverridesRequest {
  fieldOverrides: Array<{
    resourceCode: string;
    fieldPath: string;
    visibility: FieldVisibility;
  }>;
}

export interface SetFieldOverridesResponse {
  accessGroupId: string;
  overrideCount: number;
  fieldOverrides: AccessGroupFieldOverride[];
}

// --- List params ---

export interface AccessGroupListParams {
  cursor?: string;
  limit?: number;
  search?: string;
  isActive?: boolean;
  isSystem?: boolean;
}

// --- List response ---

interface AccessGroupListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface AccessGroupListResponse {
  data: AccessGroup[];
  meta: AccessGroupListMeta;
}
