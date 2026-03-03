# Epic E21: CRM (Customer Relationship Management)

> **Full CRM module with leads, opportunities, campaigns, activities, and pipeline management.** Integrates with Sales (E16), AR (E17), and the AI layer for intelligent lead scoring and activity recommendations.

**Architecture:** §2.21 CRM
**Models:** 16 models — `CrmLead`, `CrmLeadStatusChange`, `CrmOpportunity`, `CrmOpportunityStageChange`, `CrmCampaign`, `CrmCampaignRecipient`, `CrmCampaignResponse`, `CrmActivity`, `CrmActivityType`, `CrmActivityTypeGroup`, `CrmPipelineStage`, `CrmTerritory`, `CrmAutoRule`, `CrmAutoRuleCondition`, `CrmAutoRuleAction`, plus Customer (from AR)
**State Machines:** SM:CrmLead, SM:CrmCampaign, SM:CrmOpportunity
**Events:** `lead.created`, `lead.converted`, `opportunity.won`, `opportunity.lost`, `campaign.activated`, `activity.created`
**API:** §2.15 — ~39 endpoints under `/crm/*`
**Business Rules:** BR-CRM-001 to BR-CRM-020
**FRs:** FR54–FR58, FR95–FR100
**UX Templates:** T1 (Entity List), T2 (Record Detail), T4 (Briefing), T5 (Board/Kanban), T7 (Settings)

**Dependencies:** E17 (Sales Ledger/AR for customer records), E16 (Sales Orders for quote/order linking), E5 (AI Orchestration), E9 (Notifications), E11 (Tasks)

---

## Story E21.S1: Lead Management

**User Story:** As a sales user, I want to create and manage leads with status tracking so that I can qualify prospects and convert them to customers and opportunities.

**Acceptance Criteria:**

```gherkin
Scenario: Create a new lead
  Given I am logged in as STAFF or higher
  When I create a lead with company name, contact name, email, source, and rating
  Then a CrmLead record is created with status NEW scoped to my companyId
  And a "lead.created" event is emitted
  And the lead appears in the leads list

Scenario: Assign lead rating
  Given a lead exists with no rating
  When I set the lead rating to "Hot"
  Then the rating is updated to HOT
  And a CrmLeadStatusChange record is created tracking the change

Scenario: Progress lead through qualification stages
  Given a lead has status NEW
  When I change the status to CONTACTED, then QUALIFIED
  Then each status change is recorded in CrmLeadStatusChange with timestamp and userId
  And the lead's status field reflects the latest state

Scenario: Convert lead to customer and opportunity
  Given a lead has status QUALIFIED
  When I trigger lead conversion
  Then a new Customer record is created from the lead data
  And a new CrmOpportunity record is created linked to the customer
  And the lead status changes to CONVERTED
  And a "lead.converted" event is emitted

Scenario: Lead conversion prevents re-conversion
  Given a lead has status CONVERTED
  When I attempt to convert it again
  Then the system rejects the action with "lead.error.already_converted"

Scenario: Duplicate lead detection
  Given a lead exists with email "john@example.com"
  When I create a new lead with the same email
  Then the system warns about the potential duplicate
  And allows the user to proceed or merge
```

**Key Tasks:**
1. **Create CrmLead model and migration** — all fields per Architecture §2.21 (companyId, name, contactName, email, phone, source, rating enum, status enum, assignedToId, convertedCustomerId, convertedOpportunityId, etc.)
   - CrmLeadStatusChange for audit trail of status changes
2. **Implement CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/leads` with companyId scoping
   - List with cursor-based pagination, filter by status/rating/assigned
3. **Implement lead conversion service** — create Customer + CrmOpportunity from lead data
   - Validate QUALIFIED status guard (BR-CRM-003)
   - Emit `lead.converted` event with customerId and opportunityId
4. **Implement duplicate detection** — match by email, phone, company name with fuzzy matching
5. **Build leads list UI** — T1 template with status badges, rating indicators, assigned user
6. **Build lead detail UI** — T2 template with all fields, status change history, conversion button
7. **Write unit tests** — CRUD validation, conversion guards, duplicate detection
8. **Write integration tests** — full lead lifecycle from creation to conversion

**FR/NFR References:** FR54, FR56, FR99, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR54, FR56, FR99) | Lead management, status tracking, conversion |
| Architecture | §2.21 CRM | CrmLead model, conversion flow, duplicate detection |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Lead list and detail layouts |
| API Contracts | §2.15 CRM | Lead CRUD endpoints, conversion endpoint |
| Data Models | §11 CRM | CrmLead, CrmLeadStatusChange models |
| State Machine Reference | §8 CRM | SM:CrmLead — NEW → CONTACTED → QUALIFIED → CONVERTED / CLOSED |
| Event Catalog | §7 CRM | lead.created, lead.converted events |
| Business Rules Compendium | §6 CRM | BR-CRM-001 to BR-CRM-005 (lead rules) |

---

## Story E21.S2: Opportunity & Pipeline Management

**User Story:** As a sales user, I want to manage sales opportunities with pipeline stages, probability weighting, and expected revenue so that I can track and forecast my sales pipeline.

**Acceptance Criteria:**

```gherkin
Scenario: Create opportunity from lead conversion
  Given a lead is converted
  When the opportunity is created
  Then it has the linked customer, initial pipeline stage, and estimated value
  And the opportunity appears in the pipeline board

Scenario: Move opportunity through pipeline stages
  Given an opportunity is at stage "Qualification"
  When I drag it to "Proposal" on the Kanban board
  Then the stage is updated and a CrmOpportunityStageChange record is created
  And the probability percentage updates per the stage default (BR-CRM-008)
  And the weighted value recalculates automatically

Scenario: Won opportunity
  Given an opportunity is at stage "Negotiation"
  When I mark the opportunity as WON with actual revenue
  Then the status changes to WON
  And an "opportunity.won" event is emitted
  And the close date is recorded

Scenario: Lost opportunity with reason
  Given an opportunity exists at any stage
  When I mark it as LOST with reason "Price too high"
  Then the status changes to LOST
  And the loss reason is recorded
  And an "opportunity.lost" event is emitted

Scenario: Pipeline weighted value calculation
  Given 3 opportunities: GBP 10,000 at 25%, GBP 20,000 at 50%, GBP 5,000 at 75%
  When I view the pipeline summary
  Then the total weighted value shows GBP 16,250
  And the total unweighted value shows GBP 35,000
```

**Key Tasks:**
1. **Create CrmOpportunity model and migration** — companyId, customerId, title, description, stageId, probability, estimatedValue, weightedValue, expectedCloseDate, status, actualRevenue, lossReason, etc.
   - CrmOpportunityStageChange for stage change audit trail
2. **Create CrmPipelineStage model** — companyId, name, sortOrder, defaultProbability, isWon, isLost
   - Seed default pipeline stages (Lead, Qualification, Proposal, Negotiation, Closed Won, Closed Lost)
3. **Implement CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/opportunities`
   - Stage change endpoint with automatic probability update
   - Win/Lose endpoints with side effects
4. **Build pipeline Kanban board** — T5 (Board/Kanban) template
   - Drag-and-drop between stages; visual cards with customer, value, expected close date
   - Summary row with totals per stage (count, weighted value)
5. **Build opportunity detail** — T2 template with full fields, stage change history, linked activities
6. **Implement weighted value calculation** — estimatedValue * (probability / 100)
7. **Write unit tests** — stage transition validation, weighted value calculation, win/lose guards
8. **Write integration tests** — full opportunity lifecycle, pipeline board data retrieval

**FR/NFR References:** FR57, FR96, FR97, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR57, FR96, FR97) | Pipeline management, weighted values, Kanban board |
| Architecture | §2.21 CRM | CrmOpportunity model, pipeline stage configuration |
| UX Design Specification | T5 (Board/Kanban), T2 (Record Detail) | Pipeline Kanban layout, opportunity detail |
| API Contracts | §2.15 CRM | Opportunity CRUD, stage change, win/lose endpoints |
| Data Models | §11 CRM | CrmOpportunity, CrmPipelineStage, CrmOpportunityStageChange |
| State Machine Reference | §8 CRM | SM:CrmOpportunity — stage transitions, WON/LOST terminal states |
| Event Catalog | §7 CRM | opportunity.won, opportunity.lost events |
| Business Rules Compendium | §6 CRM | BR-CRM-006 to BR-CRM-010 (opportunity rules) |

---

## Story E21.S3: Campaign Management

**User Story:** As a marketing user, I want to create and manage marketing campaigns with recipient lists, status tracking, and response analysis so that I can measure campaign effectiveness and generate leads.

**Acceptance Criteria:**

```gherkin
Scenario: Create a marketing campaign
  Given I am logged in with STAFF or higher role
  When I create a campaign with name, type (Email/Direct Mail/Event/Telemarketing), start/end dates, and budget
  Then a CrmCampaign record is created with status DRAFT
  And the campaign appears in the campaign list

Scenario: Add recipients to campaign
  Given a campaign exists in DRAFT status
  When I add recipients from the customer/lead database (filtered by segment)
  Then CrmCampaignRecipient records are created for each recipient
  And the recipient count is updated on the campaign

Scenario: Activate campaign
  Given a campaign is in DRAFT status with at least one recipient
  When I activate the campaign
  Then the status changes to ACTIVE
  And a "campaign.activated" event is emitted

Scenario: Record campaign responses
  Given a campaign is ACTIVE
  When I record a response for a recipient (Interested, Not Interested, Subscribed, Bounced)
  Then a CrmCampaignResponse record is created
  And the response statistics are updated (response rate, conversion rate)

Scenario: Campaign analytics
  Given a campaign has 100 recipients with 25 responses (15 interested, 10 not interested)
  When I view the campaign analytics
  Then I see response rate (25%), interest rate (15%), ROI calculation if revenue is tracked
```

**Key Tasks:**
1. **Create CrmCampaign model and migration** — companyId, name, type enum, status enum, startDate, endDate, budget, actualCost, description
   - CrmCampaignRecipient: campaignId, entityType (Lead/Customer), entityId, sentDate
   - CrmCampaignResponse: recipientId, responseType enum, responseDate, notes
2. **Implement campaign CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/campaigns`
   - Recipients management: add/remove/bulk-add
   - Response recording: `POST /api/v1/crm/campaigns/:id/responses`
3. **Implement campaign activation** — validate has recipients; transition DRAFT → ACTIVE; emit event
4. **Build campaign list UI** — T1 template with status, type, date range, recipient count, response rate
5. **Build campaign detail** — T2 template with recipients tab, responses tab, analytics summary
6. **Implement campaign analytics** — calculate response rate, conversion rate, cost per lead, ROI
7. **Write unit tests** — activation guards, analytics calculations, response recording
8. **Write integration tests** — full campaign lifecycle

**FR/NFR References:** FR95, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR95) | Campaign management, recipient lists, response analysis |
| Architecture | §2.21 CRM | CrmCampaign model, campaign types, analytics |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Campaign list and detail layouts |
| API Contracts | §2.15 CRM | Campaign CRUD, recipients, responses endpoints |
| Data Models | §11 CRM | CrmCampaign, CrmCampaignRecipient, CrmCampaignResponse |
| State Machine Reference | §8 CRM | SM:CrmCampaign — DRAFT → ACTIVE → COMPLETED / CANCELLED |
| Event Catalog | §7 CRM | campaign.activated event |
| Business Rules Compendium | §6 CRM | BR-CRM-011 to BR-CRM-015 (campaign rules) |

---

## Story E21.S4: Activity Tracking & Auto-Rules

**User Story:** As a sales user, I want to log and track activities (calls, meetings, emails, notes) against CRM records, and as an administrator, I want to configure auto-rules that automatically create activities on key CRM events.

**Acceptance Criteria:**

```gherkin
Scenario: Log an activity against a lead
  Given a lead "John Smith" exists
  When I log a phone call activity with date, duration, summary, and next action
  Then a CrmActivity record is created linked to the lead
  And an "activity.created" event is emitted
  And the lead's lastActivityDate is updated

Scenario: View activity timeline
  Given a customer has 15 activities (calls, meetings, emails)
  When I view the customer's activity tab
  Then activities are displayed in reverse chronological order
  And each shows type icon, date, summary, and who logged it

Scenario: Configure activity auto-rule
  Given I am an ADMIN user
  When I create an auto-rule: "When lead status changes to CONTACTED, create Call activity assigned to lead owner"
  Then a CrmAutoRule record is created with conditions and actions
  And the rule appears in the auto-rules configuration list

Scenario: Auto-rule triggers activity creation
  Given an auto-rule exists for "lead status changed to CONTACTED"
  When a lead's status changes to CONTACTED
  Then a CrmActivity is automatically created per the rule's action
  And the activity is assigned to the lead owner
  And an "activity.created" event is emitted

Scenario: Configure activity types and groups
  Given I am an ADMIN user
  When I create an activity type "Site Visit" in group "Field Sales"
  Then the activity type is available for logging activities
  And it appears grouped under "Field Sales" in activity type selectors
```

**Key Tasks:**
1. **Create CrmActivity model and migration** — companyId, activityTypeId, entityType, entityId (polymorphic), subject, description, activityDate, durationMinutes, assignedToId, completedAt
   - CrmActivityType: companyId, name, groupId, isActive
   - CrmActivityTypeGroup: companyId, name, sortOrder
2. **Create CrmAutoRule model** — companyId, name, triggerEvent, isActive
   - CrmAutoRuleCondition: ruleId, field, operator, value
   - CrmAutoRuleAction: ruleId, actionType, config (JSON)
3. **Implement activity CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/activities`
   - Filter by entity, type, date range, assigned user
4. **Implement auto-rule engine** — subscribe to CRM events; evaluate conditions; execute actions
   - Actions: create activity, send notification, update field
5. **Build activity timeline component** — reusable component for any entity's activity tab
6. **Build auto-rules admin UI** — T7 (Settings) template for rule configuration
7. **Write unit tests** — activity validation, auto-rule evaluation, condition matching
8. **Write integration tests** — auto-rule trigger → activity creation flow

**FR/NFR References:** FR55, FR58, FR98, FR100, NFR2, NFR14

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR55, FR98, FR100) | Activity logging, auto-rules, activity types |
| Architecture | §2.21 CRM | CrmActivity model, auto-rule engine design |
| UX Design Specification | T2 (Record Detail), T7 (Settings) | Activity timeline component, auto-rules settings |
| API Contracts | §2.15 CRM | Activity CRUD, auto-rule configuration endpoints |
| Data Models | §11 CRM | CrmActivity, CrmAutoRule, CrmAutoRuleCondition, CrmAutoRuleAction |
| State Machine Reference | §8 CRM | Activity auto-creation as side effect of lead/opportunity transitions |
| Event Catalog | §7 CRM | activity.created event, auto-rule subscription events |
| Business Rules Compendium | §6 CRM | BR-CRM-016 to BR-CRM-020 (activity and auto-rule rules) |

---

## Story E21.S5: Territory Management

**User Story:** As a sales manager, I want to define sales territories and assign leads/customers to territories so that I can manage coverage and assign ownership across geographic or segment-based regions.

**Acceptance Criteria:**

```gherkin
Scenario: Create a sales territory
  Given I am a MANAGER or higher
  When I create a territory "London South" with description and assigned user
  Then a CrmTerritory record is created scoped to my companyId

Scenario: Assign lead to territory
  Given a territory "London South" exists
  When I assign a lead to this territory
  Then the lead's territoryId is updated
  And filtering leads by territory shows the lead

Scenario: Territory hierarchy
  Given territories "UK" → "London" → "London South" exist
  When I view the territory tree
  Then territories display in a hierarchical structure
  And selecting "London" shows leads from "London" and its children

Scenario: Territory performance report
  Given territory "London South" has 10 leads and 5 opportunities
  When I view the territory summary
  Then I see lead count, opportunity count, pipeline value, and conversion rate for the territory
```

**Key Tasks:**
1. **Create CrmTerritory model** — companyId, name, description, parentTerritoryId (self-referential), assignedToId, isActive
2. **Implement territory CRUD endpoints** — `GET/POST/PUT/DELETE /api/v1/crm/territories`
   - Include hierarchy endpoints: GET with tree structure
3. **Add territoryId to CrmLead and Customer** — FK relationship
4. **Build territory management UI** — T1 list with tree view option
5. **Implement territory-based filtering** — leads and opportunities filterable by territory (including children)
6. **Write unit tests** — hierarchy queries, territory assignment
7. **Write integration tests** — territory CRUD and lead assignment

**FR/NFR References:** FR54, FR56, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR54) | Contact and account management, territory concept |
| Architecture | §2.21 CRM | CrmTerritory model, hierarchy |
| UX Design Specification | T1 (Entity List) | Territory list with tree view |
| API Contracts | §2.15 CRM | Territory CRUD endpoints |
| Data Models | §11 CRM | CrmTerritory with self-referential parent |
| State Machine Reference | §8 CRM | N/A — territories are reference data |
| Event Catalog | §7 CRM | Territory assignment events |
| Business Rules Compendium | §6 CRM | Territory assignment rules |

---

## Story E21.S6: Pipeline Reporting & Dashboards

**User Story:** As a sales manager, I want to view pipeline reports with stage analysis, conversion rates, and forecasting so that I can make data-driven sales decisions.

**Acceptance Criteria:**

```gherkin
Scenario: Pipeline summary by stage
  Given multiple opportunities exist across pipeline stages
  When I view the pipeline report
  Then I see a summary per stage: count, total value, weighted value, average days in stage

Scenario: Conversion funnel analysis
  Given opportunities have moved through stages over the last quarter
  When I view the conversion funnel
  Then I see the conversion rate between each adjacent stage pair
  And the overall lead-to-win conversion rate

Scenario: Sales forecast by month
  Given opportunities have expected close dates in the next 3 months
  When I view the sales forecast
  Then I see projected revenue per month (weighted and unweighted)
  And can compare to target if targets are configured

Scenario: Filter reports by date range, owner, territory
  Given pipeline reports are displayed
  When I filter by owner "Jane Smith" and date range "last 90 days"
  Then only Jane's opportunities within the date range are included
```

**Key Tasks:**
1. **Implement pipeline report endpoint** — `GET /api/v1/crm/reports/pipeline`
   - Aggregate by stage: count, total, weighted, avg duration
   - Filter by owner, territory, date range, customer
2. **Implement funnel report** — `GET /api/v1/crm/reports/funnel`
   - Calculate conversion rates between stages
3. **Implement forecast endpoint** — `GET /api/v1/crm/reports/forecast`
   - Group by expected close month, sum weighted/unweighted values
4. **Build pipeline dashboard** — T4 (Briefing) template with charts and KPIs
   - Bar chart for pipeline by stage, funnel visualization, forecast line chart
5. **Write unit tests** — aggregation calculations, conversion rate math
6. **Write integration tests** — report endpoints with seeded opportunity data

**FR/NFR References:** FR57, FR96, FR97, NFR3

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR57, FR96, FR97) | Pipeline reporting, weighted values, Kanban |
| Architecture | §2.21 CRM | Reporting queries, pipeline analytics |
| UX Design Specification | T4 (Briefing), T5 (Board/Kanban) | Dashboard and Kanban layouts |
| API Contracts | §2.15 CRM | Report endpoints: pipeline, funnel, forecast |
| Data Models | §11 CRM | CrmOpportunity, CrmPipelineStage for aggregation |
| State Machine Reference | §8 CRM | Opportunity state data for funnel analysis |
| Event Catalog | §7 CRM | Events used for real-time dashboard updates |
| Business Rules Compendium | §6 CRM | Weighted value calculation rules |

---

## Story E21.S7: CRM-Sales Integration

**User Story:** As a sales user, I want CRM records linked to sales transactions (quotes, orders, invoices) so that I can track the full customer journey from lead to revenue.

**Acceptance Criteria:**

```gherkin
Scenario: Link opportunity to sales quote
  Given an opportunity exists for customer "ABC Ltd"
  When I create a sales quote from the opportunity
  Then the quote is created with customer and estimated value pre-filled
  And a RecordLink is created between the opportunity and the quote

Scenario: Opportunity updates on quote acceptance
  Given a quote linked to an opportunity is accepted by the customer
  When the quote converts to a sales order
  Then the opportunity's linked records are updated
  And actual revenue data flows back to the opportunity

Scenario: View complete customer journey
  Given a customer went through Lead → Opportunity → Quote → Order → Invoice
  When I view the customer's CRM record
  Then I see a timeline showing each stage of the journey with dates and values
  And each record is clickable to navigate to the detail view

Scenario: CRM activity feed includes sales events
  Given a sales invoice is posted for a CRM customer
  When I view the customer's activity feed in CRM
  Then the invoice posting appears as an activity entry
```

**Key Tasks:**
1. **Implement opportunity-to-quote conversion** — `POST /api/v1/crm/opportunities/:id/create-quote`
   - Pre-fill quote from opportunity data (customer, estimated value, description)
   - Create RecordLink between opportunity and quote
2. **Implement sales event subscription** — subscribe to `salesOrder.confirmed`, `invoice.posted` events
   - Create CrmActivity records for sales events on CRM-linked customers
3. **Build customer journey view** — timeline component on customer/opportunity detail showing linked records
4. **Implement bidirectional RecordLinks** — CRM ↔ Sales module cross-references
5. **Write unit tests** — conversion logic, event handling, RecordLink creation
6. **Write integration tests** — full journey from opportunity to invoice with CRM visibility

**FR/NFR References:** FR58, FR34, FR37, NFR2

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR58) | Link CRM records to sales transactions |
| Architecture | §2.21 CRM, §2.15 Sales | Cross-module integration points |
| UX Design Specification | T2 (Record Detail) | Customer journey timeline component |
| API Contracts | §2.15 CRM, §2.8 Sales | Conversion and linking endpoints |
| Data Models | §11 CRM, §5 Sales, §10 Cross-Cutting | RecordLink polymorphic model |
| State Machine Reference | §8 CRM, §3 Sales | Opportunity stage → sales order lifecycle |
| Event Catalog | §7 CRM, §3 Sales | Cross-module event subscriptions |
| Business Rules Compendium | §6 CRM | CRM-Sales linking rules |

---

## Story E21.S8: AI-Powered CRM Features

**User Story:** As a sales user, I want AI-powered lead scoring, activity recommendations, and next-best-action suggestions so that I can prioritise my time on the highest-value opportunities.

**Acceptance Criteria:**

```gherkin
Scenario: AI lead scoring
  Given a lead has activity history, company size, industry, and engagement data
  When the AI scoring engine evaluates the lead
  Then a lead score (0-100) is calculated and displayed
  And the score factors are explainable (shown on hover)

Scenario: Activity recommendation
  Given an opportunity has had no activity for 14 days
  When I view the opportunity
  Then the AI suggests a next activity (e.g., "Schedule a follow-up call — last contact was 14 days ago")
  And I can accept the suggestion with one tap

Scenario: Next-best-action on daily briefing
  Given I have 5 open opportunities
  When I view my CRM daily briefing
  Then the AI prioritises actions by expected impact
  And shows top 3 recommended actions with reasoning

Scenario: AI respects approval pattern
  Given the AI recommends creating a follow-up task
  When I approve the recommendation
  Then the task is created (not before approval)
  And the action is logged in the audit trail
```

**Key Tasks:**
1. **Implement AI lead scoring service** — call AI Gateway with lead data, activity history, and company profile
   - Calculate composite score; store on lead record
   - Provide score factor breakdown for explainability
2. **Implement activity recommendation engine** — analyse activity gaps, opportunity stage duration, historical patterns
   - Generate recommendations via AI Gateway
   - Follow "Told, Shown, Approve, Done" pattern (FR5, FR6)
3. **Build CRM briefing** — T4 (Briefing) template showing AI-prioritised actions, stale opportunities, hot leads
4. **Implement next-best-action suggestions** — context-aware recommendations on opportunity and lead detail pages
5. **Write unit tests** — scoring calculation, recommendation logic, approval guard
6. **Write integration tests** — AI gateway integration with mocked responses

**FR/NFR References:** FR1, FR2, FR3, FR5, FR6, FR10, NFR1, NFR16, NFR47

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.1 AI/NLP Core (FR1-FR6, FR10) | AI interaction paradigm, confidence scoring |
| Architecture | §2.21 CRM, §2.7 AI Orchestration | AI scoring, recommendation engine design |
| UX Design Specification | T4 (Briefing) | AI briefing dashboard layout, Co-Pilot Dock |
| API Contracts | §2.15 CRM | AI scoring and recommendation endpoints |
| Data Models | §11 CRM | Lead score fields, AI recommendation storage |
| State Machine Reference | §8 CRM | AI recommendations as side effects |
| Event Catalog | §7 CRM | AI recommendation events |
| Business Rules Compendium | §6 CRM | AI scoring factor weights, recommendation triggers |

---

## Story E21.S9: Mobile Adaptation — CRM

**User Story:** As a mobile sales user, I want to access my leads, opportunities, and log activities from my phone so that I can manage my pipeline on the go.

**Acceptance Criteria:**

```gherkin
Scenario: View leads list on mobile
  Given I am on the mobile app
  When I navigate to CRM Leads
  Then I see a mobile-optimised list with lead name, rating, and status
  And I can tap to view lead details

Scenario: Log activity from mobile
  Given I am viewing a lead or customer on mobile
  When I tap "Log Activity" and select "Phone Call"
  Then I can enter call summary, duration, and next steps
  And the activity is synced to the server

Scenario: View pipeline on mobile
  Given I have open opportunities
  When I view the pipeline on mobile
  Then I see a simplified pipeline view (list grouped by stage, not full Kanban)
  And opportunity cards show customer, value, and expected close date

Scenario: Push notifications for CRM events
  Given auto-rules are configured for my leads
  When a lead I own is updated or an activity is due
  Then I receive a push notification on my mobile device
```

**Key Tasks:**
1. **Create mobile leads screen** — simplified T1 list optimised for mobile
2. **Create mobile opportunity list** — grouped by pipeline stage
3. **Create mobile activity logging** — streamlined form with quick-entry fields
4. **Implement CRM push notifications** — activity reminders, lead updates
5. **Write unit tests** — mobile data transformations
6. **Write integration tests** — mobile API calls and push notification delivery

**FR/NFR References:** FR54, FR55, FR56, FR57, NFR6

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.6 CRM (FR54-FR58) | CRM functional requirements applicable to mobile |
| Architecture | §2.21 CRM | Mobile adaptation points |
| UX Design Specification | Mobile strategy section | Mobile adaptation patterns, Expo scaffold |
| API Contracts | §2.15 CRM | Same API endpoints used by mobile |
| Data Models | §11 CRM | Same models (mobile uses API, not direct DB) |
| State Machine Reference | §8 CRM | Same state machines apply |
| Event Catalog | §7 CRM | Events triggering push notifications |
| Business Rules Compendium | §6 CRM | Same business rules apply on mobile |

---
