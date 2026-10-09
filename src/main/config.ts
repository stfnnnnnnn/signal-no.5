// Runtime configuration: where the inference runtime and model live (packaged vs development).
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const RUNTIME_LABEL = 'llama.cpp b11517 (CUDA 12.4)';

export interface RuntimeConfig {
  llmDir: string;
  exePath: string;
  modelPath: string | null;
  ngl: number;
  ctx: number;
  timeoutMs: number;
  maxTokens: number;
}

const DEV_LLM_DIR = 'D:\\signal-llm\\llama-b11517-cuda124';
const DEV_MODELS = ['C:\\signal-llm\\models\\Qwen3-4B-Instruct-2507-Q4_K_M.gguf', 'D:\\signal-llm\\models\\Qwen3-1.7B-Q4_K_M.gguf'];

/** Packaged: resources/llm + the single .gguf in resources/models. Dev: env overrides, then known local paths. */
export function resolveRuntimeConfig(packaged: boolean, resourcesPath: string, env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const llmDir = packaged ? path.join(resourcesPath, 'llm') : env.SIGNAL_LLM_DIR ?? DEV_LLM_DIR;
  let modelPath: string | null = null;
  if (packaged) {
    const dir = path.join(resourcesPath, 'models');
    const gguf = existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.gguf')).sort() : [];
    modelPath = gguf[0] ? path.join(dir, gguf[0]) : null;
  } else {
    modelPath = env.SIGNAL_MODEL ?? DEV_MODELS.find((p) => existsSync(p)) ?? null;
  }
  return {
    llmDir, exePath: path.join(llmDir, 'llama-server.exe'), modelPath,
    ngl: Number(env.SIGNAL_NGL ?? 99), ctx: Number(env.SIGNAL_CTX ?? 2048),
    timeoutMs: Number(env.SIGNAL_AI_TIMEOUT_MS ?? 12_000), maxTokens: Number(env.SIGNAL_AI_MAX_TOKENS ?? 220),
  };
}
