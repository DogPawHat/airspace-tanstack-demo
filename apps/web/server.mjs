/* eslint-disable no-console, antfu/no-top-level-await */
/**
 * Self-hosted node server for the built TanStack Start app (Netlify-free).
 *
 * `vite build` (without the Netlify plugin) emits `dist/server/server.js` —
 * a `{ fetch(request) }` handler — and static client assets in `dist/client`.
 * srvx adapts the fetch handler to http and serves the static assets first.
 *
 * Run: node server.mjs   (PORT env respected; Render sets it)
 */
import { serve } from "srvx/node";
import { serveStatic } from "srvx/static";

import handler from "./dist/server/server.js";

await serve({
  port: process.env.PORT ?? 3000,
  middleware: [serveStatic({ dir: new URL("./dist/client/", import.meta.url).pathname })],
  fetch: (request) => handler.fetch(request),
});

console.log("web server listening on", process.env.PORT ?? 3000);
