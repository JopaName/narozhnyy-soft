import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
  },
});
