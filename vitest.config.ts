import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Renderer components (.tsx) use the automatic JSX runtime, as in the app build.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
