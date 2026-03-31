/**
 * Budgets API client functions.
 *
 * Endpoints:
 *   GET    /finance/budgets           — list budgets
 *   POST   /finance/budgets           — create budget
 *   GET    /finance/budgets/:id       — get budget detail
 *   PATCH  /finance/budgets/:id       — update budget
 *   POST   /finance/budgets/:id/approve — approve budget
 *   POST   /finance/budgets/:id/copy    — copy budget
 */

import { apiGet, apiPost, apiPatch, buildQueryString } from '@/lib/api-client';

import type {
  Budget,
  BudgetListResponse,
  BudgetListParams,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../types';

export async function listBudgets(params: BudgetListParams = {}): Promise<BudgetListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<BudgetListResponse>(`/finance/budgets${qs}`);
  return result.data;
}

export async function getBudget(id: string): Promise<Budget> {
  const result = await apiGet<Budget>(`/finance/budgets/${encodeURIComponent(id)}`);
  return result.data;
}

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const result = await apiPost<Budget>('/finance/budgets', input);
  return result.data;
}

export async function updateBudget(id: string, input: UpdateBudgetInput): Promise<Budget> {
  const result = await apiPatch<Budget>(`/finance/budgets/${encodeURIComponent(id)}`, input);
  return result.data;
}

export async function approveBudget(id: string): Promise<Budget> {
  const result = await apiPost<Budget>(`/finance/budgets/${encodeURIComponent(id)}/approve`);
  return result.data;
}

export async function copyBudget(id: string): Promise<Budget> {
  const result = await apiPost<Budget>(`/finance/budgets/${encodeURIComponent(id)}/copy`);
  return result.data;
}
