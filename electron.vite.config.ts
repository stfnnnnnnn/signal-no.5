import { resolve } from 'node:path';
const r = (p: string) => resolve(process.cwd(), p);
import { defineConfig } from 'electron-vite';

// main: ESM (package "type": "module"). preload: CommonJS, required for sandboxed preloads.
// renderer: src/renderer (frontend-owned; ships a backend dev harness until the real UI lands).
export default defineConfig({
  main: {
    build: { outDir: 'out/main', rollupOptions: { input: r('src/main/index.ts') } },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: { input: r('src/preload/index.ts'), output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    root: r('src/renderer'),
    build: { outDir: 'out/renderer', rollupOptions: { input: r('src/renderer/index.html') } },
  },
});
