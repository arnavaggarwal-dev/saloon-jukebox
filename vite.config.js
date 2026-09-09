import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Everything — React, the components, CSS — is inlined into one index.html, so
// the build output is a single portable file you can open from disk or host
// anywhere. Media stays external (absolute URLs in the database).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { outDir: 'dist', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
