# Modules Tree API

Endpoint: `GET /api/modules?tree=1`

Shape

- Array of module nodes
- Node fields:
  - id: string
  - name: string
  - path: string
  - icon?: string
  - meta?: { status?: string }
  - children?: Node[]

Rules

- Top-level and children sorted alphabetically by `name`.
- Use `meta.status` to deprecate rather than remove.
- ETag provided; supports 304 with `If-None-Match`.

Notes

- Source of truth: `public/modules/_tree.json`
- For DB snapshotting, use `scripts/modules-snapshot.js`.




