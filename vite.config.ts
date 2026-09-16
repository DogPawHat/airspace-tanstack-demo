import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import viteReact from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart(),
    // Netlify's plugin runs a Deno-based edge-functions dev server locally;
    // only enable it during `vite build` when producing the deploy bundle.
    ...(command === 'build' ? [netlify()] : []),
    viteReact(),
  ],
}))
