# Open Banking (TrueLayer)

- What it does: OAuth to bank, lists accounts and transactions (sandbox demo).
- Key endpoints: `/api/open-banking/auth`, `/api/open-banking/callback`, `/api/open-banking/accounts`, `/api/open-banking/transactions`.
- Roles & permissions: superadmin/admin for connect; users read-only.
- Data model: `BankConnection` and demo lists.
- Jobs: `openbanking:sync` pulls recent data if configured.
- Common tasks: start OAuth, fetch accounts, export CSV.
- Troubleshooting: set `OPEN_BANKING_CLIENT_ID`, `OPEN_BANKING_CLIENT_SECRET`, `OPEN_BANKING_ENV=sandbox`.
