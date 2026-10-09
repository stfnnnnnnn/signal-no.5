// Build the portable Windows folder: dist/win-unpacked/SignalNo5.exe (+ resources/llm, resources/models).
// Ships exactly ONE model. Inputs (env, with local defaults):
//   SIGNAL_LLM_DIR    extracted llama.cpp b11517 CUDA 12.4 build + cudart DLLs
//   SIGNAL_MODEL_FILE the .gguf to bundle
import { existsSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { build, Platform } from 'electron-builder';

const llmDir = process.env.SIGNAL_LLM_DIR ?? 'D:\\signal-llm\\llama-b11517-cuda124';
const model = process.env.SIGNAL_MODEL_FILE ?? 'C:\\signal-llm\\models\\Qwen3-4B-Instruct-2507-Q4_K_M.gguf';

for (const [label, p] of [['llama.cpp runtime', llmDir], ['model', model]]) {
  if (!existsSync(p)) { console.error(`Missing ${label}: ${p}`); process.exit(1); }
}
const required = ['llama-server.exe', 'llama-server-impl.dll', 'ggml-cuda.dll', 'cudart64_12.dll', 'cublas64_12.dll', 'cublasLt64_12.dll'];
const present = new Set(readdirSync(llmDir));
const missing = required.filter((f) => !present.has(f));
if (missing.length) { console.error(`Runtime folder is missing: ${missing.join(', ')} (did you extract the cudart zip into it?)`); process.exit(1); }

await build({
  targets: Platform.WINDOWS.createTarget('dir'),
  config: {
    appId: 'ph.signalno5.app',
    productName: 'SignalNo5',
    directories: { output: 'dist' },
    files: ['out/**/*', 'package.json'],
    asar: true,
    extraResources: [
      { from: llmDir, to: 'llm', filter: ['llama-server.exe', '*.dll'] },
      { from: model, to: `models/${basename(model)}` },
    ],
    win: { target: 'dir' },
  },
});
console.log(`Packaged with model ${basename(model)} → dist/win-unpacked/SignalNo5.exe`);
