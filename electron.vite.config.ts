import { resolve } from 'node:path';
const r = (p: string) => resolve(process.cwd(), p);
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

// main: ESM (package "type": "module"). preload: CommonJS, required for sandboxed preloads.
// renderer: src/renderer (frontend-owned): the React + Phaser game UI.
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
    plugins: [react()],
    build: { outDir: 'out/renderer', rollupOptions: { input: r('src/renderer/index.html') } },
  },
});
