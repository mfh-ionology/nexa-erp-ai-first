/**
 * VAT Returns API client functions.
 *
 * Endpoints:
 *   GET    /finance/vat-returns           — list VAT returns
 *   POST   /finance/vat-returns           — create VAT return
 *   GET    /finance/vat-returns/:id       — get VAT return detail
 *   POST   /finance/vat-returns/:id/calculate — calculate VAT figures
 *   POST   /finance/vat-returns/:id/submit    — submit to HMRC
 */

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';

import type {
  VatReturn,
  VatReturnListResponse,
  VatReturnListParams,
  CreateVatReturnInput,
} from '../types';

export async function listVatReturns(
  params: VatReturnListParams = {},
): Promise<VatReturnListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<VatReturnListResponse>(`/finance/vat-returns${qs}`);
  return result.data;
}

export async function getVatReturn(id: string): Promise<VatReturn> {
  const result = await apiGet<VatReturn>(`/finance/vat-returns/${encodeURIComponent(id)}`);
  return result.data;
}

export async function createVatReturn(input: CreateVatReturnInput): Promise<VatReturn> {
  const result = await apiPost<VatReturn>('/finance/vat-returns', input);
  return result.data;
}

export async function calculateVatReturn(id: string): Promise<VatReturn> {
  const result = await apiPost<VatReturn>(
    `/finance/vat-returns/${encodeURIComponent(id)}/calculate`,
  );
  return result.data;
}

export async function submitVatReturn(id: string): Promise<VatReturn> {
  const result = await apiPost<VatReturn>(`/finance/vat-returns/${encodeURIComponent(id)}/submit`);
  return result.data;
}
