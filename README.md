Demo of [airspace](https://getair.space) running on TanStack Start + TanStack Query — the ported Nuxt example (from `airspace/examples/nuxt`).

## Run it

The app expects a PDS on `http://localhost:2583` (the one from the airspace repo):

```sh
cd ../airspace
pnpm install
pnpm dev:pds        # prints credentials for alice and bob
```

Then, here:

```sh
pnpm install
pnpm dev            # http://localhost:5173
```

Production / Netlify:

```sh
pnpm build                                  # dist/client + Netlify function in .netlify/v1
npx netlify deploy --build --prod           # or: git-connect the repo in the Netlify UI
```

Deploy settings (also in `netlify.toml`): build command `vite build`, publish dir `dist/client`,
Netlify function at `.netlify/v1/functions/server.mjs`. The Netlify plugin is build-only here
(it needs Deno for its local edge-functions emulation). Local production emulation:
`npm i -g netlify-cli && netlify dev`.

Config lives in `.env` (see `.env.example`): `AIRSPACE_SERVICE`, `AIRSPACE_IDENTIFIER`, `AIRSPACE_PASSWORD`.

For deployment, set those three as Netlify environment variables (they're secrets). Note the
deployed copy will reach whatever PDS `AIRSPACE_SERVICE` points at — the localhost dev PDS is
only reachable locally, so use a publicly-reachable PDS for Netlify. Note/cover image URLs come
from the PDS too, so those must be public for visitors.

`seed.ts` creates a demo tag, draft and published note directly against the PDS:

```sh
node seed.ts
```

## Layout

- `lexicons.ts` / `collections.ts` — copied unchanged from the Nuxt example
- `src/server/airspace.ts` — lazy server-side singleton airspace instance (env-configured session)
- `src/server/air.ts` — all server functions (`createServerFn`): reads from loaders, writes (profile, draft create via FormData upload, publish)
- `src/queries.ts` — TanStack Query definitions wrapping the server functions
- `src/routes/` — notes list, note detail (comark markdown render), drafts, profile
