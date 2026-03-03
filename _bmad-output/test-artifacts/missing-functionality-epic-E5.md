# Missing Functionality - Epic E5

> Auto-generated during frontend E2E testing

## Missing: Web Frontend Shell (apps/web) — No React Runtime

- **Journey**: J01 — Verify AI UI Elements Present in App Shell, Step 1
- **Expected**: Navigating to http://localhost:5173/login should load a login page with email/password form, sign-in button, and then after login, redirect to a dashboard with app shell containing sidebar navigation, header bar with unified search/AI input, chat toggle button, and Co-Pilot drawer (closed by default)
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with only a placeholder `src/index.ts`. No React runtime, no Vite dev server, no login page, no app shell, no AI UI elements exist yet.
- **Related Story**: E6 (Web Frontend Shell epic)
- **Suggested Story Title**: E6.S1 — Build Web Frontend Shell with Login, App Shell Layout, Sidebar, and Header

## Missing: Unified Search/AI Input in Header Bar

- **Journey**: J01 — Verify AI UI Elements Present in App Shell, Step 4
- **Expected**: Header bar contains a unified search/AI input with Cmd+K shortcut and rotating placeholder examples (e.g., "Invoice Acme for March widgets", "Show overdue invoices")
- **Actual**: No frontend exists — cannot verify
- **Related Story**: E6 (Web Frontend Shell) + E5 (AI Orchestration UI components)
- **Suggested Story Title**: E6.S2 — Implement Unified Search/AI Input Bar with Cmd+K Shortcut and Autocomplete

## Missing: Co-Pilot Chat Toggle Button

- **Journey**: J01 — Verify AI UI Elements Present in App Shell, Step 5
- **Expected**: Chat/Co-Pilot toggle button exists in the header area, with optional badge indicator for pending AI suggestions
- **Actual**: No frontend exists — cannot verify
- **Related Story**: E6 + E5
- **Suggested Story Title**: E5-UI.S1 — Implement Co-Pilot Drawer Toggle Button in App Header

## Missing: Co-Pilot Drawer Panel

- **Journey**: J01 — Verify AI UI Elements Present in App Shell, Step 6
- **Expected**: Co-Pilot drawer exists in the DOM but is closed/hidden by default on first login
- **Actual**: No frontend exists — cannot verify
- **Related Story**: E5 (AI Orchestration) / E6 (Frontend Shell)
- **Suggested Story Title**: E5-UI.S2 — Implement Co-Pilot Drawer with Chat Interface, Quick Prompts, and Session Management

## Missing: Co-Pilot Drawer Open/Close Interaction

- **Journey**: J02 — Open Co-Pilot Drawer and Verify Layout, Step 1
- **Expected**: Clicking the chat toggle button in the header opens a Co-Pilot drawer sliding in from the right at ~380px width. The drawer contains: header with "Co-Pilot" title and close button (X), chat selector with "Recent Chats" dropdown and "+ New Chat" button, empty conversation area or welcome message, quick prompt chips (role-based for Finance Manager), and input area with "Ask Nexa anything..." placeholder and submit button.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub. No React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer exists yet.
- **Related Story**: E6 (Web Frontend Shell) + E5 (AI Orchestration UI)
- **Suggested Story Title**: E5-UI.S2 — Implement Co-Pilot Drawer with Slide-in Animation, Header, Chat Selector, Quick Prompts, and Input Area

## Missing: Co-Pilot Drawer Close Interaction

- **Journey**: J02 — Open Co-Pilot Drawer and Verify Layout, Step 6
- **Expected**: Clicking the close button (X) on the Co-Pilot drawer slides the drawer out to the right and closes it. Main content area returns to full width. Chat toggle button remains visible in the header.
- **Actual**: No frontend exists — cannot verify
- **Related Story**: E5 (AI Orchestration) / E6 (Frontend Shell)
- **Suggested Story Title**: E5-UI.S2 — Co-Pilot Drawer Open/Close with Slide Animation

## Missing: Quick Prompt Chips (Role-Based Suggestions)

- **Journey**: J02 — Open Co-Pilot Drawer and Verify Layout, Step 4
- **Expected**: Quick prompt suggestion chips are visible below the conversation area in the Co-Pilot drawer. For a Finance Manager role, chips include suggestions like "Cash flow forecast", "Bank reconciliation", "Month-end status".
- **Actual**: No frontend exists — cannot verify
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S3 — Implement Context-Aware Quick Prompt Chips in Co-Pilot Drawer

## Missing: Chat Input Area with Submit Button

- **Journey**: J02 — Open Co-Pilot Drawer and Verify Layout, Step 5
- **Expected**: Text input area at the bottom of the Co-Pilot drawer with placeholder "Ask Nexa anything..." and a submit button (arrow icon)
- **Actual**: No frontend exists — cannot verify
- **Related Story**: E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S4 — Implement Chat Input Area with Send Button in Co-Pilot Drawer

## Missing: Send Chat Message and Receive Streaming AI Response

- **Journey**: J03 — Send First Chat Message and Receive Streaming Response, Step 1-6
- **Expected**: Open the Co-Pilot drawer, type "What is the current status of my company?" into the chat input, click Send, see user message appear as a chat bubble on the right side, see a typing indicator while AI processes, then see the AI response stream in token-by-token on the left side with grey background. After streaming completes, typing indicator disappears and a complete AI response is visible. The chat selector dropdown updates with an auto-generated title derived from the first user message.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer, and no WebSocket chat integration.
- **Related Story**: E6 (Web Frontend Shell) + E5-1 (AI Service Layer) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S5 — Implement Chat Message Send/Receive with WebSocket Streaming in Co-Pilot Drawer

## Missing: WebSocket Chat Pipeline (JWT auth, message send, streaming response)

- **Journey**: J03 — Send First Chat Message and Receive Streaming Response, Steps 3-4
- **Expected**: When user sends a message, it is transmitted via authenticated WebSocket (Socket.io at /ai/chat namespace, JWT in handshake.auth.token). The AI response streams back token-by-token, displayed incrementally in the chat UI with a typing indicator during processing.
- **Actual**: No frontend exists — cannot verify WebSocket pipeline integration
- **Related Story**: E5-1 (AI Service Layer) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S6 — Implement WebSocket Chat Client with JWT Auth, Streaming Response Display, and Typing Indicator

## Missing: Chat Session Title Auto-Generation

- **Journey**: J03 — Send First Chat Message and Receive Streaming Response, Step 6
- **Expected**: After the first message exchange, the chat selector/dropdown updates to show the current conversation with an auto-generated title based on the first user message (e.g., "What is the current status...")
- **Actual**: No frontend exists — cannot verify
- **Related Story**: E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S7 — Auto-Generate Chat Session Titles from First User Message

## Missing: Multi-Turn Conversation with Context Retention

- **Journey**: J04 — Multi-Turn Conversation Maintains Context, Steps 1-5
- **Expected**: In an already-open Co-Pilot drawer with an existing conversation, send a follow-up message "Can you give me more details about overdue items?" and receive an AI response that references/builds upon the first exchange. Then send a third message "Which customer owes the most?" and receive a response demonstrating full conversation awareness — referencing "overdue items" from message 2 and "company status" from message 1. Conversation thread should show 6 messages total (3 user, 3 AI) in chronological order with proper styling (user = right, AI = left).
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer, and no WebSocket chat integration. Multi-turn conversation cannot be tested.
- **Related Story**: E6 (Web Frontend Shell) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S8 — Implement Multi-Turn Context Assembly and Conversation History Display in Co-Pilot Drawer

## Missing: Create New Chat Session (+ New Chat Button)

- **Journey**: J05 — Create New Chat Session, Step 1
- **Expected**: After an existing conversation in the Co-Pilot drawer, clicking the "+ New Chat" button clears the conversation area, starts a fresh session (no messages visible), shows an empty state or welcome message, and the chat selector reflects a new/untitled conversation. The previous conversation should remain accessible via the Recent Chats dropdown.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer. The "+ New Chat" button and chat session management UI do not exist.
- **Related Story**: E6 (Web Frontend Shell) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S9 — Implement New Chat Session Creation with Conversation Area Reset

## Missing: Fresh AI Response Without Prior Context in New Session

- **Journey**: J05 — Create New Chat Session, Step 3
- **Expected**: After creating a new chat session and sending "How many employees do we have?", the AI responds with employee information without referencing any context from the previous conversation (company status, overdue items). The new conversation shows exactly 2 messages (1 user, 1 AI). The chat selector title auto-generates from the new message.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists to test session isolation
- **Related Story**: E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S10 — Verify Chat Session Isolation — New Sessions Start Without Prior Context

## Missing: Recent Chats Dropdown with Conversation History

- **Journey**: J06 — View and Resume Previous Chat Sessions, Step 1
- **Expected**: Opening the Recent Chats dropdown in the Co-Pilot drawer shows a list of previous conversations with auto-generated titles, most recent first. At least 2 conversations should be listed (e.g., "How many employees..." and "What is the current status..."). Each entry shows an auto-generated title and may show a timestamp or message count.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server. No Co-Pilot drawer, no chat history dropdown, no conversation list UI exist.
- **Related Story**: E6 (Web Frontend Shell) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S11 — Implement Recent Chats Dropdown with Conversation History List

## Missing: Load and Resume Previous Chat Conversation

- **Journey**: J06 — View and Resume Previous Chat Sessions, Step 2
- **Expected**: Clicking a previous conversation entry in the Recent Chats dropdown loads the full conversation history. For a conversation with 3 user messages and 3 AI responses, all 6 messages should appear in chronological order. The chat selector title updates to reflect the loaded conversation.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists. Chat session persistence and history loading cannot be tested.
- **Related Story**: E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S12 — Implement Conversation History Loading from Recent Chats Dropdown

## Missing: Cross-Session Context Retention When Resuming Conversations

- **Journey**: J06 — View and Resume Previous Chat Sessions, Step 4
- **Expected**: After loading a previous conversation and sending "Summarise what we discussed.", the AI responds with a summary referencing topics from all prior messages in that session (company status, overdue items, top customer). This proves cross-session persistence: conversation history was stored, loaded, and passed to the AI for context-aware continuation. The conversation should show 8 messages total (4 user + 4 AI).
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists. Cross-session context retention cannot be verified.
- **Related Story**: E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S13 — Implement Cross-Session Context Retention for Resumed Conversations

## Missing: Header Search Bar AI Command Routing to Co-Pilot

- **Journey**: J07 — Use Header Search Bar for AI Command, Steps 1-3
- **Expected**: With the Co-Pilot drawer closed, type "Show me this month's revenue" into the header unified search/AI input bar and press Enter. The Co-Pilot drawer should open automatically, the typed text should be submitted as a chat message, and the AI should begin streaming a response about revenue data. This demonstrates the unified input bar routing AI commands to the Co-Pilot.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with only a placeholder `src/index.ts`. No React runtime, no Vite dev server, no login page, no app shell, no unified search/AI input bar, and no Co-Pilot drawer exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-1 (AI Service Layer) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S14 — Implement Header Search Bar AI Command Detection and Routing to Co-Pilot Drawer

## Missing: AI Action Proposal Card in Co-Pilot Drawer

- **Journey**: J08 — Receive an AI Action Proposal, Steps 1-6
- **Expected**: In the Co-Pilot drawer, start a new chat and send "Create an invoice for Acme Corp for £5,000 for consulting services". The AI should process the action request and return an action proposal card in the conversation with: action type (CREATE_INVOICE), entity type (CustomerInvoice), description mentioning Acme Corp/£5,000/consulting, preview data showing proposed field values, confidence score with colour coding (green >= 90%, amber 70-89%, red < 70%), and two action buttons — "Confirm" (primary/green) and "Reject" (secondary/red).
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with only a placeholder `src/index.ts`. No React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer, and no action proposal card UI exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S15 — Implement AI Action Proposal Card with Confirm/Reject Buttons, Preview Data, and Confidence Score

## Missing: Action Proposal Confidence Score with Colour Coding

- **Journey**: J08 — Receive an AI Action Proposal, Step 4
- **Expected**: The action proposal card displays a confidence score with appropriate colour coding: green badge for >= 90%, amber for 70-89%, red for < 70%. The score value is visible (e.g., "95%" or "0.95") and may include a confidence level label ("high", "review", "low").
- **Actual**: No frontend exists — cannot verify confidence score rendering or colour coding
- **Related Story**: E5-3 (Action Framework) + E5-4 (AI Predictions — shared confidence display pattern)
- **Suggested Story Title**: E5-UI.S16 — Implement Confidence Score Badge Component with Colour-Coded Thresholds

## Missing: Action Proposal Preview Data Display

- **Journey**: J08 — Receive an AI Action Proposal, Step 5
- **Expected**: The action proposal card contains a preview data section showing the proposed record fields: customer name (Acme Corp), amount (£5,000), description (consulting services), and any other inferred fields. Each field may show its individual confidence score.
- **Actual**: No frontend exists — cannot verify preview data rendering
- **Related Story**: E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S17 — Implement Action Proposal Preview Data Card with Field-Level Confidence Scores

## Missing: Confirm AI Action Proposal and Record Creation Flow

- **Journey**: J09 — Confirm an AI Action Proposal, Step 1
- **Expected**: After an action proposal card is displayed (from J08 — requesting "Create an invoice for Acme Corp for £5,000 for consulting services"), clicking the "Confirm" button should: (1) show a processing/executing state on the action proposal card, (2) execute the action through the standard API path, (3) display a record_created message showing the created entity type (CustomerInvoice), entity ID, and display reference (e.g., "INV-000042"), and (4) show an AI confirmation text like "Invoice INV-000042 created successfully for Acme Corp — £5,000." with a green checkmark/success indicator.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with only a placeholder `src/index.ts`. No React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer, no action proposal card, and no action confirmation flow exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S18 — Implement Action Proposal Confirm Flow with Processing State, Record Creation, and Success Display

## Missing: Record Created Confirmation Message with Display Reference

- **Journey**: J09 — Confirm an AI Action Proposal, Step 2
- **Expected**: After confirming an action proposal, a confirmation message appears in the conversation showing the created entity with a display reference number (e.g., "INV-000042"). The text confirms the invoice was created through the standard API path (same as manual creation).
- **Actual**: No frontend exists — cannot verify record creation confirmation display
- **Related Story**: E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S19 — Implement Record Created Confirmation Message with Entity Reference in Co-Pilot

## Missing: Navigation Link to AI-Created Record

- **Journey**: J09 — Confirm an AI Action Proposal, Step 3
- **Expected**: The record_created confirmation message includes a clickable link or button (e.g., "View INV-000042") that navigates to the newly created entity's detail page (e.g., /ar/invoices/{id}). This provides a one-click path from the AI conversation to the created record.
- **Actual**: No frontend exists — cannot verify navigation link to created record
- **Related Story**: E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S20 — Implement Navigation Link to AI-Created Record in Confirmation Message

## Missing: Reject AI Action Proposal Flow

- **Journey**: J10 — Reject an AI Action Proposal, Steps 1-4
- **Expected**: In the Co-Pilot drawer, send "Send an email to Acme Corp about their overdue payment". AI returns a SEND_EMAIL action proposal card with preview (recipient, subject, draft body), Confirm and Reject buttons visible. Clicking "Reject" cancels the action — no email is sent, the action proposal card transitions to a cancelled/rejected visual state (greyed out or crossed out), and the AI sends an acknowledgement message such as "Action cancelled. No changes were made."
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer, and no action proposal card UI exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S21 — Implement Action Proposal Reject Flow with Cancelled State and AI Acknowledgement

## Missing: Conversation Continues After Action Rejection

- **Journey**: J10 — Reject an AI Action Proposal, Steps 5-6
- **Expected**: After rejecting an action proposal, the user can send a follow-up message ("OK, never mind. What else needs my attention?") and the AI responds normally. The conversation flow is unbroken by the rejection — the chat input remains active, messages send/receive as expected, and the AI does not reference the rejected action as if it was executed.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists to test post-rejection conversation continuity
- **Related Story**: E5-3 (Action Framework) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S22 — Verify Conversation Continuity After Action Proposal Rejection

## Missing: Financial Action Proposal with Mandatory Approval (POST_JOURNAL)

- **Journey**: J11 — Financial Actions Always Require User Confirmation, Steps 1-4
- **Expected**: In the Co-Pilot drawer, start a new chat and send "Post journal entry: debit Office Supplies £500, credit Cash £500". The AI should return an action proposal card for POST_JOURNAL with requiresApproval=true. The card should show journal details (debit/credit accounts, amounts), an "Approval Required" or "Financial action — confirmation required" badge/label, Confirm and Reject buttons, and a confidence score. Critically, the journal entry must NOT be auto-executed even if confidence is very high (>=90%) — it must be staged for explicit user approval (NFR16).
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer, and no action proposal card UI exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S23 — Implement Financial Action Proposal with Mandatory Approval Indicator (NFR16)

## Missing: Financial Action Proposal with Mandatory Approval (CREATE_PAYMENT)

- **Journey**: J11 — Financial Actions Always Require User Confirmation, Steps 5-6
- **Expected**: In the same conversation, send "Process payment of £2,000 to Smith & Sons Ltd". The AI should return a second action proposal card for CREATE_PAYMENT with requiresApproval=true. The payment must NOT be auto-executed. Both the journal and payment proposals demonstrate the financial guardrail: all financial actions (create invoice, post journal, process payment) ALWAYS require explicit user confirmation regardless of confidence score.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists to test payment action proposal or financial action guardrail
- **Related Story**: E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S24 — Verify Financial Action Guardrail — All Financial Actions Require Explicit Confirmation

## Missing: "Approval Required" Visual Indicator on Financial Action Cards

- **Journey**: J11 — Financial Actions Always Require User Confirmation, Step 4
- **Expected**: Financial action proposal cards display a visual indicator (badge, label, or icon) that clearly communicates "Approval Required" or "Financial action — confirmation required". This indicator differentiates financial actions (which NEVER auto-execute) from non-financial actions (which might auto-execute at high confidence). The indicator is visible alongside the confidence score.
- **Actual**: No frontend exists — cannot verify approval-required visual indicator
- **Related Story**: E5-3 (Action Framework)
- **Suggested Story Title**: E5-UI.S25 — Implement "Approval Required" Badge on Financial Action Proposal Cards

## Missing: Cash Flow Forecast Page (/ai/predictions/cash-flow)

- **Journey**: J12 — Generate Cash Flow Forecast, Step 1
- **Expected**: Navigating to `/ai/predictions/cash-flow` loads a cash flow forecast page with a configuration form containing: Start Date (date picker), End Date (date picker), optional Bank Account filter (multi-select dropdown), "Include Committed POs" checkbox (checked by default), "Include Recurring Payments" checkbox (checked by default), and a "Generate Forecast" button.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with only a placeholder `src/index.ts`. No React runtime, no Vite dev server, no login page, no app shell, no AI predictions pages exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S26 — Implement Cash Flow Forecast Page with Configuration Form

## Missing: Cash Flow Forecast Results — Period-by-Period Display

- **Journey**: J12 — Generate Cash Flow Forecast, Steps 3-4
- **Expected**: After filling the form (start: 2026-03-01, end: 2026-06-30, include committed POs, include recurring) and clicking "Generate Forecast", a loading indicator appears while the AI generates the forecast. After processing, period-by-period results are displayed showing: current balance in GBP at the top, followed by 4 period rows (Mar-Jun 2026). Each period shows: period date range, opening balance, inflows, outflows, net flow, and closing balance. All monetary values are in GBP format (£X,XXX.XX). A chart or visual timeline may accompany the data.
- **Actual**: No frontend exists — cannot verify forecast generation or period-by-period results display
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S27 — Implement Cash Flow Forecast Results Display with Period-by-Period Breakdown

## Missing: Cash Flow Forecast — Inflow/Outflow Source Breakdowns

- **Journey**: J12 — Generate Cash Flow Forecast, Step 5
- **Expected**: Each forecast period has expandable or visible inflow details (sources like "AR outstanding", "Recurring income") and outflow details ("AP outstanding", "Committed POs", "Recurring payments"). Each detail shows source name, amount, and description.
- **Actual**: No frontend exists — cannot verify inflow/outflow source breakdown rendering
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S28 — Implement Cash Flow Forecast Inflow/Outflow Source Breakdown Display

## Missing: Cash Flow Forecast — Extended Range Forecast Generation (10-Month)

- **Journey**: J13 — Cash Flow Forecast with Negative Balance Alert, Step 1–2
- **Expected**: Cash flow forecast form accepts an extended date range (2026-03-01 to 2026-12-31, 10 months) and generates period-by-period projections. The longer range increases the likelihood of capturing a period with projected negative closing balance.
- **Actual**: No frontend exists — `net::ERR_CONNECTION_REFUSED` at localhost:5173. Cannot fill form or generate forecast.
- **Related Story**: E5-4 (AI Predictions) + E6 (Web Frontend Shell)
- **Suggested Story Title**: E5-UI.S29 — Implement Cash Flow Forecast Extended Range Generation

## Missing: Cash Flow Forecast — Negative Balance Alert Display

- **Journey**: J13 — Cash Flow Forecast with Negative Balance Alert, Step 2
- **Expected**: When a forecast period has a projected negative closing balance, an Alerts section is prominently displayed with: NEGATIVE_BALANCE alert type badge (red/warning colour), affected period date range, projected shortfall amount (e.g. "-£3,200"), descriptive message, and a suggested action (e.g. "Accelerate collections" or "Defer payments"). The affected period row in the main table should be highlighted with a warning indicator.
- **Actual**: No frontend exists — cannot verify alert rendering, colour coding, or period row highlighting
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S30 — Implement Cash Flow Forecast Negative Balance Alert Cards with Colour-Coded Severity

## Missing: Cash Flow Forecast — Alert Card Detail (Type, Message, Amount, Period, Suggested Action)

- **Journey**: J13 — Cash Flow Forecast with Negative Balance Alert, Step 3
- **Expected**: Each alert card shows: type (NEGATIVE_BALANCE or LOW_BALANCE), message, affected period, shortfall amount, and optional suggestedAction. Alert types are colour-coded: NEGATIVE_BALANCE in red, LOW_BALANCE in amber, COLLECTION_OPPORTUNITY in blue/green.
- **Actual**: No frontend exists — cannot verify alert card component structure or colour-coded severity badges
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S31 — Implement Alert Card Component with Colour-Coded Severity Badges and Actionable Suggestions

## Missing: Anomaly Detection Page (/ai/predictions/anomalies)

- **Journey**: J14 — Run Anomaly Detection on Recent Transactions, Step 1
- **Expected**: Navigating to `/ai/predictions/anomalies` loads an anomaly detection page with a configuration form containing: Lookback Period input (slider or number, 7-365 days, default 90), optional Entity Type filter (multi-select: SupplierInvoice, Payment, etc.), Minimum Confidence threshold (slider 0-100%, default 50%), and a "Run Scan" button.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with only a placeholder `src/index.ts`. No React runtime, no Vite dev server, no anomaly detection page exists yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S32 — Implement Anomaly Detection Page with Configuration Form (Lookback Period, Entity Type Filter, Confidence Threshold)

## Missing: Anomaly Detection Scan Results Display

- **Journey**: J14 — Run Anomaly Detection on Recent Transactions, Step 3
- **Expected**: After filling the form (lookback: 90 days, min confidence: 50%) and clicking "Run Scan", a loading indicator appears while the AI analyses transactions. Results display a summary header (e.g., "Analysed 250 transactions — 5 anomalies detected") followed by anomaly cards. Each card shows: anomaly type badge (DUPLICATE_AMOUNT, UNUSUAL_AMOUNT, TIMING_ANOMALY, etc.), entity reference (display ref + entity type), description of suspicious pattern, confidence score with colour indicator (green >=90%, amber 70-89%, red <70%), and optionally related entities with relationship descriptions. Results are sorted by confidence (highest first).
- **Actual**: No frontend exists — cannot verify anomaly scan results rendering or card layout
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S33 — Implement Anomaly Detection Results Display with Anomaly Cards, Type Badges, and Confidence Colour Coding

## Missing: Anomaly Card Confidence Score Colour Coding

- **Journey**: J14 — Run Anomaly Detection on Recent Transactions, Step 4
- **Expected**: Each anomaly card displays a confidence score with colour-coded badge: green for >=90% (high), amber for 70-89% (review), red for <70% (low). The confidence level label ("high", "review", "low") is visible alongside the score value.
- **Actual**: No frontend exists — cannot verify confidence score colour coding on anomaly cards
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S34 — Implement Confidence Score Colour Coding on Anomaly Detection Cards

## Missing: Anomaly Card Related Entities Display

- **Journey**: J14 — Run Anomaly Detection on Recent Transactions, Step 5
- **Expected**: If an anomaly has related entities, they are displayed on the anomaly card with: entity type, display reference, and relationship description (e.g., "Potential duplicate of PAY-000123"). Related entities provide context for understanding the anomaly pattern.
- **Actual**: No frontend exists — cannot verify related entities rendering on anomaly cards
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S35 — Implement Related Entities Display on Anomaly Detection Cards

## Missing: Web Frontend Shell (Vite Dev Server)

- **Journey**: J15 — Run Duplicate Detection for Customers, Step 1
- **Expected**: Frontend at http://localhost:5173 serves the application with routing, login page, and all navigation working
- **Actual**: No frontend runtime exists — `apps/web` is a stub with no Vite config, no React runtime, no dev server. `net::ERR_CONNECTION_REFUSED` when attempting to connect. The test plan prerequisites note: "The web app (apps/web) is a stub — no React runtime exists until E6 (Web Frontend Shell)"
- **Related Story**: E6 (Web Frontend Shell)
- **Suggested Story Title**: E6.S1 — Implement Web Frontend Shell with Vite, React Router, and Login Page

## Missing: Duplicate Detection Page (/ai/predictions/duplicates)

- **Journey**: J15 — Run Duplicate Detection for Customers, Step 1
- **Expected**: Duplicate detection page loads at `/ai/predictions/duplicates` with configuration form containing: Entity Type selector (dropdown: Customer, Supplier, Contact), Minimum Similarity threshold input (slider or number, default 70%), Results Limit input (number, default 20), and a "Scan for Duplicates" button
- **Actual**: No frontend exists — cannot navigate to duplicate detection page or verify the configuration form
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S36 — Implement Duplicate Detection Page with Configuration Form

## Missing: Duplicate Detection Scan Results with Side-by-Side Entity Comparison

- **Journey**: J15 — Run Duplicate Detection for Customers, Step 3
- **Expected**: After clicking "Scan for Duplicates", results display: summary header (e.g., "Scanned 150 customers — 3 potential duplicate pairs found"), duplicate pair cards showing two entities side-by-side with overall similarity score and confidence colour coding (green >=90%, amber 70-89%, red <70%), and a field-by-field comparison table
- **Actual**: No frontend exists — cannot verify duplicate scan results rendering
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S37 — Implement Duplicate Detection Results Display with Similarity Scores and Entity Pair Cards

## Missing: Field-by-Field Comparison Table on Duplicate Pair Cards

- **Journey**: J15 — Run Duplicate Detection for Customers, Step 4
- **Expected**: At least one duplicate pair card shows a comparison table with fields: field name (e.g., "Company Name", "Address", "VAT Number"), value from entity A, value from entity B, and a per-field similarity score (0.0-1.0). High-similarity fields are visually highlighted.
- **Actual**: No frontend exists — cannot verify field-by-field comparison table rendering
- **Related Story**: E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S38 — Implement Field-by-Field Comparison Table for Duplicate Detection Pairs

## Missing: Daily Briefing Section on Dashboard (Finance Manager View)

- **Journey**: J16 — View Daily Briefing as Finance Manager, Step 1
- **Expected**: Dashboard at "/" loads with a prominent Daily Briefing section containing: personalised greeting based on time of day, 1-2 sentence summary overview, role-specific categories for Finance Manager (Pending Approvals, Overdue Invoices, Cash Position, Upcoming Payment Runs, Anomaly Alerts), briefing item cards with data, and a "cached at" timestamp or "Refresh" button
- **Actual**: No frontend exists — connection refused at localhost:5173. The web app (apps/web) is a stub until E6 (Web Frontend Shell) is implemented
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S39 — Implement Daily Briefing Dashboard Section with Role-Specific Content

## Missing: Personalised Time-of-Day Greeting on Briefing

- **Journey**: J16 — View Daily Briefing as Finance Manager, Step 2
- **Expected**: Greeting message visible at top of briefing, appropriate for time of day (e.g., "Good morning" before 12:00, "Good afternoon" 12:00-17:00, "Good evening" after 17:00) with user's name
- **Actual**: No frontend exists — cannot verify personalised greeting rendering
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S40 — Implement Personalised Greeting Component for Daily Briefing

## Missing: Briefing Item Cards with Metrics, Deltas, and Action Buttons

- **Journey**: J16 — View Daily Briefing as Finance Manager, Step 3
- **Expected**: Briefing item cards showing: title (bold), description, metric value (e.g., "£12,400"), delta/trend indicator (green up arrow for positive, red down arrow for negative) with percentage (e.g., "+12% vs last month"), comparison period label, and action buttons (e.g., "Chase", "Review", "Approve All")
- **Actual**: No frontend exists — cannot verify briefing item card rendering with metrics and actions
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S41 — Implement Briefing Item Card Component with Metrics, Trends, and Actions

## Missing: Pending Approvals Category in Finance Manager Briefing

- **Journey**: J16 — View Daily Briefing as Finance Manager, Step 4
- **Expected**: Pending Approvals section visible with count and action buttons (e.g., "Approve All" or "Review"). Content is finance-relevant.
- **Actual**: No frontend exists — cannot verify Pending Approvals category in briefing
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S42 — Implement Pending Approvals Briefing Category for Finance Role

## Missing: Cash Position Category in Finance Manager Briefing

- **Journey**: J16 — View Daily Briefing as Finance Manager, Step 5
- **Expected**: Cash Position section visible with current balance in GBP, trend indicator, and comparison to prior period
- **Actual**: No frontend exists — cannot verify Cash Position category in briefing
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S43 — Implement Cash Position Briefing Category with Balance and Trend

## Missing: Actionable Links from Briefing Items to Relevant Pages

- **Journey**: J16 — View Daily Briefing as Finance Manager, Step 6
- **Expected**: Clicking an action button on a briefing item (e.g., "Review" on overdue invoices) navigates to the relevant page (e.g., invoice list filtered to overdue) or triggers a one-tap action. Breadcrumb or page title confirms the destination.
- **Actual**: No frontend exists — cannot verify action-driven navigation from briefing items
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S44 — Implement Actionable Navigation Links from Briefing Item Cards

## Missing: Frontend Web Application (affects all J17 steps)

- **Journey**: J17 — View Daily Briefing as Business Owner, Steps 1–6
- **Expected**: Frontend dev server at localhost:5173 with login page, dashboard, and daily briefing UI
- **Actual**: No frontend exists — apps/web is a stub with no Vite, no React runtime, no dev server. `ERR_CONNECTION_REFUSED` at localhost:5173. The test plan prerequisites note: "The web app (apps/web) is a stub — no React runtime exists until E6 (Web Frontend Shell)."
- **Related Story**: E6 (Web Frontend Shell)
- **Suggested Story Title**: E6.S1 — Implement Web Frontend Shell with Vite, React, and Router

## Missing: Business Owner Login and Dashboard Access

- **Journey**: J17 — View Daily Briefing as Business Owner, Steps 1–3
- **Expected**: Business Owner (owner@nexa-test.co.uk / Owner123!) can log in and be redirected to dashboard
- **Actual**: No frontend exists — cannot test login flow or dashboard redirect for SUPER_ADMIN role
- **Related Story**: E6 (Web Frontend Shell)
- **Suggested Story Title**: E6-UI.S2 — Implement Login Page with Role-Based Dashboard Redirect

## Missing: Owner-Specific Daily Briefing Content

- **Journey**: J17 — View Daily Briefing as Business Owner, Step 4
- **Expected**: Dashboard shows daily briefing with SUPER_ADMIN/OWNER role-specific categories: Revenue vs Prior Period, Overdue Receivables, Pending Approvals (All Modules), AI-Detected Opportunities. Personalised greeting and refresh button visible.
- **Actual**: No frontend exists — cannot verify owner-specific briefing categories or role-based content differentiation
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S45 — Implement Owner/SUPER_ADMIN Role-Specific Daily Briefing Categories

## Missing: Revenue vs Prior Period Briefing Item with Delta/Trend

- **Journey**: J17 — View Daily Briefing as Business Owner, Step 5
- **Expected**: Revenue briefing item shows current period revenue value in GBP, delta/trend indicator (percentage change with direction arrow), and comparison period label (e.g., "vs last month")
- **Actual**: No frontend exists — cannot verify revenue metric, delta indicator, or period comparison display
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S46 — Implement Revenue vs Prior Period Briefing Item with Trend Indicators

## Missing: Cross-Module Pending Approvals for Business Owner

- **Journey**: J17 — View Daily Briefing as Business Owner, Step 6
- **Expected**: Pending Approvals section shows items across ALL modules (finance, sales, HR, purchasing, etc.) — a holistic view for the business owner, not finance-only
- **Actual**: No frontend exists — cannot verify cross-module approval aggregation or module-badge indicators
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S47 — Implement Cross-Module Pending Approvals Aggregation for Owner Role

## Missing: Context-Aware Quick Prompt Chips — Dashboard Context

- **Journey**: J18 — Smart Suggestions Change with Page Context, Steps 1-3
- **Expected**: On the Dashboard ("/"), open the Co-Pilot drawer and see quick prompt chips at the bottom showing dashboard/general-context suggestions: "Morning briefing", "What needs my attention?", "Revenue this month" (or similar role-based prompts for Finance Manager). Chips should be context-aware — reflecting the current page.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server. No Co-Pilot drawer, no quick prompt chips, and no context-aware suggestion system exist.
- **Related Story**: E6 (Web Frontend Shell) + E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S48 — Implement Context-Aware Quick Prompt Chips in Co-Pilot Drawer (Dashboard Context)

## Missing: Context-Aware Quick Prompt Chips — Customer Detail Context

- **Journey**: J18 — Smart Suggestions Change with Page Context, Steps 4-5
- **Expected**: When navigating to a Customer Detail page (/ar/customers/{id}) with the Co-Pilot drawer open, the quick prompt chips should automatically update to show customer-context suggestions: "Invoice this customer", "Show payment history", "Credit check", "View outstanding". The chips should be DIFFERENT from the dashboard chips, demonstrating page-context awareness.
- **Actual**: No frontend exists — cannot verify customer-context chip rendering or context switching
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S49 — Implement Customer Detail Context-Aware Quick Prompt Chips

## Missing: Quick Prompt Chip One-Tap Interaction (Auto-Submit)

- **Journey**: J18 — Smart Suggestions Change with Page Context, Step 6
- **Expected**: Clicking a quick prompt chip (e.g., "Show payment history") auto-fills and submits the prompt as a chat message in the Co-Pilot drawer. The user message appears in the conversation area and the AI responds with the customer's payment history. The interaction is seamless — one tap triggers the full AI query without requiring manual input or send button click.
- **Actual**: No frontend exists — cannot verify chip click auto-submit or AI response integration
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S50 — Implement Quick Prompt Chip One-Tap Auto-Submit to Co-Pilot Chat

## Missing: Context-Aware Quick Prompt Chips — Invoice List Context

- **Journey**: J18 — Smart Suggestions Change with Page Context, Steps 7-8
- **Expected**: When navigating to the Invoice List page (/ar/invoices) with the Co-Pilot drawer open, the quick prompt chips should update again to show invoice-list-context suggestions: "Show overdue", "Create invoice", "Export all", "Send statements". Three different pages (Dashboard, Customer Detail, Invoice List) should produce three distinct sets of contextual suggestion chips, confirming the AI awareness changes with navigation.
- **Actual**: No frontend exists — cannot verify invoice-list context chips or navigation-driven chip updates
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S51 — Implement Invoice List Context-Aware Quick Prompt Chips and Verify Navigation-Driven Updates

## Missing: HTTP Fallback Chat When WebSocket Unavailable

- **Journey**: J19 — HTTP Fallback When WebSocket Unavailable, Steps 1-4
- **Expected**: When WebSocket connections to the Socket.io /ai/chat namespace are blocked or unavailable, the frontend should detect the WS failure and fall back to HTTP POST /ai/chat/message. The user can open the Co-Pilot drawer, type "What is my cash position today?", send it, and receive a complete (non-streaming) AI response that appears all at once. A subtle connection-mode indicator may show "HTTP mode" or similar. The overall experience is functional — no crash, no blocking error.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no login page, no app shell, no Co-Pilot drawer, and no HTTP fallback chat mechanism exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S52 — Implement HTTP Fallback Chat Path When WebSocket Is Unavailable

## Missing: HTTP Fallback — Non-Streaming Response Display

- **Journey**: J19 — HTTP Fallback When WebSocket Unavailable, Step 4
- **Expected**: When using HTTP fallback (WebSocket unavailable), the AI response arrives as a complete message (not streaming token-by-token). The full response text appears at once in the conversation area. There is no visible error — the fallback works seamlessly. A subtle connection-mode indicator showing "HTTP mode" or similar may be present but is optional.
- **Actual**: No frontend exists — cannot verify non-streaming response display or HTTP fallback mechanism
- **Related Story**: E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S53 — Implement Non-Streaming Response Display for HTTP Fallback Mode

## Missing: AI Graceful Degradation — Dashboard Loads When AI Gateway Unreachable (IMP-006)

- **Journey**: J20 — AI Service Degradation — Graceful Error Handling, Step 1
- **Expected**: When the AI Gateway is unreachable, navigating to the dashboard ("/") should still load successfully. All traditional UI elements (sidebar navigation, header bar, page content, data tables) remain fully functional. The Daily Briefing section may show a graceful error state ("AI service temporarily unavailable") or an empty state with a "Retry" button, but the rest of the page works perfectly. No crash, no blank screen, no unhandled JS errors.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with only a placeholder `src/index.ts`. No React runtime, no Vite dev server, no login page, no dashboard, and no AI degradation handling exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-1 (AI Service Layer)
- **Suggested Story Title**: E5-UI.S54 — Implement AI Graceful Degradation on Dashboard — IMP-006 Compliance

## Missing: AI Graceful Degradation — Chat Error Message When AI Gateway Unreachable

- **Journey**: J20 — AI Service Degradation — Graceful Error Handling, Steps 2-4
- **Expected**: With the AI Gateway unreachable, opening the Co-Pilot drawer and sending a message ("Hello, can you help me?") should show the user message in the conversation, then display a user-friendly error message instead of an AI response: "AI service is temporarily unavailable. Please try again later." or "The AI assistant is currently offline. Your data and traditional features continue to work normally." The error should have an appropriate warning icon, no stack traces, no technical jargon. The chat input remains usable (not frozen/broken).
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists. Cannot test Co-Pilot drawer, chat input, or error handling.
- **Related Story**: E5-1 (AI Service Layer) + E5-2 (Chat Session Management)
- **Suggested Story Title**: E5-UI.S55 — Implement Graceful Chat Error Display When AI Gateway Is Unreachable

## Missing: AI Graceful Degradation — Traditional UI Fully Functional During AI Outage

- **Journey**: J20 — AI Service Degradation — Graceful Error Handling, Step 5
- **Expected**: With the AI Gateway still unreachable, navigating to a traditional business page like /ar/invoices should load and function normally — data tables show invoices, column headers visible, filter controls work, pagination works, action buttons present. The page works exactly as it would without AI features. This confirms IMP-006: AI degradation is safe — traditional UI is unaffected.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists. Cannot navigate to invoice list or verify traditional UI independence from AI services.
- **Related Story**: E6 (Web Frontend Shell) + E5-1 (AI Service Layer)
- **Suggested Story Title**: E5-UI.S56 — Verify Traditional UI Pages Function Independently of AI Gateway Availability

## Missing: Cash Flow Forecast 503 Error State When AI Degraded

- **Journey**: J21 — Prediction Endpoints Return 503 When AI Degraded, Steps 1-3
- **Expected**: With AI Gateway unreachable, navigating to `/ai/predictions/cash-flow` loads the cash flow forecast page with the configuration form visible. After filling the form (startDate: 2026-03-01, endDate: 2026-06-30) and clicking "Generate Forecast", the request fails with 503. A user-friendly error message is displayed: "AI prediction service is temporarily unavailable. Please try again later." or similar. No crash, no unhandled error, no technical jargon. A "Retry" button may be present. The page layout remains intact.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server. No cash flow forecast page, no AI prediction pages, and no 503 error handling exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S57 — Implement Cash Flow Forecast Page with Graceful 503 Error Handling When AI Is Degraded

## Missing: Anomaly Detection 503 Error State When AI Degraded

- **Journey**: J21 — Prediction Endpoints Return 503 When AI Degraded, Steps 4-5
- **Expected**: With AI Gateway unreachable, navigating to `/ai/predictions/anomalies` loads the anomaly detection page with the form. Clicking "Run Scan" fails with 503. A user-friendly error message is displayed with the same graceful pattern as the cash flow page: "AI prediction service is temporarily unavailable." No crash. The page remains navigable — sidebar/header still functional. Consistent error handling pattern across both prediction pages.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. No anomaly detection page or 503 error handling exist.
- **Related Story**: E6 (Web Frontend Shell) + E5-4 (AI Predictions)
- **Suggested Story Title**: E5-UI.S58 — Implement Anomaly Detection Page with Graceful 503 Error Handling When AI Is Degraded

## Missing: Daily Briefing Force Refresh — Dashboard with Cached Briefing and Refresh Button

- **Journey**: J22 — Force Refresh Daily Briefing, Steps 1-4
- **Expected**: After logging in as Finance Manager (finance@nexa-test.co.uk), the dashboard loads at "/" with a Daily Briefing section visible. The briefing shows cached content with a "cached at" or "Last updated" timestamp indicating when the briefing was last generated. A "Refresh" button is visible near the briefing section header, allowing the user to force-regenerate the briefing with fresh data.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — nothing is running at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no login page, no dashboard, and no Daily Briefing UI exist yet.
- **Related Story**: E6 (Web Frontend Shell) + E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S59 — Implement Daily Briefing Section with Cache Timestamp and Refresh Button

## Missing: Daily Briefing Force Refresh — Regenerate Briefing and Update Cache Timestamp

- **Journey**: J22 — Force Refresh Daily Briefing, Step 5
- **Expected**: Clicking the "Refresh" button on the briefing section triggers a loading indicator while the briefing regenerates via the API (which invalidates the Redis cache and fetches fresh data). After completion, the briefing content updates and the "cached at" / "Last updated" timestamp changes to the current time. The briefing content may differ if underlying data changed since the last generation. No error state visible.
- **Actual**: No frontend exists — cannot verify refresh button click, loading state, briefing regeneration, or timestamp update
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S60 — Implement Daily Briefing Force Refresh with Loading State and Cache Timestamp Update

## Missing: RBAC-Restricted Login Page for VIEWER User

- **Journey**: J23 — RBAC — Viewer Cannot Access Chat or Predictions, Step 1–3
- **Expected**: Navigating to http://localhost:5173/login loads a login page where the VIEWER user (viewer@nexa-test.co.uk / View123!) can log in and be redirected to the dashboard
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists at localhost:5173. The apps/web package is a stub with no React runtime, login page, or dashboard.
- **Related Story**: E6 (Web Frontend Shell epic)
- **Suggested Story Title**: E6.S1 — Build Web Frontend Shell with Login, App Shell Layout, and Role-Based Routing

## Missing: Daily Briefing Visible for VIEWER Role (RBAC ai.briefing — VIEWER Minimum)

- **Journey**: J23 — RBAC — Viewer Cannot Access Chat or Predictions, Step 4
- **Expected**: After logging in as VIEWER, the dashboard shows a Daily Briefing section because ai.briefing has VIEWER as its minimum access level. The briefing section should contain a greeting, summary overview, and role-appropriate briefing items.
- **Actual**: No frontend exists — cannot verify briefing visibility for VIEWER role
- **Related Story**: E5-5 (Daily Briefing & Smart Suggestions)
- **Suggested Story Title**: E5-UI.S61 — Render Daily Briefing for VIEWER Role with Role-Appropriate Content

## Missing: Chat Toggle Restricted for VIEWER Role (RBAC ai.chat — STAFF Minimum)

- **Journey**: J23 — RBAC — Viewer Cannot Access Chat or Predictions, Step 5
- **Expected**: VIEWER user should NOT be able to access AI chat. The chat toggle button should be either disabled, hidden, or clicking it should show a permission error ("You do not have permission to use the AI assistant"). ai.chat requires STAFF minimum role.
- **Actual**: No frontend exists — cannot verify RBAC enforcement on chat toggle for VIEWER
- **Related Story**: E5-2 (Chat Session Management) + RBAC
- **Suggested Story Title**: E5-UI.S62 — Enforce RBAC on Co-Pilot Chat — Hide or Disable for Roles Below STAFF

## Missing: Predictions Page Restricted for VIEWER Role (RBAC ai.predictions — MANAGER Minimum)

- **Journey**: J23 — RBAC — Viewer Cannot Access Chat or Predictions, Step 6
- **Expected**: VIEWER user navigating to /ai/predictions/cash-flow should see a permission denied state — either redirected to a 403 page, shown a "You do not have permission to access AI predictions" message, or the predictions nav link is hidden entirely. ai.predictions requires MANAGER minimum role.
- **Actual**: No frontend exists — cannot verify RBAC enforcement on predictions page for VIEWER
- **Related Story**: E5-4 (AI Predictions) + RBAC
- **Suggested Story Title**: E5-UI.S63 — Enforce RBAC on AI Predictions Pages — 403 or Redirect for Roles Below MANAGER

## Missing: Invoice Detail Page with AI Confidence Score Badge

- **Journey**: J24 — View Confidence Score and AI Explanation for Entity, Step 4-5
- **Expected**: Navigating to an AI-created invoice should show the invoice detail page with an 'AI Confidence' badge or indicator displaying the overall confidence score with colour coding (green >=90%, amber 70-89%, red <70%). An 'AI Created' label or icon should indicate the entity was created via AI. Per-field confidence breakdown should be available.
- **Actual**: No frontend exists — `net::ERR_CONNECTION_REFUSED` at localhost:5173. Cannot verify AI confidence display on entity detail pages.
- **Related Story**: E5-4 (AI Predictions) + E6 (Web Frontend Shell)
- **Suggested Story Title**: E5-UI.S64 — Display AI Confidence Score Badge on AI-Created Entity Detail Pages

## Missing: AI Explanation Panel (Explain AI Decision Button)

- **Journey**: J24 — View Confidence Score and AI Explanation for Entity, Step 6
- **Expected**: Clicking an 'Explain AI Decision' button on an AI-created entity should open a panel or modal showing structured AI reasoning: a plain English summary, bulleted reasoning steps, and a data points table with field, value, confidence score, and source (extracted/inferred/default/historical).
- **Actual**: No frontend exists — cannot verify AI explanation panel functionality
- **Related Story**: E5-4 (AI Predictions — explain_decision prompt) + E6 (Web Frontend Shell)
- **Suggested Story Title**: E5-UI.S65 — Implement AI Explanation Panel with Summary, Reasoning Steps, and Data Point Attribution

## Missing: Cmd+K Keyboard Shortcut to Focus Search/AI Input

- **Journey**: J25 — Cmd+K Keyboard Shortcut Opens Search/AI Input, Step 2
- **Expected**: Pressing Cmd+K (Mac) or Ctrl+K (Windows) should focus the header unified search/AI input bar. The input should become active with a visible cursor. An autocomplete/command palette dropdown may appear showing categories: entity results, page navigation, and suggested AI prompts.
- **Actual**: No frontend exists — `net::ERR_CONNECTION_REFUSED` at localhost:5173. The `apps/web` package is a stub with no React runtime, no Vite dev server, no keyboard shortcut handling.
- **Related Story**: E6 (Web Frontend Shell) + E5-2 (Chat Session Management — Co-Pilot UI)
- **Suggested Story Title**: E6.S5 — Implement Cmd+K Keyboard Shortcut for Unified Search/AI Input Focus

## Missing: Autocomplete Dropdown with Categorised Results on Search Input

- **Journey**: J25 — Cmd+K Keyboard Shortcut Opens Search/AI Input, Step 3
- **Expected**: After typing "Invoice Acme" in the focused search input, an autocomplete dropdown should appear with categorised results: entity matches (invoices containing "Acme"), page navigation entries (Invoice List), and AI prompt suggestions (e.g., "Invoice Acme Corp" as an AI action).
- **Actual**: No frontend exists — cannot verify autocomplete or search functionality
- **Related Story**: E6 (Web Frontend Shell) + E5-1 (AI Service Layer — search routing)
- **Suggested Story Title**: E6.S5b — Implement Autocomplete Dropdown with Entity, Page, and AI Prompt Categories

## Missing: Audit Log Page at /system/audit-log with AI Action Metadata

- **Journey**: J26 — Verify AI Actions Appear in Audit Trail, Step 1–3
- **Expected**: Navigating to /system/audit-log should load an audit log page with a table of audit entries showing timestamp, user, action, entity type, entity ID. Entries for AI-created records should display an 'AI' badge, isAiAction: true, aiConfidence score, and correlationId linking back to the AI chat session. Clicking an entry should show detail view with full AI metadata.
- **Actual**: `net::ERR_CONNECTION_REFUSED` — no frontend exists at localhost:5173. The web app is a stub. The audit log page, audit trail table, AI action metadata display, and AI traceability UI are all missing.
- **Related Story**: E6 (Web Frontend Shell) + E5-3 (AI Action Framework — audit trail integration)
- **Suggested Story Title**: E6-Audit.S1 — Implement Audit Log Page with AI Action Metadata Display and Traceability
