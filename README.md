# airspace-tanstack-monorepo

pnpm workspace with:

- `apps/web` — the [airspace](https://getair.space) demo on TanStack Start + TanStack Query
  (ported from `airspace/examples/nuxt`)
- `apps/demo-pds` — the reference atproto PDS from the permissioned spaces alpha, copied from
  [`danielroe/airspace` `demo-pds/`](https://github.com/danielroe/airspace/tree/main/demo-pds)
  (commit `5f06bd7`) and adapted for this workspace (alpha-package pinning lives in the root
  `pnpm-workspace.yaml`; the `Dockerfile` expects the repo root as its build context)

## local dev

```sh
pnpm install
pnpm pds           # demo PDS on localhost:2583 (in-memory PLC, throwaway data dir)
pnpm pds:account   # (once, with PDS running) create alice.test, prints dotenv-shaped creds # PDS_ADMIN_PASSWORD=admin

pnpm dev           # web app, http://localhost:5173 — reads apps/web/.env
```

`apps/web/.env` (see `.env.example`): `AIRSPACE_SERVICE`, `AIRSPACE_IDENTIFIER`, `AIRSPACE_PASSWORD`.

Other helpers: `pnpm pds:invite` (mint an invite code, needs `PDS_ADMIN_PASSWORD`),
`pnpm pds:smoke`, `pnpm pds:reset`, `pnpm typecheck`, `pnpm build`.

## deploy

- **web** → Netlify: build command `vite build`, publish `dist/client` (set **base directory**
  to `apps/web` in the Netlify UI; `apps/web/netlify.toml` holds the rest).
- **demo-pds** → Fly: `fly deploy -c apps/demo-pds/fly.toml --dockerfile apps/demo-pds/Dockerfile .`
  from this repo root. See `apps/demo-pds/README.md` for first-time setup (secrets, volume, certs)
  and the daily `reset.mjs` job.
