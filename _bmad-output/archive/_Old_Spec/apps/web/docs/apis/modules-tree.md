# /api/modules?tree=1 — Modules Tree Schema (Source of Truth)

{ is a shell keyword

Rules
- Top-level alphabetic by name.
- id is stable (a–z, 0–9, dots/hyphens), used by RBAC and links.
- path is the canonical route.
- Optional flags: beta, disabled.

Caching
- Strong ETag (sha256 of canonical JSON).
- Cache-Control: s-maxage=60, stale-while-revalidate=300.
- Honour If-None-Match → 304 Not Modified.

Optional DB persistence
- Toggle: MODULES_DB_ENABLED=true.
- Table: ModuleNode (already provided in your SQL).
- Admin sync: POST /api/admin/modules/sync (optional later).
- Serve from DB: /api/modules?tree=1&source=db (optional later).
