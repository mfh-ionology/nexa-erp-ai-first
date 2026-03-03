# UX Pattern Analysis & Inspiration

## Inspiring Products Analysis

**1. Linear (Project Management)**
Linear is the gold standard for "AI-meets-productivity" in B2B SaaS. Its relevance to Nexa:
- **Command palette (Cmd+K)** — Universal access to any action without navigating menus. Type "create issue" or "assign to me" and it just works. This directly maps to Nexa's AI command entry point.
- **Keyboard-first, mouse-friendly** — Power users never touch the mouse; new users click through comfortably. Both paths reach the same outcome. This mirrors Nexa's "AI path + form path = same result" philosophy.
- **Status as a first-class citizen** — Issues have clear, coloured status indicators visible in every view (list, board, detail). Status transitions are one-click. This is exactly what Nexa needs for its 37 state machines.
- **Minimal chrome, maximum content** — Sidebar collapses, toolbars are contextual, the workspace feels spacious. Supports our "Space to Think" emotional principle.
- **Real-time without noise** — Changes from teammates appear live without disrupting focus. Status updates flow in via subtle indicators, not pop-ups.

**2. Stripe Dashboard (Financial SaaS)**
Stripe's dashboard is the benchmark for financial data presentation:
- **Period comparisons everywhere** — Every metric shows "vs. previous period" with a trend indicator. Revenue isn't "£142K" — it's "£142K ↑12.3%". This is exactly Mohammed's requirement: never a single number, always a comparison.
- **Progressive detail** — Summary cards → click to see breakdown → click to see individual transactions. Three levels of depth, always one click apart. Maps perfectly to Nexa's dashboard → list → detail flow.
- **Batch operations done right** — Stripe's payout and refund batch flows: select items, review batch, confirm. Clean, confident, with clear counts ("3 of 47 selected"). Template for Nexa's batch approval patterns.
- **Document-quality data tables** — Column sorting, filtering, date ranges, export — all inline, no modal popups. Saved filters persist. This informs Nexa's entity list views.
- **Webhook/event visibility** — Stripe shows event logs with payloads, retry status, and failure reasons. Directly relevant to Nexa's event catalog visibility needs.

**3. Notion (Collaborative Workspace)**
Notion demonstrates how AI can be integrated into a content-creation workflow:
- **AI as inline assistant** — Type `/ai` to get AI help within the current context. The AI operates within the document, not in a separate panel. Relevant to Nexa's AI record creation where the AI fills fields in the form itself.
- **Views on the same data** — Table, board, calendar, gallery — all showing the same underlying data with different presentations. This maps to Nexa's saved views concept where the same entity list can be viewed as a table, filtered view, or board (for CRM/kanban).
- **Template system** — Pre-built templates that set up structure instantly. Parallels Nexa's AI suggesting record templates based on customer history.
- **Breadcrumb navigation** — Always know where you are in the hierarchy. Essential for Nexa's module → entity → record navigation.

**4. Xero (Accounting SaaS — Direct Competitor)**
Xero is the closest product category to Nexa and represents what to learn from *and* surpass:
- **Bank reconciliation flow** — Side-by-side: bank statement line on left, suggested match on right, approve/create/transfer buttons below. Clean, focused, fast. This is the template for Nexa's bank feed matching — but Nexa adds AI confidence scoring and batch approval.
- **Dashboard with watchlist** — Customisable account watchlist on the dashboard. Simple but useful. Nexa's briefing goes far beyond this with AI-curated, role-based, actionable items.
- **Invoice creation flow** — Clean form with customer auto-complete, line item entry, tax calculation. Competent but entirely manual. This is precisely what Nexa replaces with "tell the AI what you want, review the result."
- **What Xero lacks** — No AI assistance, no cross-module visibility (can't see a sales pipeline from an invoice), no period comparisons on the dashboard (single numbers only), no document understanding, no natural language interaction. Every gap is a Nexa opportunity.

## Transferable UX Patterns

**Navigation Patterns:**
| Pattern | Source | Nexa Application |
|---------|--------|-----------------|
| Command palette (Cmd+K) | Linear | Universal AI entry point — type natural language commands from anywhere |
| Collapsible sidebar with module grouping | Linear, Notion | Module-based navigation with collapse for focus; starred/pinned items at top |
| Breadcrumb trail | Notion, Xero | Module → Entity Type → Record navigation; click any level to jump back |
| Contextual toolbar | Linear | Form actions (save, approve, delete) appear only when relevant |

**Data Display Patterns:**
| Pattern | Source | Nexa Application |
|---------|--------|-----------------|
| Period comparison on every metric | Stripe | Briefing KPIs, dashboard cards, report summaries — always show delta |
| Progressive detail (summary → list → detail) | Stripe | Dashboard cards click through to filtered lists, then to record detail |
| Inline batch operations | Stripe | Bank feed matching, payroll approval, bulk status updates |
| Multiple views on same data | Notion | Entity lists as table (default), board (CRM pipeline), or calendar (HR leave) |
| Real-time status indicators | Linear | SSE-powered status badges that update without page refresh |

**AI Integration Patterns:**
| Pattern | Source | Nexa Application |
|---------|--------|-----------------|
| AI as inline assistant | Notion | AI fills form fields in-place, not in a separate chat panel |
| Confidence indicators | Medical/ML UIs | Green (>=90%), amber (70–89%), red (<70%) on every AI-filled field |
| Streaming responses | ChatGPT/Claude | Watch AI fill fields progressively — builds trust and feels responsive |
| Suggestion with reasoning | GitHub Copilot | "AI suggested because Acme's last 3 orders used Net 30 terms" |

**Form & Input Patterns:**
| Pattern | Source | Nexa Application |
|---------|--------|-----------------|
| Tabbed form with primary/secondary | Xero, Sage | Primary tab: 15 most-used fields. Tabs 2–5: specialised fields. All 280 fields accessible |
| Header + Lines pattern | Every accounting app | Shared component for invoices, POs, journals, credit notes — 18 variants of one pattern |
| Inline validation | Stripe | Field-level validation on blur, not on submit. Errors appear next to the field |
| Auto-save draft | Notion, Google Docs | Records auto-save as DRAFT, explicit action to post/approve |

## Anti-Patterns to Avoid

1. **The SAP Trap: Screens of Screens** — SAP's UI requires navigating 4–7 screens to complete a single transaction. Each screen is a modal or new page with no back-context. Nexa must NEVER require more than 3 clicks to reach any record, and cross-module navigation must be inline (side panels, linked badges), not new pages.

2. **The Sage Trap: Feature Menus as Navigation** — Sage organises navigation by feature ("Bank Reconciliation," "VAT Return," "Fixed Assets") rather than by workflow. Users must know the feature name to find it. Nexa organises by module (Finance, Sales, HR) with AI as the escape hatch — "I need to reconcile the bank" works even if you don't know it's under Finance → Bank Feeds.

3. **The Dashboard Number Wall** — Most ERP dashboards show 20+ single-value KPIs in a grid: "Revenue: £142K", "Invoices: 47", "Overdue: 12". No context, no comparison, no actionability. Nexa replaces this entirely with The Briefing — every number has a comparison, every item has an action.

4. **The Chatbot Sidebar** — Competitors adding AI as a chat sidebar (Salesforce Einstein, Zoho Zia) create a disconnected experience. The user chats with the AI in one panel and works in forms in another. Nexa's AI operates *within* the form — it fills the same fields the user would, it pre-populates the same layout, it's not a separate conversation.

5. **The Notification Firehose** — ERPs that treat every event as equally urgent: "Invoice created," "Payment received," "User logged in" — all in the same notification stream. Nexa's 3-tier system (toast for critical, centre for standard, audit-only for routine) prevents notification fatigue.

6. **The Wizard Trap** — Multi-step wizards that prevent editing earlier steps or seeing the full picture. Nexa's AI path shows the complete record at once (not step-by-step) with confidence indicators. The traditional form path uses tabs (visible, clickable, non-linear), not wizard steps.

## Design Inspiration Strategy

**Adopt Directly:**
- Linear's command palette as Nexa's universal AI entry point (Cmd+K / Ctrl+K)
- Stripe's period comparison pattern for every metric in the briefing and dashboards
- Stripe's batch operation flow for bank feed matching, payroll, and bulk approvals
- Linear's coloured status badges as the foundation for `<StatusBadge>`
- Notion's breadcrumb navigation for module → entity → record hierarchy

**Adapt for Nexa:**
- Notion's AI inline assistance → Nexa's AI fills form fields with confidence scoring (no competitor does this)
- Stripe's progressive detail → Nexa's Briefing → List → Detail flow with cross-module event tracking (goes beyond Stripe)
- Xero's bank reconciliation → Nexa adds AI matching, confidence scores, and batch approval (upgrades Xero's pattern)
- Linear's real-time updates → Nexa's SSE-powered status system across 37 state machines (larger scale than Linear)

**Reject Explicitly:**
- SAP's screen-of-screens navigation → single-page app with inline panels
- Sage's feature-based menus → module-based + AI search
- Competitor chatbot sidebars → AI within the form, not beside it
- Dashboard number walls → Briefing with comparisons and actions
- Notification firehose → 3-tier system with business-priority sorting
