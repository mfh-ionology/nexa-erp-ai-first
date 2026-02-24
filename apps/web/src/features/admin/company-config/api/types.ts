// --- Response Types ---

export interface ExportDefaultsResponse {
  version: string;
  description: string;
  exportedAt: string;
  exportedFrom: string;
  resources: Array<{
    code: string;
    name: string;
    module: string;
    type: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
    sortOrder: number;
  }>;
  accessGroups: Array<{
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    permissions: Array<{
      resourceCode: string;
      canAccess: boolean;
      canNew: boolean;
      canView: boolean;
      canEdit: boolean;
      canDelete: boolean;
    }>;
    fieldOverrides: Array<{
      resourceCode: string;
      fieldPath: string;
      visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
    }>;
  }>;
  vatCodes: Array<{ code: string; name: string; rate: number; type: string; isDefault: boolean }>;
  paymentTerms: Array<{ code: string; name: string; dueDays: number; isDefault: boolean }>;
  numberSeries: Array<{ entityType: string; prefix: string; padding: number }>;
  currencies: Array<{ code: string; name: string; symbol: string; minorUnit: number }>;
}

// --- Request Types ---

export interface ImportDefaultsRequest {
  data: ExportDefaultsResponse;
  dryRun?: boolean;
}

// --- Import Response Types ---

export interface ImportDefaultsResponse {
  status: 'APPLIED' | 'DRY_RUN';
  summary: {
    resourcesCreated: number;
    resourcesUpdated: number;
    accessGroupsCreated: number;
    accessGroupsUpdated: number;
    permissionsSet: number;
    fieldOverridesSet: number;
    vatCodesCreated: number;
    vatCodesUpdated: number;
    paymentTermsCreated: number;
    paymentTermsUpdated: number;
    numberSeriesCreated: number;
    numberSeriesUpdated: number;
    currenciesCreated: number;
    currenciesUpdated: number;
  };
  warnings: string[];
}
