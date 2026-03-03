# Currencies, FX, and Time Zones

**Last updated:** 2025-11-29  
**Applies to:** All users, Tenant admins, SUPER_ADMIN

---

## Multi-Currency Support

### Base Currency Configuration

**Setting the Tenant Base Currency:**
- Navigate to **Admin** → **Tenants** → Select a tenant
- Find the **Base Currency** field
- Select the base currency from the dropdown (e.g., GBP, USD, EUR)
- **Important:** Changing the base currency is a **high-risk** operation and requires:
  - Explicit typed confirmation ("CONFIRM")
  - Re-authentication (password confirmation)
  - Audit logging with before/after snapshots

**What Base Currency Affects:**
- All financial calculations and reporting
- Default currency for new transactions
- Currency conversion in reports and dashboards
- AI responses that include monetary amounts

### Additional Currencies

- Additional currencies are configured via reference data seeding
- FX rates are required for any currency pair used in conversions
- Currencies are stored in the `Currency` table with ISO codes (e.g., GBP, USD, EUR)

### Currency Display

- Users can set their preferred currency in **Profile** → **Preferences**
- This affects display only, not calculations
- Reports and dashboards show amounts in the tenant's base currency by default

---

## Foreign Exchange (FX) Rates

### FX Rate Storage

- FX rates are stored in the `FxRate` table
- Each rate includes:
  - **From Currency:** Source currency (e.g., GBP)
  - **To Currency:** Target currency (e.g., USD)
  - **Rate:** Exchange rate (e.g., 1.25 means 1 GBP = 1.25 USD)
  - **Effective Date:** Date when the rate becomes effective

### FX Rate Loading

**Reference Data:**
- FX rates are loaded as part of reference data seeding (Task C)
- Rates are typically loaded for common currency pairs (G20 currencies)
- Historical rates can be loaded for past dates

**Manual Updates:**
- FX rates can be updated manually via database scripts or admin tools
- Rates should be updated regularly to reflect current market conditions
- Historical rates are preserved for accurate past-date conversions

### FX Conversion

**How Conversion Works:**
- The system uses a centralised FX conversion service (`convertCurrency`)
- Conversion uses the most recent FX rate on or before the specified date
- If no rate is found, an error is thrown
- Same-currency conversions return a rate of 1.0 (no conversion)

**Where FX is Applied:**
- **Reports:** Multi-currency amounts are converted to base currency
- **Dashboards:** Currency amounts are normalised to base currency
- **AI Responses:** AI receives pre-converted amounts with explicit currency labels
- **Transactions:** FX conversion is applied when recording cross-currency transactions

**Example:**
- Tenant base currency: GBP
- Transaction amount: 100 USD
- FX rate (GBP/USD): 0.80 (1 USD = 0.80 GBP)
- Converted amount: 80 GBP

---

## Time Zones

### Tenant Timezone Configuration

**Setting the Default Timezone:**
- Navigate to **Admin** → **Tenants** → Select a tenant
- Find the **Default Timezone** field
- Select a timezone from the dropdown (e.g., Europe/London, America/New_York)
- **Important:** Changing the default timezone is a **high-risk** operation and requires:
  - Explicit typed confirmation ("CONFIRM")
  - Re-authentication (password confirmation)
  - Audit logging with before/after snapshots

**What Default Timezone Affects:**
- Date/time display across the tenant
- Report generation timestamps
- "Today" boundaries in queries
- Audit log timestamps

### User Timezone Override

**Setting Your Preferred Timezone:**
- Go to **Profile** → **Preferences**
- Select your preferred timezone from the dropdown
- Click **"Save"** to apply

**How User Timezone Works:**
- User timezone overrides tenant default timezone for display purposes
- If no user timezone is set, tenant default timezone is used
- If no tenant timezone is set, system default (Europe/London) is used
- Timezone preferences affect:
  - Date/time display in UI components
  - Chat message timestamps
  - Call log timestamps
  - Audit log display

### UTC Persistence

**Important:** All timestamps are stored in UTC in the database:
- Transaction dates are stored as UTC timestamps
- Chat messages are stored with UTC timestamps
- Call logs use UTC timestamps
- Audit logs use UTC timestamps
- This ensures consistency across timezones and daylight saving changes

**Display:**
- UTC timestamps are converted to tenant/user timezone for display
- The `FormattedDate` component handles timezone conversion automatically
- Date/time formatting respects user preferences (date-only, time-only, or full date/time)

---

## Impact on Modules

### Finance

**Transaction Dates:**
- All transaction dates are stored in UTC
- Display uses tenant/user timezone
- Reports show dates in tenant timezone

**Currency Amounts:**
- Multi-currency transactions are converted to base currency for reporting
- FX rates are applied based on transaction date
- AI responses include converted amounts with currency labels

**Examples:**
- Invoice dated 2025-11-29 14:00 UTC → Displayed as 2025-11-29 14:00 GMT (if tenant timezone is Europe/London)
- Payment of 100 USD → Converted to 80 GBP (if base currency is GBP and rate is 0.80)

### Inventory

**Stock Movement Dates:**
- Receipt dates, issue dates, and adjustment dates are stored in UTC
- Display uses tenant/user timezone
- Inventory reports show dates in tenant timezone

### Projects and Timesheets

**Timesheet Dates:**
- Timesheet entries use UTC timestamps
- Display respects user timezone preferences
- Project reports show dates in tenant timezone

### Chat and Calls

**Message Timestamps:**
- Chat messages are stored with UTC timestamps
- Display uses tenant/user timezone
- Call logs use UTC timestamps for start/end times
- Participant join/leave times are stored in UTC

**Example:**
- Message sent at 2025-11-29 14:00 UTC → Displayed as 2025-11-29 14:00 GMT (if user timezone is Europe/London)

### Audit Logs

**Log Timestamps:**
- All audit log entries use UTC timestamps
- Display uses tenant/user timezone
- SUPER_ADMIN audit views show timestamps in tenant timezone

---

## AI Behaviour

### FX Handling in AI

**Pre-Converted Values:**
- AI receives pre-converted amounts with explicit currency labels
- AI does **not** perform its own FX conversion
- AI responses include currency information (e.g., "£80 GBP" or "100 USD")

**Date Boundaries:**
- AI queries like "today's sales" use UTC date boundaries
- Dates are formatted in tenant timezone for display
- AI is instructed not to invent its own FX rates or date calculations

**Example AI Response:**
- User asks: "What were today's sales?"
- AI receives: Pre-converted amounts in base currency (GBP) with timestamps
- AI responds: "Today's sales total £1,250 GBP across 15 transactions"

### AI Date Formatting

- AI uses `formatDateForTenant` helper to format dates in tenant timezone
- Dates are formatted consistently across all AI responses
- Timezone information is included when relevant (e.g., "2:00 PM GMT")

---

## Best Practices

### For Tenant Administrators

1. **Set Base Currency Early:**
   - Configure base currency during tenant setup
   - Avoid changing base currency after transactions are recorded
   - If change is necessary, ensure all historical data is converted

2. **Keep FX Rates Updated:**
   - Regularly update FX rates for active currency pairs
   - Load historical rates for accurate past-date conversions
   - Monitor FX rate validity dates

3. **Configure Default Timezone:**
   - Set tenant default timezone during setup
   - Choose a timezone that matches your primary business location
   - Avoid frequent timezone changes (high-risk operation)

### For Users

1. **Set Your Preferred Timezone:**
   - Configure your timezone in Profile → Preferences
   - This ensures dates/times display correctly for your location
   - User timezone overrides tenant default for your view

2. **Understand Currency Display:**
   - Reports show amounts in tenant base currency
   - Multi-currency transactions are converted using FX rates
   - AI responses include currency labels for clarity

---

## Related Documentation

- [Profile, Tenant, and AI Preferences](./profile-tenant-ai-preferences.md) — User profile and preferences
- [AI Engine Behaviour](./ai-engine-behaviour.md) — How AI handles FX and dates
- [SUPER_ADMIN Handbook](./super-admin-handbook.md) — Tenant configuration

---

## Notes

- All timestamps are persisted in UTC (Task F1 requirement)
- FX conversion is centralised and uses seeded rates (Task F1 requirement)
- Timezone rendering is applied across Finance, Inventory, Chat/Calls, Projects, and Audit logs (Task F1 requirement)
- FX rates must be seeded before FX conversion can be used
- The FX converter test conditionally skips when reference rates are not present in the test environment

