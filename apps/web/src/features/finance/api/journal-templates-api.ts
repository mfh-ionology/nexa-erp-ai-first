/**
 * Journal Templates API client functions.
 *
 * Endpoints:
 *   GET    /finance/templates           — list templates
 *   POST   /finance/templates           — create template
 *   GET    /finance/templates/:id       — get template detail
 *   PATCH  /finance/templates/:id       — update template
 *   DELETE /finance/templates/:id       — delete template
 *   POST   /finance/templates/:id/execute — execute template
 */

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';

import type {
  JournalTemplate,
  JournalTemplateListResponse,
  JournalTemplateListParams,
  CreateJournalTemplateInput,
  UpdateJournalTemplateInput,
} from '../types';

export async function listJournalTemplates(
  params: JournalTemplateListParams = {},
): Promise<JournalTemplateListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<JournalTemplateListResponse>(`/finance/templates${qs}`);
  return result.data;
}

export async function getJournalTemplate(id: string): Promise<JournalTemplate> {
  const result = await apiGet<JournalTemplate>(`/finance/templates/${encodeURIComponent(id)}`);
  return result.data;
}

export async function createJournalTemplate(
  input: CreateJournalTemplateInput,
): Promise<JournalTemplate> {
  const result = await apiPost<JournalTemplate>('/finance/templates', input);
  return result.data;
}

export async function updateJournalTemplate(
  id: string,
  input: UpdateJournalTemplateInput,
): Promise<JournalTemplate> {
  const result = await apiPatch<JournalTemplate>(
    `/finance/templates/${encodeURIComponent(id)}`,
    input,
  );
  return result.data;
}

export async function deleteJournalTemplate(id: string): Promise<void> {
  await apiDelete(`/finance/templates/${encodeURIComponent(id)}`);
}

export async function executeJournalTemplate(id: string): Promise<{ journalEntryId: string }> {
  const result = await apiPost<{ journalEntryId: string }>(
    `/finance/templates/${encodeURIComponent(id)}/execute`,
  );
  return result.data;
}
