# Visual Checkpoint Manifest — Journey 12: Generate Cash Flow Forecast

## Checkpoint 1: Cash Flow Forecast Page Loaded
- **When**: After navigating to `/ai/predictions/cash-flow` and login
- **Screenshot file**: `step-1-cash-flow-page-loaded.png`
- **What to look for**:
  - Cash flow forecast page visible with a configuration form
  - Form fields: Start Date (date picker), End Date (date picker)
  - Optional Bank Account filter (multi-select dropdown)
  - 'Include Committed POs' checkbox (checked by default)
  - 'Include Recurring Payments' checkbox (checked by default)
  - 'Generate Forecast' button visible and enabled
  - Page title/heading indicates "Cash Flow Forecast" or similar

## Checkpoint 2: Forecast Results Displayed
- **When**: After clicking "Generate Forecast" and waiting for results
- **Screenshot file**: `step-3-forecast-results-displayed.png`
- **What to look for**:
  - Current balance in GBP displayed at the top
  - Period-by-period breakdown visible (4 periods for Mar-Jun 2026)
  - Each period row shows: period date range, opening balance, inflows, outflows, net flow, closing balance
  - All monetary values in GBP format (£X,XXX.XX)
  - Inflow/outflow source breakdowns visible (AR outstanding, recurring income, AP outstanding, committed POs, recurring payments)
  - Chart or visual timeline may accompany the data
  - No error messages or empty states
  - Loading indicator gone — results fully rendered

## Checkpoint 3: Period Detail Verified
- **When**: After verifying period breakdown row fields
- **Screenshot file**: `step-4-period-detail-verified.png`
- **What to look for**:
  - At least one period row with all fields: periodStart, periodEnd, openingBalance, inflows, outflows, netFlow, closingBalance
  - Source breakdown for inflows (e.g., 'AR outstanding: £X,XXX', 'Recurring income: £X,XXX')
  - Source breakdown for outflows (e.g., 'AP outstanding: £X,XXX', 'Committed POs: £X,XXX')
  - Confidence scoring colour coding may be visible on forecast values
