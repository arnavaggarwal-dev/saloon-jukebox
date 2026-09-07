import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `VITE_BASE` lets the same source deploy to a project-scoped host such as
// GitHub Pages (`/saloon-jukebox/`) or to a domain root (`/`) on Vercel/Netlify.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing dependencies so a code change
        // doesn't force everyone to re-download the whole bundle.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor';
          if (id.includes('@supabase')) return 'supabase';
          if (/[\\/]node_modules[\\/](motion|framer-motion)/.test(id)) return 'motion';
          if (id.includes('ogl')) return 'ogl';
        },
      },
    },
  },
});
