import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const baseConfig = {
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2017',
  },
};

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode !== 'demo') {
    return {
      ...baseConfig,
      publicDir: false,
      build: {
        target: 'es2017',
        lib: {
          entry: {
            index: fileURLToPath(new URL('./src/lib/index.ts', import.meta.url)),
            core: fileURLToPath(new URL('./src/lib/core.ts', import.meta.url)),
            variants: fileURLToPath(new URL('./src/lib/variants.ts', import.meta.url)),
          },
          formats: ['es'],
          fileName: (_format, entryName) => `${entryName}.js`,
        },
        rollupOptions: {
          external: ['clsx', 'tailwind-merge'],
        },
      },
    };
  }

  return baseConfig;
});
