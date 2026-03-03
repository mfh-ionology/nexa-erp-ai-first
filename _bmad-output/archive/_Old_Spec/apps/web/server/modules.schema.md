# Modules API Schema (Source of Truth)

Endpoint: `GET /api/modules?tree=1`

Returns an **array** of module entries, alphabetically sorted.

## Item shape
```json
{
  "id": "string",
  "name": "Finance",
  "path": "/modules/finance",
  "children": [ /* same shape */ ],
  "icon": "string",
  "meta": { "count": 12, "status": "live" }
}
```

Rules:
- Top-level entries sorted by name.
- Children sorted by name.
- Use `meta.status` to deprecate; avoid removals.
- This endpoint is the single source of truth.
- Clients must not rely on order beyond alphabetical sort.

Headers:
- ETag: weak ETag for payload.
- Cache-Control: public, max-age=0, must-revalidate.

Change control:
- Additive changes allowed any time.
- Breaking changes require a versioned endpoint.
