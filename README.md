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
pnpm pds:invite    # mint an invite code when the PDS requires one

pnpm dev           # web app, http://localhost:5173 — each visitor creates a sandbox account
```

`apps/web/.env` (see `.env.example`): `AIRSPACE_SERVICE`, `AIRSPACE_PDS_INVITE_CODE`, and a
32+ character `AIRSPACE_SESSION_SECRET`.

Other helpers: `pnpm pds:invite` (mint an invite code, needs `PDS_ADMIN_PASSWORD`),
`pnpm pds:smoke`, `pnpm pds:reset`, `pnpm typecheck`, `pnpm build`.

## deploy

## deploy

- **Render (both apps)**: `render.yaml` at the repo root is a complete blueprint —
  `render blueprint launch` (or git-connect). The web app builds as a plain SSR node bundle
  (`node server.mjs`, no Netlify plugin) and the PDS deploys as a Docker service with a
  1 GB disk. Most `sync: false` vars must be set in the Render UI — especially the PDS
  `PDS_HOSTNAME` **before its first boot** (it's baked into every account's `did:plc`).
  The `airspace-pds-reset` cron job cleans up throwaway accounts daily.
- **Netlify (web only)** still works: it builds with the Netlify plugin when `NETLIFY=true`
  is set (the CLI sets it); site settings: build command `vite build`, publish `dist/client`,
  base directory `apps/web`, function at `.netlify/v1/functions/server.mjs`.
- **Fly (pds)**: `fly deploy -c apps/demo-pds/fly.toml --dockerfile apps/demo-pds/Dockerfile .`
  from this repo root. See `apps/demo-pds/README.md` for first-time setup (secrets, volume, certs)
  and the daily `reset.mjs` job.
