# Design Direction Decision

## Design Directions Explored

Six interactive HTML prototypes were created and evaluated in the previous session:

| Concept | Theme | AI Model | Pages | Key Characteristics |
|---------|-------|----------|-------|-------------------|
| **A** | Dark cyberpunk | Floating AI orb | 5 | Neon accents, glowing cards, dramatic |
| **B** | Dark minimal | Bottom command bar | 5 | Dense data, power-user focused |
| **C** | Dark editorial | Conversation thread | 5 | Long-form AI interaction, chat-first |
| **D** | Purple + Co-Pilot Dock | Right sidebar AI panel | 11 | AI as persistent sidebar companion |
| **E** | Purple + Command Centre | Cmd+K modal overlay | 11 | AI via keyboard shortcut, minimal chrome |
| **F** | Purple + Conversation Canvas | AI IS the workspace | 11 | Conversational interface with embedded forms |

Concepts D, E, and F included full module pages: Dashboard, Invoice Entry, Invoice List, CRM Pipeline, Inventory, General Ledger, Sales Orders, Reports, AI Create Invoice flow, and Settings.

## Chosen Direction

**Purple theme (from Concepts D/E/F)** — with AI interaction variant to be chosen separately.

The purple theme was selected for:
- **Professional yet distinctive** — differentiates from the blue/grey of every other ERP (SAP, Sage, Xero, Odoo)
- **Calm authority** — purple communicates trust and intelligence without the aggression of red or the coldness of blue
- **Prototype validation** — all three purple variants (D/E/F) demonstrated that the purple palette works across all 11 module pages, not just a dashboard
- **AI brand alignment** — purple has become associated with AI products (Claude, Anthropic); this subconscious association reinforces Nexa's AI-first positioning

The dark theme concepts (A/B/C) were rejected for the primary UI because:
- ERP users work 8+ hours daily — dark themes cause eye strain for extended data-entry sessions
- Accounting and finance professionals expect light backgrounds for document-like interfaces
- Period comparison charts and data tables have better readability on light backgrounds

**AI Variant Decision: Concept D — Co-Pilot Dock (Collapsible Drawer)**

The Co-Pilot Dock was chosen for:
- AI is always accessible but never intrusive — drawer collapses when not needed
- Users can chat with the AI while viewing any screen (forms, lists, reports)
- Contextual awareness — the Co-Pilot sees what the user sees and offers relevant suggestions
- Multi-turn conversations persist across navigation — the AI remembers context
- Natural upgrade path — the drawer can grow in capability without redesigning the layout

## Design Rationale

The purple direction satisfies all five experience principles:
1. **AI Prepares, Human Decides** — Purple AI indicators (confidence dots, suggestion tooltips) are visually distinct from form content
2. **Show the Delta** — Period comparison cards use green/red delta indicators that contrast clearly against the purple/white palette
3. **One Entity, Full Context** — The `<EventFlowTracker>` uses purple accent for the current entity, grey for upstream/downstream
4. **Progressive Disclosure** — Tabbed forms use purple active tab indicator, muted grey for inactive tabs
5. **Consistent Status Language** — The 9-colour semantic status palette was designed to be distinguishable against the purple theme background

## Visual Direction Implementation

**Page Template (Co-Pilot closed):**
```
┌────────────────────────────────────────────────────────────────┐
│ [≡ Logo]  [🔍 Search or Ask Nexa anything...    ]  [💬] [🔔] [👤] │
├────────┬───────────────────────────────────────────────────────┤
│        │                                                       │
│ Side   │  Content Area (full width)                            │
│ bar    │  ┌───────────────────────────────────────────────┐    │
│        │  │ Page Header + Breadcrumbs                     │    │
│ Module │  ├───────────────────────────────────────────────┤    │
│ Nav    │  │                                               │    │
│        │  │ Page Content (cards, tables, forms)           │    │
│ Pinned │  │                                               │    │
│ Views  │  └───────────────────────────────────────────────┘    │
│        │                                                       │
└────────┴───────────────────────────────────────────────────────┘
```

**Page Template (Co-Pilot open):**
```
┌────────────────────────────────────────────────────────────────┐
│ [≡ Logo]  [🔍 Search or Ask Nexa anything...    ]  [💬] [🔔] [👤] │
├────────┬──────────────────────────────┬────────────────────────┤
│        │                              │ Co-Pilot          [✕]  │
│ Side   │  Content Area (narrower)     │────────────────────────│
│ bar    │  ┌──────────────────────┐    │ [Recent Chats▾][+ New] │
│        │  │ Page Header          │    │                        │
│ Module │  ├──────────────────────┤    │ 🤖 AI conversation...  │
│ Nav    │  │                      │    │                        │
│        │  │ Page Content         │    │ Quick Prompts:         │
│ Pinned │  │                      │    │ [Create Invoice] [...]  │
│ Views  │  └──────────────────────┘    │────────────────────────│
│        │                              │ [Ask Nexa...      ] [→]│
└────────┴──────────────────────────────┴────────────────────────┘
```

- Header: 56px height, white background, purple logo mark, unified Search/AI input centered, Chat button (💬), Notifications (🔔), User avatar (👤)
- Sidebar: 256px expanded / 64px collapsed, white background, purple active indicator
- Content: Fluid width, `#f4f2ff` background, cards on white surface — shrinks when Co-Pilot drawer opens
- Co-Pilot Drawer: 380px width, slides in from right, white background, collapsible
- All corners: 8px border-radius on cards, 6px on inputs, 4px on badges
