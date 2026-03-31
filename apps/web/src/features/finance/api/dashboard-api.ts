/**
 * Finance Dashboard API client functions.
 *
 * Endpoints:
 *   GET /finance/dashboard — finance dashboard KPIs and activity
 */

import { apiGet } from '@/lib/api-client';

import type { FinanceDashboardData } from '../types';

export async function getFinanceDashboard(): Promise<FinanceDashboardData> {
  const result = await apiGet<FinanceDashboardData>('/finance/dashboard');
  return result.data;
}
