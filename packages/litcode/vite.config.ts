import tailwindcss from '@tailwindcss/vite';
import { readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const componentDir = fileURLToPath(new URL('./src/lib/components', import.meta.url));
const componentEntries = Object.fromEntries(
  readdirSync(componentDir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => {
      const name = file.slice(0, -3);
      return [
        `components/${name}`,
        fileURLToPath(new URL(`./src/lib/components/${file}`, import.meta.url)),
      ];
    }),
);

const baseConfig = {
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
  },
};

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode !== 'demo') {
    return {
      ...baseConfig,
      publicDir: false,
      build: {
        target: 'esnext',
        lib: {
          entry: {
            cli: fileURLToPath(new URL('./src/cli.ts', import.meta.url)),
            index: fileURLToPath(new URL('./src/lib/index.ts', import.meta.url)),
            core: fileURLToPath(new URL('./src/lib/core.ts', import.meta.url)),
            variants: fileURLToPath(new URL('./src/lib/variants.ts', import.meta.url)),
            ...componentEntries,
          },
          formats: ['es'],
          fileName: (_format, entryName) => `${entryName}.js`,
        },
        rollupOptions: {
          external: [
            'node:fs',
            'node:fs/promises',
            'node:os',
            'node:path',
            'node:url',
            'clsx',
            'tailwind-merge',
          ],
        },
      },
    };
  }

  return baseConfig;
});
