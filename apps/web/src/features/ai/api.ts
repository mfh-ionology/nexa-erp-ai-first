/**
 * API client functions for the AI feature module.
 *
 * Memory endpoints: GET/PATCH/DELETE /ai/memories, POST /ai/memories/forget-all
 * Memory settings: GET/PATCH /ai/memories/settings
 * Skills endpoints: GET /ai/skills
 * Skill overrides: PUT/DELETE /ai/skill-overrides/:skillId
 */

import { apiGet, apiPatch, apiDelete, apiPost, apiPut, buildQueryString } from '@/lib/api-client';

import type { EntityTrigger, EntitySearchResult } from './entity-mentions/types';
import type { Memory, MemoryListResponse, MemorySettings } from './memory/types';
import type { Skill, SkillOverride } from './skills/types';

// --- Memory API ---

export async function getMemories(): Promise<MemoryListResponse> {
  const result = await apiGet<Memory[]>('/ai/memories');
  return {
    memories: result.data,
    cursor: result.meta?.cursor ?? null,
    total: result.meta?.total ?? result.data.length,
  };
}

export async function updateMemory(id: string, content: string): Promise<Memory> {
  const result = await apiPatch<Memory>(`/ai/memories/${id}`, { content });
  return result.data;
}

export async function deleteMemory(id: string): Promise<void> {
  await apiDelete(`/ai/memories/${id}`);
}

export async function forgetAllMemories(): Promise<void> {
  await apiPost('/ai/memories/forget-all');
}

export async function getMemorySettings(): Promise<MemorySettings> {
  const result = await apiGet<MemorySettings>('/ai/memories/settings');
  return result.data;
}

export async function updateMemorySettings(
  patch: Partial<MemorySettings>,
): Promise<MemorySettings> {
  const result = await apiPatch<MemorySettings>('/ai/memories/settings', patch);
  return result.data;
}

// --- Skills API ---

export async function getSkills(moduleKey?: string): Promise<Skill[]> {
  const qs = buildQueryString({ moduleKey });
  const result = await apiGet<Skill[]>(`/ai/skills${qs}`);
  return result.data;
}

export interface SkillOverrideInput {
  isActive?: boolean | null;
  triggerPhrasesOverride?: string[];
  priorityOverride?: number | null;
}

export async function upsertSkillOverride(
  skillId: string,
  input: SkillOverrideInput,
): Promise<SkillOverride> {
  const result = await apiPut<SkillOverride>(`/ai/skill-overrides/${skillId}`, input);
  return result.data;
}

export async function deleteSkillOverride(skillId: string): Promise<void> {
  await apiDelete(`/ai/skill-overrides/${skillId}`);
}

// --- Entity Triggers & Search API ---

export async function getEntityTriggers(): Promise<EntityTrigger[]> {
  const qs = buildQueryString({ isActive: true });
  const result = await apiGet<EntityTrigger[]>(`/ai/entity-triggers${qs}`);
  return result.data;
}

export async function searchEntities(params: {
  type?: string;
  q: string;
  scopeBy?: string;
  scopeValue?: string;
}): Promise<EntitySearchResult[]> {
  const qs = buildQueryString(params);
  const result = await apiGet<EntitySearchResult[]>(`/ai/entity-search${qs}`);
  return result.data;
}
