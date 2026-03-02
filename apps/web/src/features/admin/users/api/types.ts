/**
 * TypeScript interfaces for the User Management API.
 *
 * Matches the API contract from §3.12 Granular RBAC & Access Group Endpoints.
 */

// --- Enums ---

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';

// --- Response types ---

export interface UserListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  accessGroupCount: number;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccessGroupAssignment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  assignedBy: string | null;
  assignedAt: string;
}

// --- Request types ---

export interface AssignAccessGroupsRequest {
  accessGroupIds: string[];
}

// --- List params ---

export interface UserListParams {
  cursor?: string;
  limit?: number;
  search?: string;
  isActive?: boolean;
  // E7.5: Generic filter condition support
  conditions?: string;
  filterLogic?: string;
  sortField?: string;
  sortDir?: string;
}

// --- List response ---

interface UserListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface UserListResponse {
  data: UserListItem[];
  meta: UserListMeta;
}

// --- Assign access groups response ---

export interface AssignAccessGroupsResponse {
  userId: string;
  companyId: string;
  accessGroups: Array<{
    id: string;
    code: string;
    name: string;
    assignedBy: string;
    assignedAt: string;
  }>;
}
