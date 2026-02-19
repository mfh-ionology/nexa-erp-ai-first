import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ResourceDefault {
  code: string;
  name: string;
  module: string;
  type: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
  sortOrder: number;
  parentCode?: string;
  icon?: string;
  description?: string;
}

export interface PermissionDefault {
  resourceCode: string;
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface FieldOverrideDefault {
  resourceCode: string;
  fieldPath: string;
  visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
}

export interface AccessGroupDefault {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionDefault[];
  fieldOverrides: FieldOverrideDefault[];
}

export interface CompanyDefaults {
  version: string;
  description: string;
  resources: ResourceDefault[];
  accessGroups: AccessGroupDefault[];
  vatCodes: Array<{ code: string; name: string; rate: number; type: string; isDefault: boolean }>;
  paymentTerms: Array<{ code: string; name: string; dueDays: number; isDefault: boolean }>;
  numberSeries: Array<{ entityType: string; prefix: string; padding: number }>;
  currencies: Array<{ code: string; name: string; symbol: string; minorUnit: number }>;
}

/**
 * Load the company defaults JSON file from `packages/db/default-data/`.
 * @param filename — defaults to 'company-defaults.json'
 */
export function loadDefaultData(filename = 'company-defaults.json'): CompanyDefaults {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(currentDir, '../../default-data', filename);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CompanyDefaults;
}
