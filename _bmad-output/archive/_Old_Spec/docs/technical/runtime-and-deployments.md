# Runtime & Deployments

1. `pnpm install` and `pnpm -r build` (per‑package artefacts)
2. Tests, lint, type check, SBOM generation
3. Container build & push (web, api, worker)
4. Deploy to staging → smoke tests → promote to production

Backups: nightly base + WAL; quarterly restore drills. Secrets from a secrets manager.
