# 3. Detailed Endpoint Specifications

## 3.1 Auth Endpoints

### POST /auth/login

Authenticate user and obtain JWT.

- **Min Role:** Public
- **FR Ref:** FR80

**Request Body:**
```typescript
interface LoginRequest {
  email: string;        // User email
  password: string;     // User password
  mfaToken?: string;    // TOTP token (if MFA enabled)
}
```

**Response (200):**
```typescript
interface LoginResponse {
  accessToken: string;       // JWT access token
  refreshToken: string;      // Refresh token
  expiresIn: number;         // Seconds until access token expiry
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
    enabledModules: string[];
    tenantId: string;
    tenantName: string;
    mfaEnabled: boolean;
  };
  requiresMfa?: boolean;     // True if MFA required but not provided
}
```

**Error Responses:**
- `401 INVALID_CREDENTIALS` - Wrong email or password
- `401 MFA_REQUIRED` - Valid credentials but MFA token needed
- `401 MFA_INVALID` - Invalid TOTP token
- `423 ACCOUNT_LOCKED` - Too many failed attempts

---

## 3.2 Finance Endpoints (Selected)

### POST /finance/journal-entries/:id/post

Post a draft journal entry to the GL. Creates financial period impact. Validates balanced debits/credits.

- **Min Role:** MANAGER
- **FR Ref:** FR12

**Path Parameters:**
- `id` (string, UUID) - Journal entry ID

**Response (200):**
```typescript
interface JournalEntry {
  id: string;
  entryNumber: string;          // e.g. "JE-000042"
  transactionDate: string;      // ISO date
  description: string;
  source: JournalSource;        // MANUAL, AR_INVOICE, AP_BILL, etc.
  sourceId?: string;
  sourceReference?: string;
  status: 'POSTED';
  postedAt: string;             // ISO datetime
  postedBy: string;
  periodId: string;
  lines: JournalLine[];
  createdAt: string;
  updatedAt: string;
}

interface JournalLine {
  id: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  debit: string;                // Decimal(19,4) as string
  credit: string;
  description: string;
  departmentCode?: string;
  tagCode?: string;
  currencyCode?: string;
  foreignAmount?: string;
  exchangeRate?: string;
}
```

**Error Responses:**
- `409 ALREADY_POSTED` - Entry is already posted
- `422 UNBALANCED_ENTRY` - Debits do not equal credits
- `423 PERIOD_LOCKED` - Target financial period is locked
- `422 MISSING_ACCOUNT_MAPPING` - Required GL account mapping not configured

---

### POST /finance/bank-reconciliations/:id/auto-match

Trigger AI-powered auto-matching of bank transactions to GL entries within a reconciliation.

- **Min Role:** MANAGER
- **FR Ref:** FR18

**Path Parameters:**
- `id` (string, UUID) - Bank reconciliation ID

**Response (200):**
```typescript
interface AutoMatchResult {
  reconciliationId: string;
  matchedCount: number;
  suggestedCount: number;
  unmatchedCount: number;
  matches: Array<{
    bankTransactionId: string;
    journalLineId: string;
    confidence: string;          // Decimal(5,2) percentage
    matchType: 'AUTO' | 'SUGGESTED';
  }>;
}
```

---

## 3.3 AR Endpoints (Selected)

### POST /ar/invoices/:id/post

Post an approved invoice. Creates GL journal entry (debit AR Control, credit Sales Revenue + VAT Output). Updates customer balance.

- **Min Role:** MANAGER
- **FR Ref:** FR20

**Path Parameters:**
- `id` (string, UUID) - Invoice ID

**Response (200):**
```typescript
interface CustomerInvoice {
  id: string;
  invoiceNumber: string;        // e.g. "INV-000123"
  invoiceType: 'STANDARD' | 'CASH' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA';
  status: 'POSTED';
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  vatAmount: string;
  totalAmount: string;
  outstandingAmount: string;
  currencyCode: string;
  exchangeRate: string;
  postedAt: string;
  journalEntryId: string;       // Created GL entry
  lines: CustomerInvoiceLine[];
}

interface CustomerInvoiceLine {
  id: string;
  lineNumber: number;
  itemId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  lineTotal: string;
  vatCodeId?: string;
  vatAmount: string;
  accountCode: string;
  departmentCode?: string;
  tagCode?: string;
}
```

**Error Responses:**
- `409 CONFLICT` - Invoice not in APPROVED status
- `423 PERIOD_LOCKED` - Financial period is locked

---

### POST /ar/payments/:id/allocate

Allocate a customer payment to one or more invoices.

- **Min Role:** STAFF
- **FR Ref:** FR21

**Request Body:**
```typescript
interface PaymentAllocationRequest {
  allocations: Array<{
    invoiceId: string;
    amount: string;              // Decimal(19,4) as string
    discountAmount?: string;     // Settlement discount
  }>;
}
```

**Response (200):**
```typescript
interface PaymentAllocationResult {
  paymentId: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  allocations: Array<{
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: string;
    discountAmount: string;
    invoiceOutstanding: string;  // Remaining after allocation
  }>;
}
```

**Error Responses:**
- `422 OVER_ALLOCATION` - Total exceeds payment amount
- `422 INVOICE_ALREADY_PAID` - Invoice has no outstanding balance

---

## 3.4 AP Endpoints (Selected)

### POST /ap/bacs-runs/:id/generate-file

Generate a BACS payment file for approved payment run.

- **Min Role:** MANAGER
- **FR Ref:** FR29

**Response (200):**
```typescript
interface BacsFileResult {
  bacsRunId: string;
  fileName: string;              // e.g. "BACS-20260216-001.csv"
  fileSize: number;              // bytes
  paymentCount: number;
  totalAmount: string;
  downloadUrl: string;           // Pre-signed download URL
  expiresAt: string;
}
```

---

## 3.5 Sales Endpoints (Selected)

### POST /sales/quotes/:id/convert-to-order

Convert an accepted sales quote to a sales order. Copies all lines, applies pricing, creates record link.

- **Min Role:** MANAGER
- **FR Ref:** FR34

**Response (201):**
```typescript
interface SalesOrder {
  id: string;
  orderNumber: string;
  status: 'DRAFT';
  customerId: string;
  customerName: string;
  orderDate: string;
  quoteId: string;               // Back-reference to source quote
  subtotal: string;
  vatAmount: string;
  totalAmount: string;
  currencyCode: string;
  lines: SalesOrderLine[];
}
```

---

### GET /sales/orders/:id/stock-check

Check stock availability for all lines on a sales order.

- **Min Role:** VIEWER
- **FR Ref:** FR38

**Response (200):**
```typescript
interface StockCheckResult {
  orderId: string;
  allAvailable: boolean;
  lines: Array<{
    lineId: string;
    itemId: string;
    itemCode: string;
    quantityOrdered: string;
    quantityOnHand: string;
    quantityReserved: string;
    quantityAvailable: string;   // ATP = onHand - reserved + onOrder
    isAvailable: boolean;
    shortfall: string;           // 0 if available
    warehouseId: string;
  }>;
}
```

---

## 3.6 AI Endpoints (Selected)

### WS /ai/chat

WebSocket connection for real-time AI conversation. Supports streaming responses.

- **Min Role:** STAFF
- **FR Ref:** FR1-FR7

**Connection:** `wss://{tenant}.nexa-erp.com/api/v1/ai/chat?token={jwt}`

**Client Messages:**
```typescript
interface AiChatClientMessage {
  type: 'message' | 'action_confirm' | 'action_reject';
  sessionId: string;
  content?: string;              // For type=message
  actionId?: string;             // For confirm/reject
}
```

**Server Messages:**
```typescript
interface AiChatServerMessage {
  type: 'text' | 'action_proposal' | 'record_created' | 'error' | 'stream_chunk' | 'stream_end';
  sessionId: string;
  messageId: string;
  content?: string;
  action?: {
    id: string;
    type: string;                // 'CREATE_INVOICE', 'SEND_EMAIL', etc.
    description: string;
    entityType: string;
    previewData: Record<string, unknown>;
    confidence: number;          // 0.0 - 1.0
  };
  record?: {
    entityType: string;
    entityId: string;
    displayRef: string;          // e.g. "INV-000042"
  };
  error?: {
    code: string;
    message: string;
  };
}
```

---

### POST /ai/predict/cash-flow

Generate AI-powered cash flow forecast based on AR, AP, committed POs, and historical patterns.

- **Min Role:** MANAGER
- **FR Ref:** FR153

**Request Body:**
```typescript
interface CashFlowForecastRequest {
  startDate: string;             // ISO date
  endDate: string;
  bankAccountIds?: string[];     // Filter to specific accounts (optional)
  includeCommittedPOs?: boolean; // Include approved POs not yet billed (default true)
  includeRecurring?: boolean;    // Include recurring payments (default true)
}
```

**Response (200):**
```typescript
interface CashFlowForecast {
  generatedAt: string;
  currency: string;
  currentBalance: string;
  periods: Array<{
    periodStart: string;
    periodEnd: string;
    openingBalance: string;
    inflows: string;
    outflows: string;
    netFlow: string;
    closingBalance: string;
    inflowDetails: Array<{
      source: string;
      amount: string;
      description: string;
    }>;
    outflowDetails: Array<{
      source: string;
      amount: string;
      description: string;
    }>;
  }>;
  alerts: Array<{
    type: 'LOW_BALANCE' | 'NEGATIVE_BALANCE' | 'COLLECTION_OPPORTUNITY';
    message: string;
    period: string;
    amount: string;
    suggestedAction?: string;
  }>;
}
```

---

## 3.7 Inventory Endpoints (Selected)

### POST /inventory/items/:id/barcode-scan

Look up an item by scanned barcode. Returns item details and current stock.

- **Min Role:** STAFF
- **FR Ref:** FR46

**Request Body:**
```typescript
interface BarcodeScanRequest {
  barcode: string;
  warehouseId?: string;          // Scope stock to warehouse
}
```

**Response (200):**
```typescript
interface BarcodeScanResult {
  item: {
    id: string;
    code: string;
    name: string;
    itemType: ItemType;
    salesPrice: string;
    costPrice: string;
    vatCodeId?: string;
  };
  stock?: {
    quantityOnHand: string;
    quantityReserved: string;
    quantityAvailable: string;
    warehouseId: string;
    warehouseName: string;
  };
}
```

---

## 3.8 HR/Payroll Endpoints (Selected)

### POST /hr/payroll-runs/:id/calculate

Run the UK payroll calculation engine for a payroll run. Calculates PAYE, NI, student loans, pension contributions, and statutory payments for all employees in the run.

- **Min Role:** MANAGER
- **FR Ref:** FR62

**Response (200):**
```typescript
interface PayrollCalculationResult {
  payrollRunId: string;
  status: 'CALCULATED';
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'FOUR_WEEKLY' | 'MONTHLY';
  periodNumber: number;
  taxYear: string;
  employeeCount: number;
  totals: {
    grossPay: string;
    totalPaye: string;
    totalEmployeeNi: string;
    totalEmployerNi: string;
    totalStudentLoan: string;
    totalEmployeePension: string;
    totalEmployerPension: string;
    totalStatutoryPay: string;
    totalNetPay: string;
    totalDeductions: string;
    totalCostToEmployer: string;
  };
  exceptions: Array<{
    employeeId: string;
    employeeName: string;
    type: string;
    message: string;
  }>;
}
```

---

### POST /hr/hmrc/fps

Generate and submit Full Payment Submission to HMRC via RTI.

- **Min Role:** ADMIN
- **FR Ref:** FR63

**Request Body:**
```typescript
interface FpsSubmissionRequest {
  payrollRunId: string;
  testSubmission?: boolean;      // Submit in test mode (default false)
}
```

**Response (202):**
```typescript
interface HmrcSubmission {
  id: string;
  submissionType: 'FPS';
  status: 'SUBMITTED';
  payrollRunId: string;
  submittedAt: string;
  correlationId: string;         // HMRC correlation ID for tracking
  employeeCount: number;
  taxYear: string;
  periodNumber: number;
}
```

---

## 3.9 Manufacturing Endpoints (Selected)

### POST /production/mrp/run

Execute the MRP engine. Analyses demand (open sales orders, forecasts) against supply (stock on hand, open POs, scheduled production) and generates suggestions.

- **Min Role:** MANAGER
- **FR Ref:** FR113

**Request Body:**
```typescript
interface MrpRunRequest {
  planningHorizonDays: number;   // How far ahead to plan (default 90)
  itemIds?: string[];            // Limit to specific items (null = all)
  warehouseIds?: string[];       // Limit to specific warehouses
  includeForecasts?: boolean;    // Include demand forecasts (default true)
}
```

**Response (200):**
```typescript
interface MrpResult {
  runId: string;
  runAt: string;
  planningHorizon: { start: string; end: string };
  suggestions: Array<{
    type: 'PRODUCE' | 'PURCHASE' | 'TRANSFER';
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: string;
    requiredByDate: string;
    reason: string;              // e.g. "Sales order demand, stock shortfall 50 units"
    recipeId?: string;
    supplierId?: string;
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
  }>;
  demandSummary: Array<{
    itemId: string;
    totalDemand: string;
    totalSupply: string;
    netRequirement: string;
  }>;
}
```

---

## 3.10 Compliance Endpoints (Selected)

### POST /compliance/vat/returns/:id/submit

Submit an approved VAT return to HMRC via MTD API.

- **Min Role:** ADMIN
- **FR Ref:** FR91

**Response (202):**
```typescript
interface VatSubmissionResult {
  vatReturnId: string;
  hmrcReceiptId: string;
  submittedAt: string;
  status: 'SUBMITTED';
  periodStart: string;
  periodEnd: string;
  vatDue: string;
  vatReclaimed: string;
  netVat: string;
}
```

**Error Responses:**
- `409 NOT_APPROVED` - VAT return must be approved before submission
- `422 MTD_NOT_CONNECTED` - HMRC MTD authorization not configured
- `502 HMRC_ERROR` - HMRC API returned an error

---

## 3.11 Document Understanding Endpoints (Selected)

### POST /documents/ingest

Upload a financial document (purchase invoice, receipt, expense, credit note) for AI-powered extraction.

- **Min Role:** STAFF
- **FR Ref:** FR164, FR165, FR166

**Request:** Multipart form data

```typescript
interface DocumentIngestRequest {
  file: File;                                  // PDF, JPEG, PNG, or TIFF (max 10MB)
  documentType?: 'PURCHASE_INVOICE' | 'RECEIPT' | 'EXPENSE_CLAIM' | 'CREDIT_NOTE';  // optional hint
  supplierId?: string;                         // optional — pre-link to known supplier
  poReference?: string;                        // optional — pre-link to PO
}
```

**Response (201):**

```typescript
interface DocumentIngestResponse {
  id: string;                                  // ingestion UUID
  status: 'PENDING' | 'PROCESSING';
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string | null;                 // detected or provided
  estimatedProcessingTime: number;             // seconds
}
```

**Error Responses:**
- `400 UNSUPPORTED_FORMAT` — File is not PDF, JPEG, PNG, or TIFF
- `400 FILE_TOO_LARGE` — File exceeds 10MB limit
- `400 UNREADABLE_DOCUMENT` — File is corrupted or unreadable
- `422 PROCESSING_FAILED` — AI extraction failed

---

### POST /documents/ingestions/:id/approve

Approve the AI-extracted record, optionally with corrections, and create the draft SupplierBill or Expense.

- **Min Role:** MANAGER
- **FR Ref:** FR166, FR167

**Path Parameters:**
- `id` (string, UUID) — Ingestion ID

**Request Body:**

```typescript
interface DocumentApproveRequest {
  corrections?: Record<string, unknown>;       // field corrections (overrides extracted values)
  targetType: 'SUPPLIER_BILL' | 'EXPENSE';    // what record to create
  supplierId?: string;                         // required if not auto-matched
  notes?: string;
}
```

**Response (200):**

```typescript
interface DocumentApproveResponse {
  ingestionId: string;
  status: 'APPROVED';
  createdRecordType: 'SupplierBill' | 'Expense';
  createdRecordId: string;
  supplierProfileUpdated: boolean;             // true if corrections improved the extraction profile
}
```

**Error Responses:**
- `404 NOT_FOUND` — Ingestion not found
- `409 INVALID_STATUS` — Ingestion is not in REVIEW or MATCHED status
- `422 MISSING_SUPPLIER` — No supplier matched and none provided

---

## 3.12 Granular RBAC & Access Group Endpoints

These endpoints manage the granular permission system introduced in Epic E2b. They replace the fixed role-based RBAC with a flexible access-group model where users can be assigned multiple access groups per company, each granting specific page/action/field-level permissions.

**Permission Guard:** All management endpoints below use `createPermissionGuard('system.access-groups.*')` instead of the legacy `createRbacGuard()`. The `ADMIN` UserCompanyRole is required for management operations; `SUPER_ADMIN` bypasses the permission matrix entirely.

**Caching:** Resolved permissions are cached in Redis with key `permissions:{userId}:{companyId}` and a 60-second TTL. The cache is invalidated whenever access groups, permissions, user group assignments, or resources are modified.

---

### GET /system/resources

List all resources (pages, reports, settings, maintenances) registered in the system. Used by the admin UI to build the permission matrix editor.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `module` | `string` | Filter by module (e.g., `sales`, `finance`, `system`) |
| `type` | `ResourceType` | Filter by type: `PAGE`, `REPORT`, `SETTING`, `MAINTENANCE` |
| `search` | `string` | Full-text search across code, name, description |
| `isActive` | `boolean` | Filter active/inactive resources (default: `true`) |

**Response (200):**
```typescript
interface ResourceListResponse {
  data: Array<{
    id: string;
    code: string;                   // Dot-notation key, e.g., "sales.orders.list"
    name: string;                   // Human-readable display name
    module: string;                 // Module grouping
    type: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
    parentCode: string | null;      // Parent resource code (detail → list)
    sortOrder: number;
    icon: string | null;
    description: string | null;
    isActive: boolean;
  }>;
  meta: { total: number };
}
```

---

### GET /system/access-groups

List access groups for the current company. Supports pagination and search.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | `string` | Pagination cursor |
| `limit` | `number` | Items per page (default 20, max 100) |
| `search` | `string` | Search by name or code |
| `isActive` | `boolean` | Filter active/inactive (default: `true`) |
| `isSystem` | `boolean` | Filter system-seeded vs custom groups |

**Response (200):**
```typescript
interface AccessGroupListResponse {
  data: Array<{
    id: string;
    code: string;                   // e.g., "SALES_MGR"
    name: string;                   // e.g., "Sales Manager"
    description: string | null;
    isSystem: boolean;              // Pre-built groups (cannot be deleted)
    isActive: boolean;
    userCount: number;              // Number of users assigned to this group
    createdAt: string;
    updatedAt: string;
  }>;
  meta: { cursor?: string; hasMore?: boolean; total?: number };
}
```

---

### GET /system/access-groups/:id

Get a single access group with its full permission matrix and field overrides.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Path Parameters:**
- `id` (string, UUID) — Access group ID

**Response (200):**
```typescript
interface AccessGroupDetailResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  companyId: string;
  permissions: Array<{
    resourceCode: string;
    resourceName: string;           // Human-readable name from Resource table
    resourceModule: string;
    resourceType: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
    canAccess: boolean;
    canNew: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
  fieldOverrides: Array<{
    resourceCode: string;
    resourceName: string;
    fieldPath: string;              // e.g., "costPrice"
    visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
  }>;
  userCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
```

**Error Responses:**
- `404 NOT_FOUND` — Access group not found or belongs to a different company

---

### POST /system/access-groups

Create a new access group for the current company.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Request Body:**
```typescript
interface CreateAccessGroupRequest {
  code: string;                     // Unique per company, UPPER_SNAKE_CASE
  name: string;                     // Display name
  description?: string;
}
```

**Response (201):**
```typescript
interface AccessGroupDetailResponse { /* same as GET :id response */ }
```

**Error Responses:**
- `409 CONFLICT` — Access group with this code already exists for the company
- `400 VALIDATION_ERROR` — Invalid code format or missing required fields

---

### PATCH /system/access-groups/:id

Update an existing access group's metadata (name, description). System groups (`isSystem: true`) can have their name and description modified but not their code.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Path Parameters:**
- `id` (string, UUID) — Access group ID

**Request Body:**
```typescript
interface UpdateAccessGroupRequest {
  name?: string;
  description?: string;
}
```

**Response (200):**
```typescript
interface AccessGroupDetailResponse { /* same as GET :id response */ }
```

**Error Responses:**
- `404 NOT_FOUND` — Access group not found
- `400 VALIDATION_ERROR` — Invalid update fields

---

### DELETE /system/access-groups/:id

Deactivate an access group (soft-delete: sets `isActive: false`). System groups (`isSystem: true`) cannot be deactivated.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Path Parameters:**
- `id` (string, UUID) — Access group ID

**Response (200):**
```typescript
interface DeactivateAccessGroupResponse {
  id: string;
  code: string;
  isActive: false;
  message: string;                  // "Access group deactivated"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Access group not found
- `409 CONFLICT` — Cannot deactivate a system access group
- `409 CONFLICT` — Access group has active users assigned (must reassign first)

---

### PUT /system/access-groups/:id/permissions

Set the full permission matrix for an access group. This is a replace-all operation: the provided array replaces all existing permissions for this group. Omitted resources have no permissions (all flags `false`).

- **Auth:** ADMIN
- **FR Ref:** FR81

**Path Parameters:**
- `id` (string, UUID) — Access group ID

**Request Body:**
```typescript
interface SetPermissionsRequest {
  permissions: Array<{
    resourceCode: string;           // Must exist in Resource table
    canAccess: boolean;
    canNew: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
}
```

**Response (200):**
```typescript
interface SetPermissionsResponse {
  accessGroupId: string;
  permissionCount: number;          // Number of resource permissions set
  permissions: Array<{
    resourceCode: string;
    resourceName: string;
    canAccess: boolean;
    canNew: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
}
```

**Error Responses:**
- `404 NOT_FOUND` — Access group not found
- `400 VALIDATION_ERROR` — One or more resourceCode values do not exist in Resource table

**Side Effects:**
- Invalidates Redis permission cache for all users assigned to this access group

---

### PUT /system/access-groups/:id/field-overrides

Set field-level visibility overrides for an access group. This is a replace-all operation: the provided array replaces all existing field overrides for this group.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Path Parameters:**
- `id` (string, UUID) — Access group ID

**Request Body:**
```typescript
interface SetFieldOverridesRequest {
  fieldOverrides: Array<{
    resourceCode: string;           // Must exist in Resource table
    fieldPath: string;              // Field identifier, e.g., "costPrice"
    visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
  }>;
}
```

**Response (200):**
```typescript
interface SetFieldOverridesResponse {
  accessGroupId: string;
  overrideCount: number;
  fieldOverrides: Array<{
    resourceCode: string;
    resourceName: string;
    fieldPath: string;
    visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
  }>;
}
```

**Error Responses:**
- `404 NOT_FOUND` — Access group not found
- `400 VALIDATION_ERROR` — One or more resourceCode values do not exist in Resource table

**Side Effects:**
- Invalidates Redis permission cache for all users assigned to this access group

---

### GET /system/users/:id/access-groups

Get the access groups assigned to a specific user for the current company context.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Path Parameters:**
- `id` (string, UUID) — User ID

**Response (200):**
```typescript
interface UserAccessGroupsResponse {
  userId: string;
  companyId: string;
  accessGroups: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    assignedBy: string;             // Who assigned this group
    assignedAt: string;             // When it was assigned (createdAt of UserAccessGroup)
  }>;
}
```

**Error Responses:**
- `404 NOT_FOUND` — User not found

---

### PUT /system/users/:id/access-groups

Assign access groups to a user for the current company. This is a replace-all operation: the provided array replaces all current access group assignments for this user in this company.

- **Auth:** ADMIN
- **FR Ref:** FR81

**Path Parameters:**
- `id` (string, UUID) — User ID

**Request Body:**
```typescript
interface AssignAccessGroupsRequest {
  accessGroupIds: string[];         // Array of AccessGroup UUIDs to assign
}
```

**Response (200):**
```typescript
interface AssignAccessGroupsResponse {
  userId: string;
  companyId: string;
  accessGroups: Array<{
    id: string;
    code: string;
    name: string;
    assignedBy: string;
    assignedAt: string;
  }>;
}
```

**Error Responses:**
- `404 NOT_FOUND` — User not found
- `400 VALIDATION_ERROR` — One or more access group IDs are invalid or belong to a different company
- `422 BUSINESS_RULE_VIOLATION` — Cannot leave a user with zero access groups (assign at least one)

**Side Effects:**
- Invalidates Redis permission cache for this user in this company

---

### GET /system/company-profile/export-defaults

Export the current company's configuration (resources, access groups, permissions, field overrides, VAT codes, payment terms, number series, currencies) as a default data JSON file. Used for creating company templates or backing up configuration.

- **Auth:** ADMIN
- **FR Ref:** FR83

**Response (200):**
```typescript
interface ExportDefaultsResponse {
  version: string;                  // Schema version, e.g., "1.0.0"
  description: string;
  exportedAt: string;               // ISO datetime
  exportedFrom: string;             // Company name
  resources: Array<{
    code: string;
    name: string;
    module: string;
    type: 'PAGE' | 'REPORT' | 'SETTING' | 'MAINTENANCE';
    sortOrder: number;
  }>;
  accessGroups: Array<{
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    permissions: Array<{
      resourceCode: string;
      canAccess: boolean;
      canNew: boolean;
      canView: boolean;
      canEdit: boolean;
      canDelete: boolean;
    }>;
    fieldOverrides: Array<{
      resourceCode: string;
      fieldPath: string;
      visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
    }>;
  }>;
  vatCodes: Array<{ code: string; name: string; rate: number; type: string; isDefault: boolean }>;
  paymentTerms: Array<{ code: string; name: string; dueDays: number; isDefault: boolean }>;
  numberSeries: Array<{ entityType: string; prefix: string; padding: number }>;
  currencies: Array<{ code: string; name: string; symbol: string; minorUnit: number }>;
}
```

**Notes:**
- The response content type is `application/json` with `Content-Disposition: attachment; filename="company-defaults-{companySlug}.json"`

---

### POST /system/company-profile/import-defaults

Import default data into the current company. Performs upsert operations: existing records matched by code are updated, new records are created. Does not delete records that are absent from the import file.

- **Auth:** ADMIN
- **FR Ref:** FR83

**Request Body:** Multipart form data or inline JSON matching the export format.

```typescript
interface ImportDefaultsRequest {
  file?: File;                      // JSON file upload (multipart)
  data?: ExportDefaultsResponse;    // Inline JSON (alternative to file)
  dryRun?: boolean;                 // If true, validate without applying (default: false)
}
```

**Response (200):**
```typescript
interface ImportDefaultsResponse {
  status: 'APPLIED' | 'DRY_RUN';
  summary: {
    resourcesCreated: number;
    resourcesUpdated: number;
    accessGroupsCreated: number;
    accessGroupsUpdated: number;
    permissionsSet: number;
    fieldOverridesSet: number;
    vatCodesCreated: number;
    vatCodesUpdated: number;
    paymentTermsCreated: number;
    paymentTermsUpdated: number;
    numberSeriesCreated: number;
    numberSeriesUpdated: number;
    currenciesCreated: number;
    currenciesUpdated: number;
  };
  warnings: string[];              // Non-fatal issues (e.g., "Skipped unknown resource type")
}
```

**Error Responses:**
- `400 VALIDATION_ERROR` — Invalid JSON structure or missing required fields
- `400 UNSUPPORTED_VERSION` — Default data file version not supported

---

### GET /system/my-permissions

Get the current authenticated user's resolved permissions for the current company. This is the primary endpoint the frontend calls on login and after context switches to determine navigation visibility, action bar configuration, and field visibility.

- **Auth:** Authenticated (any role)
- **FR Ref:** FR81

**Response (200):**
```typescript
interface MyPermissionsResponse {
  userId: string;
  companyId: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
  isSuperAdmin: boolean;            // If true, all permissions are granted (bypass)
  accessGroups: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  permissions: Record<string, {     // Keyed by resourceCode
    canAccess: boolean;
    canNew: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
  fieldOverrides: Record<string, Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>>;
  // Outer key: resourceCode, inner key: fieldPath
  enabledModules: string[];         // Derived: modules where at least one resource has canAccess=true
}
```

**Notes:**
- For `SUPER_ADMIN` users, `permissions` contains all resources with all flags `true`, and `fieldOverrides` is empty (all fields visible).
- The `enabledModules` array is computed server-side from the permission matrix: a module is "enabled" if the user has `canAccess: true` on at least one resource in that module. This replaces the previous `User.enabledModules` JSON field.
- This response is cached in Redis for 60 seconds. The frontend should call this endpoint on login, on company context switch, and when it receives a `PERMISSIONS_CHANGED` WebSocket event.

---

## 3.13 Views, Filters & Columns Endpoints

These endpoints support the metadata-driven DataTable system (Epic E7). A single `data_view_fields` table defines every column for every list page — when a new module is added, developers seed rows; zero custom UI code per entity.

**Caching:** DataView metadata and DateRangePresets are cached in Redis with 1-hour TTL. Saved views use TanStack Query with staleTime 30s.

---

### GET /views/init

Bundled initialisation endpoint. Returns everything a list page needs in a single call: the data_view definition, all field metadata, date range presets, and the user's saved views. **This is the primary endpoint called on every T1 Entity List page mount.**

- **Auth:** VIEWER
- **FR Ref:** FR86

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `viewKey` | `string` | **Required.** e.g. `INVOICES`, `CUSTOMERS` |

**Response (200):**
```typescript
interface ViewInitResponse {
  dataView: {
    id: string;
    viewKey: string;
    viewName: string;
    entityTable: string;
    idField: string;
    defaultSortField: string;
    defaultSortDir: 'ASC' | 'DESC';
  };
  fields: Array<{
    id: string;
    fieldKey: string;
    fieldLabel: string;
    fieldType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'ENUM' | 'CURRENCY';
    defaultVisible: boolean;
    defaultOrder: number;
    defaultWidth: number;
    sortable: boolean;
    filterable: boolean;
    advancedFilterOnly: boolean;
    pinnable: boolean;
    lovType: 'NONE' | 'STATIC' | 'GLOBAL' | 'VIEW_SPECIFIC';
    lovScope: string | null;
    lovStaticValues: Array<{ value: string; label: string }> | null;
    lovDependsOn: string | null;
    lovSearchMin: number;
  }>;
  datePresets: Array<{
    id: string;
    presetKey: string;
    presetName: string;
    orderInList: number;
  }>;
  savedViews: Array<{
    id: string;
    name: string;
    groupName: string;
    scope: 'PERSONAL' | 'ROLE' | 'GLOBAL';
    isFavourite: boolean;
    favouriteOrder: number;
    isDefault: boolean;
    filterLogic: 'AND' | 'OR';
    sortConfig: Array<{ field: string; direction: 'ASC' | 'DESC'; priority: number }>;
    columnConfig: Array<{ fieldId: string; visible: boolean; order: number; width: number; pinned: 'NONE' | 'LEFT' | 'RIGHT' }>;
    conditions: Array<{
      id: string;
      dataViewFieldId: string;
      operator: string;
      value: string | null;
      valueList: string[] | null;
      datePresetId: string | null;
      groupId: number;
      groupLogic: 'AND' | 'OR';
      outerLogic: 'AND' | 'OR';
      conditionOrder: number;
    }>;
  }>;
  userColumnPreferences: Array<{
    dataViewFieldId: string;
    visible: boolean;
    displayOrder: number;
    width: number;
    pinned: 'NONE' | 'LEFT' | 'RIGHT';
  }> | null;
}
```

**Performance Notes:**
- Redis-cached metadata (1hr TTL) for `dataView`, `fields`, `datePresets`
- `savedViews` and `userColumnPreferences` are always fresh (user-specific)
- Typical response: ~5-15KB, <50ms

---

### POST /views/saved

Create a new saved view with filter conditions, sort config, and column config.

- **Auth:** STAFF (ADMIN required for scope = GLOBAL)
- **FR Ref:** FR86

**Request Body:**
```typescript
interface CreateSavedViewRequest {
  viewKey: string;
  name: string;
  groupName: string;
  scope: 'PERSONAL' | 'ROLE' | 'GLOBAL';
  roleId?: string;                   // Required when scope = ROLE
  isFavourite?: boolean;
  isDefault?: boolean;
  filterLogic: 'AND' | 'OR';
  sortConfig: Array<{ field: string; direction: 'ASC' | 'DESC'; priority: number }>;
  columnConfig: Array<{ fieldId: string; visible: boolean; order: number; width: number; pinned: 'NONE' | 'LEFT' | 'RIGHT' }>;
  conditions: Array<{
    dataViewFieldId: string;
    operator: string;
    value?: string;
    valueList?: string[];
    datePresetId?: string;
    groupId?: number;
    groupLogic?: 'AND' | 'OR';
    outerLogic?: 'AND' | 'OR';
    conditionOrder: number;
  }>;
}
```

**Response (201):** Full SavedView object (same shape as in ViewInitResponse.savedViews).

**Error Responses:**
- `409 DUPLICATE_NAME` — View with same name already exists for this user + data_view
- `403 FORBIDDEN` — Non-admin trying to create GLOBAL view

---

### POST /views/lov/batch

Batch-fetch LOV data for multiple fields in a single request. Used when the filter modal opens to preload all dropdown values.

- **Auth:** VIEWER
- **FR Ref:** FR86

**Request Body:**
```typescript
interface BatchLovRequest {
  items: Array<{
    fieldId: string;
    lovScope: string;
    search?: string;            // For server-side search
    parentValue?: string;       // For dependent LOVs
    limit?: number;             // Default 50
  }>;
}
```

**Response (200):**
```typescript
interface BatchLovResponse {
  results: Record<string, Array<{
    value: string;
    label: string;
  }>>;  // Keyed by fieldId
}
```

---

### PATCH /views/columns/:viewKey/:fieldId/width

Update a single column width after drag-resize. Lightweight endpoint for real-time persistence.

- **Auth:** STAFF
- **FR Ref:** FR86

**Request Body:**
```typescript
interface UpdateColumnWidthRequest {
  width: number;   // Pixel width, min 40, max 800
}
```

**Response (200):** `{ success: true }`

---
