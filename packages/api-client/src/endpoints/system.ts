/**
 * System endpoint methods (API Contracts §2.2).
 */

import type { ApiClient } from '../client';

// --- Response types ---

export interface ModulePermission {
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * Wire format returned by GET /system/my-permissions.
 * The API uses `permissions` for the module map; consumer stores may normalise
 * this to a different key (e.g. `modules`).
 */
export interface ApiResolvedPermissions {
  userId: string;
  companyId: string;
  role: string;
  isSuperAdmin: boolean;
  accessGroups: Array<{ id: string; code: string; name: string }>;
  permissions: Record<string, ModulePermission>;
  fieldOverrides: Record<
    string,
    Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>
  >;
  enabledModules: string[];
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  baseCurrencyCode: string;
  isDefault: boolean;
}

// --- Endpoint interface ---

export interface SystemEndpoints {
  fetchMyPermissions(): Promise<ApiResolvedPermissions>;
  fetchCompanies(): Promise<Company[]>;
}

// --- Factory ---

export function createSystemEndpoints(client: ApiClient): SystemEndpoints {
  return {
    async fetchMyPermissions() {
      const { data } =
        await client.get<ApiResolvedPermissions>('/system/my-permissions');
      return data;
    },

    async fetchCompanies() {
      const { data } = await client.get<Company[]>('/system/companies');
      return data;
    },
  };
}
