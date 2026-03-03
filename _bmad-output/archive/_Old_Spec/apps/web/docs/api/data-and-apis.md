Data & APIs — KPIs, Cache, Modules ETag, Quick Actions

KPI Endpoints
- GET /api/kpi/revenue
- GET /api/kpi/gm
- GET /api/kpi/invoices
- GET /api/kpi/wip

Caching: in-process TTL cache with tag support. TTL = 30s.
Revalidate: POST /api/cache/revalidate with body { "tags": ["kpi:revenue"] }.
Headers: ETag + Cache-Control: public, max-age=0, must-revalidate.
304 Support: Clients may send If-None-Match to leverage 304 responses.

Modules (Source of Truth)
- GET /api/modules?tree=1
- Schema: server/modules.schema.md
- Adds ETag + Cache-Control (304 supported).

Quick Actions (Optimistic UI)
- POST /api/actions/invoice  → { ok, resource, provisional:true }
- GET  /api/actions/invoice?id=INV-1001
- POST /api/actions/po       → { ok, resource, provisional:true }
- GET  /api/actions/po?id=PO-5001

Client helper: lib/optimistic.ts → postJSON(url, body, draft=>applyOptimistic(draft))

Security note: Replace in-memory stubs with real DB. Add auth, input validation, rate limits before production.
