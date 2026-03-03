export interface Memory {
  id: string;
  userId: string;
  companyId: string;
  category: MemoryCategory;
  content: string;
  source: MemorySource;
  importance: number;
  lastAccessedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type MemoryCategory =
  | 'PREFERENCE'
  | 'WORKFLOW'
  | 'ENTITY_CONTEXT'
  | 'DECISION'
  | 'INSTRUCTION';

export type MemorySource = 'EXPLICIT' | 'IMPLICIT';

export interface MemorySettings {
  userId: string;
  companyId: string;
  isEnabled: boolean;
  enabledCategories: MemoryCategory[];
  retentionDays: number;
  maxMemories: number;
  decayHalfLifeDays: number;
}

export interface MemoryListResponse {
  memories: Memory[];
  cursor: string | null;
  total: number;
}
