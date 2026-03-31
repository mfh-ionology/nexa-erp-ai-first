// ---------------------------------------------------------------------------
// HMRC Making Tax Digital — Stub Client
// ---------------------------------------------------------------------------
// In production this would call the HMRC MTD API to submit VAT returns.
// For MVP, this is a deterministic stub that simulates success/failure.
// ---------------------------------------------------------------------------

export interface VatReturnData {
  periodStart: Date;
  periodEnd: Date;
  box1: number;
  box2: number;
  box3: number;
  box4: number;
  box5: number;
  box6: number;
  box7: number;
  box8: number;
  box9: number;
}

export interface HmrcSubmissionResult {
  success: boolean;
  submissionId?: string;
  error?: string;
}

/**
 * Submit a VAT return to HMRC MTD.
 *
 * STUB: Always returns success with a generated submission ID.
 * Replace with real HMRC MTD API integration when ready for production.
 */
export async function submitVatReturn(_vatReturn: VatReturnData): Promise<HmrcSubmissionResult> {
  // STUB: In production, this calls HMRC MTD API
  // For now, simulate success with a deterministic submission ID
  return {
    success: true,
    submissionId: `HMRC-${Date.now()}`,
  };
}
