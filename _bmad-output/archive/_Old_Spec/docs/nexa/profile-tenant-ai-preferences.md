# Profile, Tenant, and AI Preferences

**Last updated:** 2025-11-29  
**Applies to:** All users, Tenant admins, SUPER_ADMIN

---

## User Profile

### Accessing Your Profile

Navigate to **Profile** from the main navigation menu (or go to `/profile`). The profile page displays:

- **Email:** Your account email address (read-only)
- **Role:** Your current role (USER, ADMIN, MANAGER, STAFF, VIEWER, or SUPER_ADMIN)
- **Tenant:** Your tenant identifier

### Updating Profile Information

**Email and Role:**
- Email addresses and roles are managed by tenant administrators or SUPER_ADMIN
- Regular users cannot change their own email or role
- To request changes, contact your tenant administrator

**Password:**
- Use the **Security** section on the Profile page
- Click **"Send reset email"** to receive a password reset link
- Password reset emails are sent to your registered email address

**Display Preferences:**
- **Timezone:** Select your preferred timezone from the dropdown (affects date/time display)
- **Currency:** Choose your preferred currency for display (G20 currencies available)
- **Background:** Customise the application background (solid colour, gradient, image, or upload)
- **AI Theme:** Generate a custom theme using an AI prompt (deterministic, offline generation)

Preferences are saved automatically when you click **"Save"** in the Preferences section.

---

## Multi-Factor Authentication (MFA)

### SUPER_ADMIN MFA Requirements

- **SUPER_ADMIN users must have MFA enabled** before they can log in
- If MFA is not enabled, login will be blocked
- MFA is centrally managed and configured by system administrators
- SUPER_ADMIN users cannot disable their own MFA

### Regular Users

- MFA is not currently user-configurable for regular users
- MFA is centrally managed by administrators
- Contact your tenant administrator if you need MFA enabled for your account

---

## AI User Preferences

### Accessing AI Preferences

Go to **Profile** → **AI Preferences** section (at the bottom of the profile page).

### Configurable Settings

**Your Role:**
- Enter a free-text description of your role (e.g., "Finance Manager", "Operations Lead")
- This helps the AI tailor responses to your responsibilities
- Optional field

**Experience Level:**
- **Beginner:** AI provides more detailed explanations and step-by-step guidance
- **Intermediate:** Balanced explanations suitable for users familiar with ERP concepts
- **Advanced:** Concise, technical responses for experienced users
- Default: Intermediate

**Answer Style:**
- **Concise:** Short, direct answers
- **Balanced:** Moderate detail (default)
- **Detailed:** Comprehensive explanations with context

### Saving AI Preferences

- Click **"Save AI Preferences"** to apply changes
- **Important:** Changes to AI preferences require re-authentication (password confirmation) if your session is older than 10 minutes
- This is a security measure to protect your AI settings

### How Preferences Affect AI Responses

- **Role:** Used to provide context-aware responses (e.g., finance-focused answers for finance managers)
- **Experience Level:** Adjusts the technical depth of explanations
- **Answer Style:** Controls the verbosity and detail level of responses

### AI History

- AI prompts and responses are logged for audit purposes
- For healthcare tenants, Protected Health Information (PHI) is redacted before logging
- Users cannot clear their own AI history (managed by administrators)
- AI history is visible to SUPER_ADMIN in audit logs

---

## Tenant AI Controls

### Accessing Tenant AI Configuration

Tenant administrators and SUPER_ADMIN can configure tenant-wide AI settings:

1. Navigate to **Admin** → **Tenants** → Select a tenant
2. Scroll to the **Healthcare Mode** section (if applicable)

### Healthcare Mode

**Enabling Healthcare Mode:**
- Check the **"Enable healthcare mode"** checkbox
- Optionally provide:
  - **PCN ID:** Primary Care Network identifier
  - **Practice Count:** Number of practices in the network

**What Healthcare Mode Does:**
- **AI Constraints:** Enforces operational-only AI assistance
  - AI will **not** provide medical diagnosis or treatment recommendations
  - AI will **not** make clinical judgements or interpret clinical data
  - AI will **only** provide operational assistance (e.g., rota coverage counts, scheduling help)
- **PHI Redaction:** Protected Health Information is automatically redacted from AI logs
  - Redacted information includes: names, NHS numbers, phone numbers, email addresses, postcodes, clinical notes
- **Important:** Nexa ERP is **not a medical device** and must not be used for clinical diagnosis or treatment decisions

**Changing Healthcare Mode:**
- Healthcare mode changes are **high-risk** and require:
  - Explicit typed confirmation ("CONFIRM")
  - Re-authentication (password confirmation)
  - Audit logging with before/after snapshots
- Impact summary will be shown before confirmation

### Module Enablement

- Tenant administrators can enable/disable modules via **Settings** → **Modules**
- Disabled modules are hidden from navigation and unavailable to users
- Module changes are logged for audit purposes

### AI Model and Privacy Settings

- AI model selection and privacy/retention flags are configured at the system level
- Tenant administrators cannot change these settings
- Contact SUPER_ADMIN for model or privacy configuration changes

---

## Examples

### Example 1: Setting Up AI Preferences for a Finance Manager

1. Go to **Profile** → **AI Preferences**
2. Enter **"Finance Manager"** in the Role field
3. Select **"Advanced"** for Experience Level
4. Select **"Concise"** for Answer Style
5. Click **"Save AI Preferences"**
6. If prompted, enter your password to confirm (re-authentication)

The AI will now provide finance-focused, concise, technical responses.

### Example 2: Enabling Healthcare Mode for a Healthcare Tenant

1. Go to **Admin** → **Tenants** → Select the healthcare tenant
2. Scroll to **Healthcare Mode**
3. Check **"Enable healthcare mode"**
4. Enter PCN ID and practice count (optional)
5. Click **"Save"**
6. Confirm the change by typing **"CONFIRM"** in the confirmation dialog
7. Enter your password to re-authenticate

Healthcare mode is now active: AI constraints and PHI redaction are enabled.

---

## Related Documentation

- [AI Engine Behaviour](./ai-engine-behaviour.md) — How the AI engine works
- [SUPER_ADMIN Handbook](./super-admin-handbook.md) — SUPER_ADMIN configuration and security
- [Security & Compliance](../security/compliance.md) — Security policies and compliance

---

## Notes

- Profile preferences are stored per-user and persist across sessions
- AI preferences require re-authentication for changes (security measure from Task F4)
- Healthcare mode changes are audited and visible to SUPER_ADMIN
- MFA for SUPER_ADMIN is mandatory and cannot be disabled by the user

