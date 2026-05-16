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
};

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode !== 'demo') {
    return {
      ...baseConfig,
      publicDir: false,
      build: {
        lib: {
          entry: fileURLToPath(new URL('./src/lib/index.ts', import.meta.url)),
          formats: ['es'],
          fileName: 'index',
        },
        rollupOptions: {
          external: ['clsx', 'tailwind-merge'],
        },
      },
    };
  }

  return baseConfig;
});
