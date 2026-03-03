/**
 * TypeScript interfaces for the AI Admin API.
 *
 * Matches the response schemas defined in apps/api/src/ai/admin/admin.schemas.ts
 * and the API contract from E5c-3.
 */

// ─── Prompt category enum ──────────────────────────────────────────────────

export type PromptCategory =
  | 'record-creation'
  | 'query'
  | 'analysis'
  | 'briefing'
  | 'skill'
  | 'chat'
  | 'automation';

// ─── Model types ────────────────────────────────────────────────────────────

export interface AiModelListItem {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  displayName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  costPerMInput: string;
  costPerMOutput: string;
  routingTags: string[];
  capabilities: unknown;
  isActive: boolean;
  isDefault: boolean;
  fallbackModelId: string | null;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelDetail extends AiModelListItem {
  fallbackModel: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  config: unknown;
}

// ─── Model request types ────────────────────────────────────────────────────

export interface CreateAiModelRequest {
  name: string;
  provider: string;
  modelId: string;
  displayName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  costPerMInput: string;
  costPerMOutput: string;
  capabilities?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  config?: Record<string, unknown>;
  fallbackModelId?: string;
  routingTags?: string[];
}

export interface UpdateAiModelRequest {
  name?: string;
  provider?: string;
  modelId?: string;
  displayName?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  costPerMInput?: string;
  costPerMOutput?: string;
  capabilities?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  config?: Record<string, unknown> | null;
  fallbackModelId?: string | null;
  routingTags?: string[];
}

// ─── Model list params ──────────────────────────────────────────────────────

export interface AiModelListParams {
  cursor?: string;
  limit?: number;
  isActive?: boolean;
  provider?: string;
  search?: string;
}

// ─── Model list response ────────────────────────────────────────────────────

interface AiModelListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface AiModelListResponse {
  data: AiModelListItem[];
  meta: AiModelListMeta;
}

// ─── Prompt types ───────────────────────────────────────────────────────────

export interface AiPromptListItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  activeVersion: number;
  isActive: boolean;
  variableCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiPromptVariable {
  id: string;
  variableName: string;
  displayName: string;
  sourceType: string;
}

export interface AiPromptDetail extends AiPromptListItem {
  systemPrompt: string;
  userTemplate: string;
  parameters: unknown;
  outputFormat: unknown;
  variables: AiPromptVariable[];
  versionCount: number;
}

// ─── Prompt request types ───────────────────────────────────────────────────

export interface CreateAiPromptRequest {
  name: string;
  description?: string;
  category: PromptCategory;
  systemPrompt: string;
  userTemplate: string;
  parameters?: unknown;
  outputFormat?: unknown;
  isActive?: boolean;
}

export interface UpdateAiPromptRequest {
  name?: string;
  description?: string | null;
  category?: PromptCategory;
  systemPrompt?: string;
  userTemplate?: string;
  parameters?: unknown;
  outputFormat?: unknown;
  isActive?: boolean;
  changeReason: string;
}

// ─── Prompt list params ─────────────────────────────────────────────────────

export interface AiPromptListParams {
  cursor?: string;
  limit?: number;
  category?: PromptCategory;
  isActive?: boolean;
  search?: string;
}

// ─── Prompt list response ───────────────────────────────────────────────────

interface AiPromptListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface AiPromptListResponse {
  data: AiPromptListItem[];
  meta: AiPromptListMeta;
}

// ─── Prompt version types ───────────────────────────────────────────────────

export interface AiPromptVersionItem {
  id: string;
  promptId: string;
  version: number;
  changeReason: string | null;
  createdBy: string;
  createdAt: string;
  snippet: string;
}

export interface AiPromptVersionDetail extends AiPromptVersionItem {
  systemPrompt: string;
  userTemplate: string;
  parameters: unknown;
}

// ─── Test render types ──────────────────────────────────────────────────────

export interface TestRenderRequest {
  sampleVariables?: Record<string, string>;
  entityId?: string;
  entityType?: string;
}

export interface TestRenderResult {
  systemPrompt: string;
  userTemplate: string;
  resolvedVariables: Record<string, string>;
  unresolvedCount: number;
}

// ─── Dashboard types ────────────────────────────────────────────────────────

export interface DashboardSummary {
  activeModels: {
    count: number;
    monthlyCost: string;
  };
  activeAgents: {
    count: number;
  };
  activeSkills: {
    byModule: Record<string, number>;
    total: number;
  };
  automations: {
    active: number;
    paused: number;
  };
  dailyTokenUsage: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: string;
  }>;
}

export interface DashboardParams {
  days?: number;
}
