import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import viteReact from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart(),
    // Deploy adapters. Netlify's plugin runs a Deno-based edge-functions dev
    // server locally, so it's build-only, and the Netlify CLI sets NETLIFY=true
    // during builds. Any other host (e.g. Render's node runtime) gets a plain
    // dist/ that `node server.mjs` serves.
    ...(command === 'build' && process.env.NETLIFY ? [netlify()] : []),
    viteReact(),
  ],
}))
