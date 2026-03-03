# Visual Checkpoint Manifest — Journey 24

**Journey**: J24 — View Confidence Score and AI Explanation for Entity
**Description**: Navigate to an AI-created entity, verify confidence score with colour coding, then request an AI explanation and verify structured reasoning response.

---

## Checkpoint 1: Invoice Detail Page with AI Confidence Indicator
- **When**: After step 4 — navigating to an AI-created invoice detail page
- **Screenshot file**: `step-4-invoice-detail-ai-confidence.png`
- **What to look for**:
  - Invoice detail page loaded with entity data (invoice number, customer, amounts)
  - An 'AI Confidence' badge or indicator visible showing the overall confidence score
  - Confidence colour coding: green (>=90%), amber (70-89%), red (<70%)
  - An 'AI Created' label or icon indicating this entity was created via AI action
  - An 'Explain AI Decision' or 'View AI Reasoning' button/link is available

## Checkpoint 2: AI Explanation Panel Visible
- **When**: After step 6 — clicking the 'Explain AI Decision' button
- **Screenshot file**: `step-6-ai-explanation-panel.png`
- **What to look for**:
  - Explanation panel or modal is visible overlaying or alongside the invoice detail
  - Summary section: 1-2 sentence plain English explanation of why the AI created this entity
  - Reasoning section: bulleted list of reasoning steps the AI followed
  - Data Points section: table showing field, value, confidence score, and source (extracted/inferred/default/historical)
  - The explanation is human-readable and structured, not raw JSON
