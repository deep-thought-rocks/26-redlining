import react from '@vitejs/plugin-react'
import { redlining } from 'redlining/vite'
import { defineConfig } from 'vite'

// The Playwright fixture for the Vite adapter: anchors from the transform, the save
// endpoint served by the dev server itself.
export default defineConfig({ plugins: [redlining({ endpoint: true }), react()] })
