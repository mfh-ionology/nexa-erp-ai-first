# SUPER_ADMIN Configuration Scenario

## Purpose
This document describes how SUPER_ADMIN configures verticals and ensures operational flows work entirely with ADMIN/STAFF roles.

## SUPER_ADMIN Configuration Tasks

### 1. Module Configuration
**Module**: SUPER_ADMIN → Modules
**Actions**:
1. Navigate to SUPER_ADMIN → Modules
2. Enable required modules for each vertical:
   - **Core SME**: Finance, Inventory, Sales, Manufacturing, Projects
   - **Supply Chain**: Purchasing, Inventory, Supply Chain, Logistics
   - **Healthcare**: Healthcare, Finance, Appointments, Billing
3. Disable modules not needed for each vertical
4. Save configuration

**Expected State**:
- Modules enabled/disabled per vertical
- Configuration saved and applied to tenants

### 2. Role and Permission Configuration
**Module**: SUPER_ADMIN → Security & Access → Roles
**Actions**:
1. Navigate to SUPER_ADMIN → Security & Access → Roles
2. Review default roles (ADMIN, MANAGER, STAFF, VIEWER)
3. Verify permissions for each role:
   - ADMIN: Full access to operational modules
   - STAFF: Limited access (can fulfil orders, receive goods, but cannot approve)
4. Create custom roles if needed for specific verticals
5. Save role configuration

**Expected State**:
- Roles configured with appropriate permissions
- ADMIN can perform all operational tasks
- STAFF can perform limited operational tasks

### 3. Workflow Configuration
**Module**: SUPER_ADMIN → Global Configuration → Workflows
**Actions**:
1. Navigate to SUPER_ADMIN → Global Configuration → Workflows
2. Configure approval workflows:
   - Purchase Order approval (requires ADMIN)
   - Invoice approval (requires ADMIN)
   - Expense approval (requires ADMIN)
3. Set workflow defaults for each vertical
4. Save workflow configuration

**Expected State**:
- Workflows configured
- Approval rules set per vertical

### 4. Tax and Numbering Configuration
**Module**: SUPER_ADMIN → Global Configuration → Tax Rules
**Actions**:
1. Navigate to SUPER_ADMIN → Global Configuration → Tax Rules
2. Configure VAT rates (20% standard, 5% reduced, 0% zero-rated)
3. Configure tax codes per vertical
4. Navigate to Numbering Schemes
5. Configure numbering schemes:
   - Invoice numbers: INV-{YYYY}-{####}
   - Order numbers: SO-{YYYY}-{####}
   - PO numbers: PO-{YYYY}-{####}
6. Save configuration

**Expected State**:
- Tax rules configured
- Numbering schemes configured
- Configuration applied to tenants

### 5. Tenant-Specific Configuration
**Module**: SUPER_ADMIN → Tenant & Environments
**Actions**:
1. Navigate to SUPER_ADMIN → Tenant & Environments
2. Select tenant (e.g., NEXA_DEMO)
3. Configure tenant-specific settings:
   - Base currency: GBP
   - Timezone: Europe/London
   - Date format: DD/MM/YYYY
   - Module toggles (as per Step 1)
4. Save tenant configuration

**Expected State**:
- Tenant configuration saved
- Settings applied to tenant

## Operational Restrictions

### Current Limitations (Pre-D8)
**Note**: Full operational restrictions for SUPER_ADMIN will be implemented in Task D8. Current state:

- SUPER_ADMIN can technically perform operational actions (create invoices, orders, etc.)
- However, vertical scenario tests (D5.2) prove that all operational flows work with ADMIN/STAFF only
- SUPER_ADMIN is not required for any operational step in the vertical scenarios

### Post-D8 Expected Behavior
- SUPER_ADMIN will be blocked from performing operational actions by default
- SUPER_ADMIN will require explicit "test/operational mode" with re-auth to perform operational actions
- All operational actions performed by SUPER_ADMIN will be flagged in audit logs

## Verification

### Configuration Verification
1. As SUPER_ADMIN, verify all configuration changes are saved
2. As ADMIN, verify configuration is applied (modules enabled, workflows active)
3. As STAFF, verify permissions are correctly restricted

### Operational Flow Verification
1. Run vertical scenario tests (D5.2) as ADMIN/STAFF
2. Verify all flows complete without SUPER_ADMIN intervention
3. Verify no SUPER_ADMIN menu items appear for ADMIN/STAFF
4. Verify SUPER_ADMIN can configure but does not need to operate

## Expected End State
- All verticals configured via SUPER_ADMIN
- ADMIN/STAFF can complete all operational flows
- SUPER_ADMIN only used for configuration
- No operational actions require SUPER_ADMIN (except in test/operational mode post-D8)

