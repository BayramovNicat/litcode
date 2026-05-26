import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: [
      {
        find: '@holmityd/litcode/core',
        replacement: fileURLToPath(new URL('../../packages/litcode/src/lib/core.ts', import.meta.url)),
      },
      {
        find: '@holmityd/litcode/variants',
        replacement: fileURLToPath(new URL('../../packages/litcode/src/lib/variants.ts', import.meta.url)),
      },
      {
        find: '@holmityd/litcode',
        replacement: fileURLToPath(new URL('../../packages/litcode/src/index.ts', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  build: {
    target: 'esnext',
  },
});
