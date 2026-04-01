/**
 * React Query hooks for enhanced finance reports.
 *
 * - useGlDetail: single account activity with running balance
 * - useGeneralLedger: multi-account general ledger
 * - useDepartmentalPnl: P&L with dimension columns
 */

import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';

import { getGlDetail, getGeneralLedger, getDepartmentalPnl } from '../api/reports-enhanced-api';
import type {
  GlDetailParams,
  GlDetailReport,
  GeneralLedgerParams,
  GeneralLedgerReport,
  DepartmentalPnlParams,
  DepartmentalPnlReport,
} from '../api/reports-enhanced-api';

export function useGlDetail(params: GlDetailParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<GlDetailReport>({
    queryKey: ['finance', 'gl-detail', params],
    queryFn: () => getGlDetail(params!),
    enabled: isAuthenticated && !!params,
  });
}

export function useGeneralLedger(params: GeneralLedgerParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<GeneralLedgerReport>({
    queryKey: ['finance', 'general-ledger', params],
    queryFn: () => getGeneralLedger(params!),
    enabled: isAuthenticated && !!params,
  });
}

export function useDepartmentalPnl(params: DepartmentalPnlParams | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<DepartmentalPnlReport>({
    queryKey: ['finance', 'departmental-pnl', params],
    queryFn: () => getDepartmentalPnl(params!),
    enabled: isAuthenticated && !!params,
  });
}
