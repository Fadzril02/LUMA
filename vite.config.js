import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const manualChunks = Object.assign(
  (id) => {
    for (const [chunk, pkgs] of Object.entries(manualChunks)) {
      if (
        Array.isArray(pkgs) &&
        pkgs.some(
          (pkg) =>
            id.includes(`/node_modules/${pkg}/`) ||
            id.includes(`\\node_modules\\${pkg}\\`) ||
            id.includes(`/node_modules/${pkg}`) ||
            id.includes(`\\node_modules\\${pkg}`)
        )
      ) {
        return chunk;
      }
    }
  },
  {
    'react-vendor': ['react', 'react-dom', 'react-router', 'react-router-dom'],
    'supabase-vendor': ['@supabase/supabase-js'],
    'ui-icons': ['lucide-react'],
  }
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    cssCodeSplit: true, // Ensures CSS is split alongside JS chunks to reduce render-blocking size
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
