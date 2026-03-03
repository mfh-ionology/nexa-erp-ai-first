# Visual Checkpoint Manifest — Journey 14: Run Anomaly Detection on Recent Transactions

## Checkpoint 1: Anomaly Detection Page Loaded
- **When**: After step 1 — navigate to /ai/predictions/anomalies
- **Screenshot file**: step-1-anomaly-detection-page.png
- **What to look for**:
  - Page title or heading indicating "Anomaly Detection" visible
  - Configuration form visible with:
    - Lookback Period input (slider or number field, 7–365 days, default 90)
    - Optional Entity Type filter (multi-select: SupplierInvoice, Payment, etc.)
    - Minimum Confidence threshold (slider 0–100%, default 50%)
    - "Run Scan" button visible and enabled
  - No error messages or broken layout
  - Page navigation/sidebar visible (app shell intact)

## Checkpoint 2: Anomaly Scan Results Displayed
- **When**: After step 3 — click "Run Scan" and results load
- **Screenshot file**: step-3-anomaly-scan-results.png
- **What to look for**:
  - Summary header showing transaction count and anomaly count (e.g. "Analysed 250 transactions — 5 anomalies detected")
  - List of anomaly cards displayed below the summary
  - Each card should show:
    - Anomaly type badge (DUPLICATE_AMOUNT, UNUSUAL_AMOUNT, TIMING_ANOMALY, etc.)
    - Entity reference (display ref + entity type)
    - Description of the suspicious pattern
    - Confidence score with colour coding (green >=90%, amber 70–89%, red <70%)
  - Results sorted by confidence (highest first)
  - No loading spinners remaining
  - No error messages
