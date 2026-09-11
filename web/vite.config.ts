import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Production is served at goaflow.org/fish-count/, sharing the EC2's
  // nginx and port 443 with another app at the domain root — every asset
  // URL Vite emits (JS/CSS bundle links) needs this prefix, or the browser
  // would request them from the domain root instead, where they don't
  // exist. `npm run dev` keeps the default '/' (command === 'serve'), so
  // the proxy below is untouched locally — only `vite build` gets the
  // prefix.
  base: command === 'build' ? '/fish-count/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Talk to the FastAPI app (uvicorn api.main:app) through the dev server so
    // the browser sees one origin and no CORS config is needed on the API.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}))
