# Epic E4: i18n Infrastructure

**Tier:** 1 | **Dependencies:** E2 (Auth + Multi-Company RBAC) | **FRs:** FR178-FR180 | **NFRs:** NFR41 (TypeScript strict)

---

## Story E4.S1: Translation Key System

**User Story:** As a developer, I want a centralised translation key system with `t()` helper and English locale files, so that all user-facing strings are internationalisation-ready from day one.

**Acceptance Criteria:**
1. GIVEN the web application is loaded WHEN any UI component renders a user-facing string THEN it uses the `t('namespace.key')` helper, never a hardcoded string
2. GIVEN an English locale file exists at `locales/en.json` WHEN a translation key is resolved THEN the English text is returned
3. GIVEN a translation key that does not exist in the current locale WHEN the `t()` helper is called THEN it falls back through the chain: user locale -> company locale -> `en`, and logs a missing-key warning in development mode
4. GIVEN the React application WHEN `t()` is called with interpolation parameters THEN variables are substituted correctly (e.g., `t('validation.required', { field: t('field.customerName') })` returns "Customer Name is required")
5. GIVEN a developer adds a new UI component WHEN they use a hardcoded English string instead of `t()` THEN the ESLint rule `no-raw-text` flags it as an error

**Key Tasks:**
- [ ] Install and configure i18next (or react-intl) with React integration in `apps/web` (AC: #1, #2)
  - [ ] Create `packages/i18n` shared package for locale types and key registry
  - [ ] Configure i18next provider wrapping the React app root
  - [ ] Set up namespace-based key organisation (e.g., `common`, `validation`, `finance`, `ar`)
- [ ] Create English base locale file structure at `packages/i18n/locales/en/` (AC: #2)
  - [ ] Create `common.json` with shared labels (Save, Cancel, Delete, Confirm, etc.)
  - [ ] Create `validation.json` with validation message templates
  - [ ] Create `navigation.json` with module and page names
- [ ] Implement fallback chain: user language -> company language -> `en` (AC: #3)
  - [ ] Read user locale preference from auth context
  - [ ] Read company default locale from company profile
  - [ ] Configure i18next fallback order
  - [ ] Add missing-key logging in development mode
- [ ] Implement interpolation support and pluralisation rules (AC: #4)
- [ ] Add ESLint rule to prevent hardcoded strings in JSX/TSX (AC: #5)
  - [ ] Configure `eslint-plugin-i18next` or custom rule
  - [ ] Add to shared ESLint config in `packages/eslint-config`

**FR/NFR:** FR178; NFR41

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §5.1 State Management | React app structure, Vite + React 19 |
| API Contracts | §1 Overview | N/A for this story — frontend only |
| Data Models | §3.1 System Module | CompanyProfile.baseCurrencyCode, timezone |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | §Design System Foundation | All UI text via translation keys |
| Project Context | §3 i18n / Localization Infrastructure | `t('key')` pattern, fallback chain, English-only MVP |

---

## Story E4.S2: Backend i18n

**User Story:** As a developer, I want API error messages, validation messages, and system messages to use translation keys, so that the backend is language-agnostic and ready for future locale support.

**Acceptance Criteria:**
1. GIVEN a validation error occurs on the API WHEN the error response is returned THEN the `message` field contains a translation key (e.g., `"validation.required"`) with parameters, not a hardcoded English string
2. GIVEN the API returns a structured error WHEN the frontend receives it THEN it can resolve the translation key via the `t()` helper to display the localised message
3. GIVEN a system-generated message (e.g., audit log description, notification text) WHEN it is persisted to the database THEN it stores a translation key and parameters, not rendered text
4. GIVEN a backend service needs to format a user-facing message WHEN it calls the message formatting utility THEN it produces a structured `{ key: string, params?: Record<string, string> }` object

**Key Tasks:**
- [ ] Create `packages/i18n` backend utilities for message key construction (AC: #1, #4)
  - [ ] Define `TranslationMessage` type: `{ key: string; params?: Record<string, string> }`
  - [ ] Create helper functions: `validationMsg()`, `errorMsg()`, `systemMsg()`
- [ ] Update `AppError` and `ValidationError` classes to carry translation keys (AC: #1, #2)
  - [ ] Modify error response envelope to include `messageKey` and `messageParams`
  - [ ] Ensure `details` field-level errors also use translation keys
- [ ] Update Zod validation error transformer to emit translation keys (AC: #1)
  - [ ] Map Zod error codes to translation keys (e.g., `ZodIssueCode.too_small` -> `"validation.minLength"`)
- [ ] Create backend English locale file for server-side message rendering (AC: #3)
  - [ ] Used only for email rendering and PDF generation where server must produce final text

**FR/NFR:** FR178; NFR41, NFR45

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §4 API & Communication Patterns | Error response envelope, Zod validation |
| API Contracts | §1 Overview, Common Error Codes | Error envelope `{ code, message, details }` |
| Data Models | N/A | N/A — no model changes |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | N/A | N/A — no business rules |
| UX Design Spec | N/A | N/A — backend story |
| Project Context | §3 i18n / Localization Infrastructure | Translation key system, all strings via `t()` |

---

## Story E4.S3: Number/Date/Currency Formatting

**User Story:** As a user, I want numbers, dates, and currency values to be formatted according to my locale settings, so that financial data is displayed in a familiar format.

**Acceptance Criteria:**
1. GIVEN a user with locale `en-GB` WHEN a monetary value of 1234.56 GBP is displayed THEN it renders as "£1,234.56"
2. GIVEN a user with locale `en-GB` WHEN a date of 2026-02-17 is displayed THEN it renders as "17/02/2026" (DD/MM/YYYY)
3. GIVEN a currency with `minorUnit = 0` (e.g., JPY) WHEN an amount is displayed THEN it shows no decimal places
4. GIVEN the `Intl` API WHEN formatting numbers THEN it uses the user's locale for thousands separator and decimal point
5. GIVEN a formatting utility WHEN called from both web and mobile apps THEN it produces consistent output (shared package)

**Key Tasks:**
- [ ] Create `packages/shared/src/formatters/` with locale-aware formatters (AC: #1, #2, #4, #5)
  - [ ] `formatCurrency(amount: Decimal, currencyCode: string, locale: string): string`
  - [ ] `formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string`
  - [ ] `formatDate(date: Date | string, locale: string, format?: 'short' | 'medium' | 'long'): string`
  - [ ] `formatPercent(value: number, locale: string): string`
- [ ] Integrate `Currency.minorUnit` from data model for decimal place control (AC: #3)
  - [ ] Fetch currency metadata (minorUnit, symbol) and cache in React Query
- [ ] Create React hooks: `useFormatCurrency()`, `useFormatDate()`, `useFormatNumber()` (AC: #1, #2)
  - [ ] Hooks read current locale from i18n context
- [ ] Write unit tests for edge cases: JPY (0 decimals), BHD (3 decimals), negative amounts (AC: #3)

**FR/NFR:** FR180; NFR38 (fixed-point decimal)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.1 Monetary Value Representation | Decimal(19,4), no floating-point |
| API Contracts | §1 Data Conventions | Monetary as string Decimal(19,4), dates ISO 8601 |
| Data Models | §3.1 System Module | Currency.minorUnit, Currency.symbol |
| State Machines | N/A | N/A — no state transitions |
| Event Catalog | N/A | N/A — no events emitted |
| Business Rules | §14 Implicit Rules | IMP-002: All monetary fields Decimal(19,4) |
| UX Design Spec | §Design System Foundation | Consistent number/date formatting across all screens |
| Project Context | §3 i18n / Localization Infrastructure | `Intl` API, locale-based formatting |

---
