export type EntityType = string; // dynamic from DB, not hardcoded enum

export interface EntityTrigger {
  id: string;
  moduleKey: string;
  triggerWord: string;
  entityType: string;
  searchEndpoint: string;
  displayField: string;
  subtitleField: string | null;
  scopeBy: string | null;
  icon: string | null;
  priority: number;
}

export interface EntityMention {
  id: string;
  type: string;
  name: string;
  subtitle?: string;
}

export interface EntitySearchResult {
  id: string;
  displayName: string;
  subtitle: string | null;
  entityType: string;
}
