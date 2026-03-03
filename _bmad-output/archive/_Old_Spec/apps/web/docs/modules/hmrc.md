# HMRC MTD VAT

- What it does: OAuth to HMRC sandbox, fetches obligations and files returns (demo).
- Key endpoints: `/api/hmrc/oauth/authorize`, `/api/hmrc/oauth/callback`, `/api/hmrc/vat/obligations`, `/api/hmrc/vat/returns`.
- Roles & permissions: superadmin/admin to file; users read-only.
- Data model: `VatReturn`, `WebhookEvent` (if used).
- Jobs: `hmrc:pull-obligations` refreshes obligations.
- Common tasks: connect sandbox, fetch obligations, submit a demo return.
- Troubleshooting: set `HMRC_CLIENT_ID`, `HMRC_CLIENT_SECRET`, `HMRC_ENVIRONMENT=sandbox`, `HMRC_VRN`.
