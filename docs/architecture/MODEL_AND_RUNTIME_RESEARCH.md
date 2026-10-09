# Model and Runtime Research

> **Status:** Stage A research (2026-10-09). The decisions are recorded in [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md) §1.
> **Note:** this research was written when Godot was the provisional engine. Wherever it says "Godot launches / HTTPRequest / GDScript validators", read **"the Electron main process launches / Node fetch / Zod validators"**. The model, runtime, VRAM and schema findings are engine-independent and still apply.
> **Pinned for the PoC:** llama.cpp **b11517** `win-cuda-12.4-x64` (sha256 `136c9581…16ab4d`) + `cudart-llama-bin-win-cuda-12.4-x64` (sha256 `8c79a9b2…ae1d6`), and **Qwen3-1.7B-Q4_K_M** (unsloth, sha256 `b139949c…181897`). Re-verified against the GitHub and HF APIs on 2026-10-09. llama.cpp publishes several prerelease builds a day, so keep the pin.
> **Measured results** will be added in §6 after the PoC. Everything below is research ([V]/[E]/[U]), not measurement.

---

# Research B: Local LLM Model + Runtime for "Signal No. 5"

Research Agent B. All sources accessed **2026-10-09**. This was read-only research: nothing was installed, no weights were downloaded, and nothing was benchmarked.
How claims are labelled: **[V]** Verified from the cited official page, HF file listing, config.json, or source code. **[E]** Estimate, with reasoning shown. **[U]** Unverified or not found.

Target machine: Windows 10 x64, i5-10300H (AVX2), 40 GB RAM, GTX 1650 Ti 4 GB (TU117, CC 7.5), driver 576.02 (CUDA 12.9 driver API).

---

## 0. TL;DR

| Role | Model | File (HF) | Size [V] | Fits 4 GB VRAM with 0.4 GB used by desktop/game? |
|---|---|---|---|---|
| **PRIMARY** | Qwen3-4B-Instruct-2507 (non-thinking only) | `unsloth/Qwen3-4B-Instruct-2507-GGUF` → `Qwen3-4B-Instruct-2507-Q4_K_M.gguf` | 2,497,281,120 B (2.33 GiB) | **Yes, but tight [E]**: about 3.0–3.3 GiB total at ctx 2048–4096. Use `-c 2048` or q8_0 KV if needed. |
| **LIGHTWEIGHT FALLBACK** | Qwen3-1.7B (hybrid; thinking disabled) | `unsloth/Qwen3-1.7B-GGUF` → `Qwen3-1.7B-Q4_K_M.gguf` | 1,107,409,472 B (1.03 GiB) | **Yes, comfortably [E]**: about 1.6–1.9 GiB |
| **HIGHER-CAPABILITY ALT** | Qwen3.5-4B (Mar 2026, hybrid Gated-DeltaNet; thinking ON by default, must disable) | `unsloth/Qwen3.5-4B-GGUF` → `Qwen3.5-4B-Q4_K_M.gguf` | 2,740,937,888 B (2.55 GiB) | **Borderline [E]**: about 3.1–3.4 GiB. KV cache is tiny but the weights and the 248k-vocab output buffers are larger. May need 1–3 layers on the CPU. |

Runtime: **llama.cpp `llama-server` (prebuilt Windows CUDA 12.4 build)** for both dev and demo.
- It does grammar-constrained decoding from JSON Schema via `response_format`. The `enum`, `minLength`/`maxLength`, `minItems`/`maxItems`, `required` and `additionalProperties:false` keywords are compiled into a GBNF grammar, so the output shape and enum membership are guaranteed **[V]**.
- `uniqueItems` is **not** supported, so the game must reject duplicate actionIds itself **[V]**.
- Ollama is acceptable for dev. Its current source wraps the same `llama-server` binary and passes `json_schema` through **[V]**, so the guarantees are the same. But the Windows install is about 1.5 GB versus about 0.63 GB for llama.cpp CUDA (or 33 MB for the Vulkan build), and it adds a service layer you don't need.

---

## 1. Model research

### 1.1 What's new since the original brief (checked, not from memory)
- **Qwen3.5 small series** was released on HF 2026-02-27/28 [V]: `Qwen/Qwen3.5-0.8B`, `-2B`, `-4B`, `-9B`. All are Apache-2.0. They use a hybrid architecture (3 Gated-DeltaNet linear-attention layers per 1 full-attention layer), take image+text input, and have 262k native context. Qwen publishes **no first-party GGUF** for Qwen3.5. ggml-org has only `Qwen3.5-0.8B-GGUF`; unsloth, bartowski and lmstudio-community publish the full quant sets [V].
- **Qwen3.6** exists only as 27B and 35B-A3B, so it is out of scope [V].
- **Gemma 4** (google, HF repos created 2026-03-02; public launch April 2026 per press) [V]: E2B and E4B, plus 12B, 26B-A4B and 31B. **The license is Apache 2.0**, which changes things versus Gemma 3's custom terms. The license page links a Prohibited Use Policy and Terms as separate documents [V]. Google ships official QAT q4_0 GGUFs, and ggml-org GGUFs also exist [V].
- **Other 2025–2026 small models found** [V]: IBM Granite 4.2-3B (Aug 2026, Apache-2.0, official GGUF), LiquidAI LFM2.5-1.2B-Instruct (Jan 2026) and LFM2.5-2.6B (Aug 2026, "pure reasoning model that always thinks"), both under the LFM Open License v1.0. Also NVIDIA Nemotron-3-Nano-4B (Mar 2026, NVIDIA Nemotron Open Model License) and Mistral Ministral-3-3B-Instruct-2512 (Apache-2.0, official GGUF).
- **Not found** [V]: no Phi-5 on HF (microsoft). There is no newer SmolLM than SmolLM3-3B (Jul 2025) and no newer small Llama than 3.2.

### 1.2 Candidate table (facts)

Sizes are exact byte counts from the HF tree API (`https://huggingface.co/api/models/<repo>/tree/main`) [V]. IF = instruction following. The scores come from each vendor's own card and are **not cross-comparable** because the harnesses differ.

| Model (HF ID) | Params | Arch notes (config.json) [V] | Ctx | Q4_K_M GGUF | Q8_0 GGUF | Thinking & how to disable | Published IF / tool evidence | License |
|---|---|---|---|---|---|---|---|---|
| **Qwen/Qwen3-4B-Instruct-2507** | 4.0B | Qwen3, 36 layers, 8 KV heads, head_dim 128, vocab 151,936 | 262,144 | unsloth 2,497,281,120 | unsloth 4,280,405,600 | **Non-thinking only**; "does not generate `<think></think>`… `enable_thinking=False` is no longer required" [V] | IFEval 83.4, BFCL-v3 61.9 (card) [V] | Apache-2.0 |
| Qwen/Qwen3-4B (hybrid) | 4.0B | same as above | 32k native (Ollama lists 40K) | **official** `Qwen/Qwen3-4B-GGUF` 2,497,280,256 | official 4,280,404,704 | Thinking default; `enable_thinking=False` or `/no_think` soft switch [V] | IFEval 81.2 non-thinking (from the 2507 card) [V] | Apache-2.0 |
| **Qwen/Qwen3-1.7B** | 1.7B | 28 layers, 8 KV, hd 128 | 32k native (40,960 max_pos) | unsloth 1,107,409,472 | **official** `Qwen/Qwen3-1.7B-GGUF` 1,834,426,016 | Same as Qwen3-4B (`enable_thinking=False`, `/no_think`) [V] | IFEval 68.2 non-thinking / 72.5 thinking (Qwen3.5-0.8B card table) [V]; 73.68 per Liquid's harness [V] | Apache-2.0 |
| Qwen/Qwen3-0.6B | 0.6B | 28 layers, 8 KV, hd 128 | 32k | unsloth 396,705,472 | official 639,446,688 | as above | — [U] | Apache-2.0 |
| **Qwen/Qwen3.5-4B** | ~4B (LFM card lists 4.7B incl. vision) | 32 layers; 8 full-attn layers (interval 4), 4 KV heads, hd 256; 24 linear-attn layers; vocab 248,320, tied embeddings | 262,144 | unsloth 2,740,937,888 | unsloth 4,482,403,488 | **Thinking ON by default**; disable via `chat_template_kwargs: {"enable_thinking": false}` [V] | IFEval 89.8, IFBench 59.2, BFCL-V4 50.3 (**thinking mode**; no non-thinking IF numbers published for 4B) [V] | Apache-2.0 |
| Qwen/Qwen3.5-2B | 2B | 24 layers; 6 full-attn, 2 KV heads, hd 256 | 262,144 | unsloth 1,280,835,840 | unsloth 2,012,012,800 | **Non-thinking by default** [V] | Non-thinking IFEval **61.2**; thinking IFEval 78.6, IFBench 41.3, BFCL-V4 43.6 [V]. Card warns 2B is "more prone to entering thinking loops" (thinking mode) [V] | Apache-2.0 |
| Qwen/Qwen3.5-0.8B | 0.8B | 24 layers; 6 full-attn, 2 KV, hd 256 | 262,144 | unsloth 532,517,120 | unsloth 811,843,840 | Non-thinking by default [V] | Non-thinking IFEval 52.1; thinking 44.0; same loop warning [V] | Apache-2.0 |
| google/gemma-4-E2B-it | 2.3B effective / 5.1B incl. PLE embeddings | 35 layers, sliding window 512, 1 KV head, 20 KV-shared layers | 128K | unsloth 3,106,738,272; ggml-org Q4_0 2,841,481,184; Google QAT `gemma-4-E2B_q4_0-it.gguf` 3,349,516,256 | ggml-org 4,967,497,152 | Thinking only when `<|think|>` is in the system prompt; remove it to disable [V] | No IFEval/BFCL on card; Tau2 24.5%, MMLU-Pro 60.0% [V] | **Apache-2.0** (+ linked Prohibited Use Policy) [V] |
| google/gemma-4-E4B-it | 4.5B eff / 8B total | 42 layers | 128K | unsloth 4,977,171,584 | ggml-org 8,031,242,688 | as E2B | Tau2 42.2%, MMLU-Pro 69.4% [V] | Apache-2.0 |
| google/gemma-3-4b-it | 4B | — (gated repo, config not fetched) | 32K (per Google model card) [V] | Google QAT `gemma-3-4b-it-q4_0.gguf` 3,155,051,328 | — | No thinking | IFEval 90.2 [V] (ai.google.dev model card) | Gemma Terms of Use (custom; gated) |
| google/gemma-3-1b-it | 1B | — | 32K [V] | Google QAT q4_0 1,003,541,152 | — | none | IFEval 80.2 [V]; 63.25 per Liquid's harness [V] | Gemma Terms |
| google/gemma-3n-E2B-it | ~2B eff | — | — | unsloth 3,026,881,888 | 4,788,112,736 | none | [U] | Gemma Terms |
| microsoft/Phi-4-mini-instruct | 3.8B | 32 layers, 8 KV, hd 128 (3072/24), vocab 200,064 | 128K | unsloth 2,491,874,272 | unsloth 4,084,611,040 | none | Card lists IFEval in methodology, but I could not extract the number [U]. Card notes it "could sometimes hallucinate function names" [V] | **MIT** |
| HuggingFaceTB/SmolLM3-3B | 3B | 36 layers, 4 KV, hd 128 | 64K (YaRN to 128K) | ggml-org 1,915,305,312 | ggml-org 3,275,574,624 | Thinking default; `/no_think` in system prompt or `enable_thinking=False` [V] | IFEval 76.7 (no-think), BFCL 92.3 (vendor) [V] | Apache-2.0 |
| meta-llama/Llama-3.2-3B-Instruct | 3.2B | 28 layers, 8 KV, hd 128 | 128k | unsloth 2,019,377,600 | 3,421,898,816 | none | IFEval 77.4, BFCL V2 67.0 [V] | Llama 3.2 Community License ("Built with Llama" attribution, 700M-MAU clause, AUP) [V] |
| meta-llama/Llama-3.2-1B-Instruct | 1.23B | — | 128k | unsloth 807,694,368 | 1,321,082,528 | none | IFEval 59.5, BFCL V2 25.7 [V] | Llama 3.2 Community |
| ibm-granite/granite-4.2-3b | 3B | Granite dense, 40 layers, 8 KV, hd 64 | 128K (ext. 512K) | **official** 2,244,011,552 | official 3,892,651,552 | Thinking default; `enable_thinking=False` gives an empty `<think></think>` [V] | IFBench (prompt) 74.33, BFCL v4 52.41. The mode is not stated per row, probably thinking [V/U] | Apache-2.0 |
| LiquidAI/LFM2.5-1.2B-Instruct | 1.17B | LFM2: 10 conv + 6 attention layers, 8 KV, hd 64 | 32,768 | **official** 730,895,168 | official 1,246,253,888 | none (Instruct) | IFEval 86.23 (avg of strict+loose), IFBench 47.33, BFCLv3 49.12 (vendor) [V] | LFM Open License v1.0: commercial use only below $10M annual revenue [V] |
| nvidia/NVIDIA-Nemotron-3-Nano-4B | 3.97B | Nemotron-H hybrid Mamba2; 4 attention layers of 42, 8 KV, hd 128 | 262K | **official** 2,837,072,864 | — | reasoning on/off | Reasoning-off: IFEval-Prompt 82.8 / Instr 88.0 (Q4_K_M: 81.5/83.9). Trained with a structured-outputs RL dataset [V] | NVIDIA Nemotron Open Model License |
| mistralai/Ministral-3-3B-Instruct-2512 | 3.4B LM + 0.4B vision | 26 layers, 8 KV, hd 128 | 256k | **official** 2,147,023,008 | official 3,652,204,704 | none (separate Reasoning variant) | "native function calling and JSON outputting"; no IFEval on card [U]. Recommends temperature < 0.1 [V] | Apache-2.0 |

Ollama library tags [V] (ollama.com/library): `qwen3:4b-instruct-2507-q4_K_M` 2.5GB, `qwen3:1.7b-q4_K_M` 1.4GB, `qwen3:0.6b-q4_K_M` 523MB, `qwen3.5:4b-q4_K_M` 3.3GB, `qwen3.5:2b-q4_K_M` 1.9GB, `gemma4:e2b-it-q4_K_M` 4.6GB, `gemma4:e4b-it-q4_K_M` 6.6GB. The qwen3.5 and gemma4 Ollama blobs bundle the vision (and audio) projectors, which is why they are larger than the text-only GGUFs.

### 1.3 Memory estimates (KV cache plus overhead) [E]

Formula for standard attention with an f16 KV cache: `bytes/token = 2 (K,V) × n_attn_layers × n_kv_heads × head_dim × 2 bytes`. Hybrid models only count their full-attention layers, plus a fixed recurrent state.

| Model | KV bytes/token | KV @2048 | KV @4096 | Q4_K_M weights (GiB) |
|---|---|---|---|---|
| Qwen3-4B(-2507) | 2×36×8×128×2 = 147,456 (144 KiB) | 288 MiB | 576 MiB (q8_0 KV ≈ 306 MiB) | 2.33 |
| Qwen3-1.7B / 0.6B | 2×28×8×128×2 = 114,688 (112 KiB) | 224 MiB | 448 MiB | 1.03 / 0.37 |
| Qwen3.5-4B | 2×8×4×256×2 = 32,768 (32 KiB) + recurrent state ≈ 24 layers × (32×128×128×4 B) ≈ 48 MiB | 64+48 MiB | 128+48 MiB | 2.55 |
| Qwen3.5-2B / 0.8B | 2×6×2×256×2 = 12,288 (12 KiB) + recurrent | ~24 MiB + state | ~48 MiB + state | 1.19 / 0.50 |
| Phi-4-mini | 2×32×8×128×2 = 131,072 | 256 MiB | 512 MiB | 2.32 |
| Llama-3.2-3B | 114,688 | 224 MiB | 448 MiB | 1.88 |
| SmolLM3-3B | 2×36×4×128×2 = 73,728 | 144 MiB | 288 MiB | 1.78 |
| Granite-4.2-3B | 2×40×8×64×2 = 81,920 | 160 MiB | 320 MiB | 2.09 |
| Ministral-3-3B | 2×26×8×128×2 = 106,496 | 208 MiB | 416 MiB | 2.00 |
| LFM2.5-1.2B | 2×6×8×64×2 = 12,288 | 24 MiB | 48 MiB | 0.68 |
| Nemotron-3-Nano-4B | 2×4×8×128×2 = 16,384 + Mamba state | 32 MiB+ | 64 MiB+ | 2.64 |

Other VRAM overheads [E]:
- CUDA context plus cuBLAS workspace: about 250–400 MiB.
- llama.cpp compute buffer: about 200–500 MiB. It scales with `-ub` and vocab size, and the 248k–262k vocab models (Qwen3.5, Gemma) sit at the high end.
- The desktop and game reserve about 400 MiB (given).
- Usable budget for the LLM: about 4096 − 400 − ~100 (WDDM headroom) ≈ **3.5 GiB**.

**Fit verdicts [E]:**
- **Qwen3-4B-Instruct-2507 Q4_K_M** totals 2.33 + 0.28–0.56 (KV) + ~0.3 (compute) + ~0.3 (CUDA ctx) ≈ **3.2–3.5 GiB**. It fits at `-c 2048` (f16 KV), or at `-c 4096` with `-ctk q8_0 -ctv q8_0`. Our prompts should be under 1.5k tokens, so 2048–3072 context is enough.
- **Qwen3-1.7B Q4_K_M** totals 1.03 + 0.22–0.45 + 0.25 + 0.3 ≈ **1.8–2.0 GiB**. Fits with lots of headroom.
- **Qwen3.5-4B Q4_K_M** totals 2.55 + ~0.15 + ~0.4 + 0.3 ≈ **3.4 GiB**. Borderline; `-ngl` may need to drop by 1–3 layers.
- **Gemma 4 E2B Q4_K_M (3.1 GB file)** is large mainly because of the Per-Layer Embedding tables (≈ 262,144 vocab × 35 layers × 256 ≈ 2.35B params). Whether llama.cpp keeps the PLE tables in host RAM (as it does for input token embeddings) is **[U]**. If it does, VRAM would be about 1.5–2 GiB. If not, it would not fully fit.
- **Gemma 4 E4B / Gemma 3n**: do not fully fit.
- **Important llama.cpp default [V]**: `--fit` is on by default with a **1024 MiB target margin per device** (`-fitt`), and it adjusts *unset* arguments. On a 4 GB card it may silently offload fewer layers or pick a smaller context. Always pass `-ngl 99` (or `all`) and `-c` explicitly, then confirm "offloaded N/N layers to GPU" in the log.

Using **hf-mem** for metadata-only estimates: per the installed skill, `hf-mem` reads safetensors and GGUF headers over HTTP Range requests "without downloading or loading any weights". Examples: `uvx hf-mem --model-id unsloth/Qwen3-4B-Instruct-2507-GGUF --gguf-file Qwen3-4B-Instruct-2507-Q4_K_M.gguf --experimental --max-model-len 4096 --json-output`, with `--kv-cache-dtype Q8_0` to model q8 KV. `uv`/`uvx` is present on this machine, but `uvx` would fetch the `hf-mem` package from PyPI into the uv cache. That is a package install, so I **did not run it**. It is safe to run during the approved benchmark phase. It estimates weights plus KV only, not the CUDA context or compute buffers.

### 1.4 Thinking control summary [V]
- Qwen3-4B-Instruct-2507: no thinking at all, which makes it the safest choice.
- Qwen3 (0.6/1.7/4B hybrid): set `chat_template_kwargs: {"enable_thinking": false}` per request, or start llama-server with `--chat-template-kwargs "{\"enable_thinking\":false}"`, or put `/no_think` in the system or user message. Recommended non-thinking sampling: T=0.7, top_p=0.8, top_k=20, min_p=0. Use presence_penalty up to 1.5 if outputs repeat.
- Qwen3.5: same `enable_thinking` kwarg. Non-thinking text sampling for 0.8B/2B: T=1.0, top_p=1.0, top_k=20, presence_penalty=2.0. For 4B "instruct mode": T=0.7, top_p=0.8, top_k=20, presence_penalty=1.5.
- llama-server flags: `-rea/--reasoning on|off|auto`, `--reasoning-budget 0` (immediate end), and `reasoning_effort: "none"` in the request disables thinking.
- Ollama: `"think": false` in `/api/chat`.
- Gemma 4: thinking only when `<|think|>` is present in the system prompt.

### 1.5 Weighted decision matrix [E: scores are my judgement, based on the evidence above]

Weights follow the stated priority: Contract adherence 35, Latency 25, Memory stability/fit 15, Narrative quality 15, Deployment ease + license 10. Each criterion is scored 1–5, and the weighted total is out of 500.

Note: grammar decoding (section 2) guarantees *shape* for every model. "Contract adherence" here means semantic adherence: choosing a sensible variant, staying within length limits without being truncated, and not misusing the enums. Small models score lower on that.

| Model (Q4_K_M) | Contract 35 | Latency 25 | Memory 15 | Narrative 15 | Deploy/License 10 | **Total** |
|---|---|---|---|---|---|---|
| **Qwen3-4B-Instruct-2507** | 5 | 3 | 3 | 4 | 5 | **405** |
| **Qwen3-1.7B (no-think)** | 3 | 5 | 5 | 3 | 5 | **400** |
| LFM2.5-1.2B-Instruct | 3.5 (vendor-only, lenient IFEval averaging) | 5 | 5 | 3 | 3 (revenue-threshold license, newer arch) | 397.5 |
| Granite-4.2-3B (no-think) | 4 (non-thinking IF unknown) | 3 | 4 | 3 | 5 | 370 |
| Qwen3.5-2B | 3 | 4 | 5 | 3 | 4 | 365 |
| Gemma-3-1B-it | 3 | 5 | 5 | 2 | 3 | 365 |
| **Qwen3.5-4B (no-think)** | 4 (only thinking-mode IF published) | 3 | 3 | 4 | 4 | 360 |
| SmolLM3-3B | 3 | 4 | 4 | 3 | 5 | 360 |
| Ministral-3-3B-2512 | 3 | 4 | 4 | 3 | 5 | 360 |
| Qwen3-0.6B / Qwen3.5-0.8B | 2 | 5 | 5 | 2 | 5 | 350 |
| Llama-3.2-3B | 3 | 4 | 4 | 3 | 3 | 340 |
| Gemma-3-4B-it (QAT) | 4 | 3 | 2 | 4 | 3 | 335 |
| Nemotron-3-Nano-4B | 4 | 3 | 3 | 3 | 3 | 335 |
| Llama-3.2-1B | 2 | 5 | 5 | 2 | 3 | 330 |
| Phi-4-mini | 3 | 3 | 3 | 3 | 5 | 320 |
| Gemma-4-E2B | 3 | 3 | 2 | 4 | 4 | 310 |
| Gemma-4-E4B | 3.5 | 2 | 1 | 4 | 4 | 287.5 |

**Recommendations**
- **PRIMARY: Qwen3-4B-Instruct-2507 Q4_K_M.**
  - Highest non-thinking IFEval among the 4B models that fit (83.4), and BFCL-v3 61.9.
  - No thinking mode, so it cannot burn tokens on `<think>`.
  - Mature, plain-transformer llama.cpp support. Apache-2.0, so the GGUF can be bundled with the game.
  - Risk: tight VRAM. Mitigate with ctx 2048–3072 or q8_0 KV.
- **LIGHTWEIGHT FALLBACK: Qwen3-1.7B Q4_K_M with thinking disabled.**
  - Same tokenizer and ChatML family as the primary, so one prompt and one schema serve both.
  - Apache-2.0, with an official Qwen GGUF (Q8_0) available.
  - Fits easily and should roughly double decode speed [E].
  - LFM2.5-1.2B-Instruct is a close runner-up on paper. Swap it in only if 1.7B fails the contract thresholds and the license threshold is acceptable.
- **HIGHER-CAPABILITY ALTERNATIVE: Qwen3.5-4B Q4_K_M with `enable_thinking:false`.**
  - Newest Qwen with the strongest published IF numbers (thinking mode) and a tiny KV cache.
  - Its non-thinking quality is unpublished, VRAM fit is borderline, and the hybrid Gated-DeltaNet CUDA kernel speed on Turing is unknown. Benchmark it only if the primary fails on narrative quality.
  - Second option if VRAM is too tight: Granite-4.2-3B (Apache, official IBM GGUF, 2.24 GB).

---

## 2. Runtime research

### 2.1 llama.cpp `llama-server`
- **Latest build [V]**: `b11517` (2026-10-09), from the GitHub API. The repo also has semver releases; latest is `v0.6.0` (2026-10-05).
- **Windows assets and sizes [V]**:
  - `llama-b11517-bin-win-cuda-12.4-x64.zip`: 265,198,716 B
  - `cudart-llama-bin-win-cuda-12.4-x64.zip`: 391,443,627 B (CUDA runtime + cuBLAS DLLs)
  - `llama-b11517-bin-win-cuda-13.4-x64.zip`: 153,434,933 B (+ cudart 13.4: 423,535,356 B)
  - `llama-b11517-bin-win-vulkan-x64.zip`: 33,445,903 B
  - `llama-b11517-bin-win-cpu-x64.zip`: 19,485,126 B
- **Which CUDA build to use**:
  - CUDA 13.x requires driver ≥ 580 [V, NVIDIA release notes]. Driver 576.02 is CUDA 12.9-class, so **use the CUDA 12.4 build** (12.x needs ≥ 525) [V].
  - Turing (CC 7.5) is supported by both CUDA 12 and 13.
  - The GTX 16-series has no tensor cores, so llama.cpp uses its non-tensor-core CUDA kernels [U: perf impact not measured].
- **Vulkan build**: a 33 MB, driver-only option with no CUDA DLLs. It is well suited for shipping the demo. Relative speed on the 1650 Ti is **[U]**, and the benchmark should check it in one optional run.
- **Endpoints [V]**:
  - OpenAI-compatible `POST /v1/chat/completions` with SSE streaming.
  - `GET /health` returns 503 `{"error":{"code":503,"message":"Loading model"...}}` while loading and 200 `{"status":"ok"}` when ready.
  - `/metrics` (with `--metrics`), `/slots`.
  - Responses include a `timings` object (`prompt_n`, `prompt_ms`, `predicted_n`, `predicted_ms`, `predicted_per_second`, `cache_n`).
- **Default port is now 9931 [V]** (README `--port`), not 8080. Always pass `--port` explicitly.
- **Constrained decoding [V]**:
  - CLI: `--grammar`, `--grammar-file`, `-j/--json-schema`, `-jf`.
  - Per request: `response_format: {"type":"json_schema","json_schema":{"schema":{...}}}`, `{"type":"json_object","schema":...}`, `json_schema` (on /completion) or `grammar` (GBNF).
  - The schema is converted to GBNF and enforced at sampling time.
- **Enum enforcement [V]**: the converter tests show `"enum": ["red","amber","green",null,42,["foo"]]` compiling to `root ::= ("\"red\"" | "\"amber\"" | ...)`, and `allOf` of enums intersecting correctly. minLength/maxLength become `char{m,n}`, `minItems`/`maxItems` are honoured, and `additionalProperties` defaults to **false**.
- **Schema limitations [V]**:
  - `uniqueItems`, `contains`, `not`, `if/then/else` are unsupported. Unsupported features are **skipped silently**.
  - Can't mix `properties` with `anyOf`/`oneOf`. Nested `$ref` is broken. `minimum`/`maximum` work only for integers.
  - "The JSON schema is only used to constrain the model output and is not injected into the prompt", so describe the schema in the prompt too.
- **Implication for our contract**:
  - Shape, enums and max lengths are guaranteed.
  - Duplicate actionIds are possible, so the game must check them.
  - A hard `maxLength` cut can truncate mid-word. Ask for ≤170/≤140 chars in the prompt while the schema enforces 200/160.
  - Grammar alone does not guarantee *profile-appropriate* choices. For per-request allowed lists, build the schema per request with only the allowed IDs; this is cheap and the grammar is cached.
- **Thinking control [V]**: `--chat-template-kwargs`, `-rea off`, `--reasoning-budget 0`, and per-request `chat_template_kwargs` / `reasoning_effort:"none"`. Jinja templating is on by default.
- **Offload [V]**: `-ngl N|auto|all` (default auto), `-c` (default 0, which means the model's max; always set it), `-fa on|off|auto`, `-ctk/-ctv` KV quant types, `-np` slots, and `--fit`/`-fitt` as noted above.
- **Startup time**: no official figure found [U].
  - Expected [E]: about 1–3 s for CUDA init, plus about 1–4 s to read a 2.5 GB GGUF from SSD (faster when it is in the OS cache), plus warmup. Roughly **3–10 s cold, ~2–4 s warm**. The benchmark measures this.
- **Offline [V/E]**: with `-m <local path>` there is no network access. `-hf` downloads, so don't use it at runtime. The web UI is local and can be disabled with `--no-webui`.

### 2.2 Ollama
- **Version [V]**: v0.40.2 (2026-10-08).
- **Windows assets [V]**: `OllamaSetup.exe` 1,578,560,904 B; `ollama-windows-amd64.zip` 1,468,085,195 B. The docs say "Allocate at least 4GB for the binary".
- **Requirements [V]**: Windows 10 22H2+ and NVIDIA driver ≥ 551.61.
  - This machine is Windows 10 **19045, which is 22H2**, so it is OK. The driver is 576.02, also OK.
- **GPU support [V]**: CC 5.0+, and the docs table explicitly lists **GTX 1650 Ti under CC 7.5**.
  - Build script has `cuda12` and `cuda13` targets, so the driver-576 machine should get the CUDA 12 backend [V source / E behaviour].
- **Structured outputs [V]**: the `format` field accepts a JSON schema. Docs recommend temperature 0 and repeating the schema in the prompt.
  - **Current source (main) `llm/llama_server.go`**: "Ollama … wraps the llama-server binary as a subprocess… For structured output, a JSON schema is passed to llama-server via its json_schema field". When thinking is on, Ollama builds a grammar that starts constraining after the thinking close tag (`llm/gbnf.go`).
  - So **enum enforcement is the same as llama.cpp's** [V source; whether v0.40.2 contains exactly this code is assumed, not diffed].
  - Older Ollama versions used their own runner. Third-party reports of schema failures mostly concern gpt-oss/Harmony [V, glukhov.org].
- **Parameters [V]**:
  - `think` takes true/false/null or "low|medium|high"; `/api/show` exposes the thinking capability.
  - `keep_alive` defaults to 5 min; use -1 to keep loaded, 0 to unload; `OLLAMA_KEEP_ALIVE` sets it globally.
  - Default context is **4096** (`OLLAMA_CONTEXT_LENGTH`, or `num_ctx` per request).
  - Other settings: `num_gpu` (layers offloaded) as a request option [V by long-standing API; not re-read today: U], `OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE` (f16/q8_0/q4_0), `OLLAMA_NUM_PARALLEL` (default 1).
  - Models are stored in `C:\Users\%username%\.ollama\models` (override with `OLLAMA_MODELS`). Binds to 127.0.0.1:11434 (`OLLAMA_HOST`).
  - Runs fully offline after `ollama pull` [V: "Ollama runs locally"]. Some app features (cloud models, update checks) need network [U].

### 2.3 Embedded llama.cpp in Godot (brief; Agent covering Godot plugins has detail)
- NobodyWho [V, GitHub] is a Rust GDExtension over llama.cpp for Godot 4.5+, licensed EUPL-1.2. Windows x86_64 builds use the **Vulkan** backend with a CPU fallback. It generates grammars from function signatures for tool calling.
- Pros: no separate process, and one install.
- Cons:
  - Inference shares the game process, so a GPU OOM or driver crash takes the game down.
  - It is harder to swap models or kill and restart.
  - Godot-side JSON-schema → grammar control is less direct than llama-server's.
- For a 20-hour build, a **sidecar llama-server process** launched with `OS.create_process()` and called through `HTTPRequest`/`HTTPClient` is lower-risk. It is crash-isolated, can be health-checked, and can be killed and restarted.

### 2.4 Runtime verdict
| Criterion | llama-server (CUDA 12.4) | Ollama 0.40.x | Embedded GDExtension |
|---|---|---|---|
| Grammar-constrained JSON schema incl. enum | **Yes [V]** | **Yes**, via bundled llama-server [V source] | Grammar yes; schema path varies [U] |
| uniqueItems | No [V] | No (same engine) | No |
| Windows CUDA on CC 7.5 / driver 576 | Yes, cuda-12.4 build | Yes (cuda12 backend) | Vulkan |
| Download | 0.63 GB (CUDA) / 33 MB (Vulkan) | 1.47–1.58 GB | plugin-sized [U] |
| Explicit VRAM control | full (`-ngl`, `-c`, `-ctk`, `--fit off`) | indirect (env + options) | limited |
| Crash isolation | separate process | separate process + service | none |
| Bundle with game | copy folder | requires install/service | built-in |

- **Dev runtime**: llama-server CUDA 12.4. Ollama is fine if a teammate already has it.
- **Demo runtime**: llama-server, shipped as a folder next to the game. Use the CUDA build if it wins the benchmark; otherwise the 33 MB Vulkan build. Godot launches it at boot, polls `/health`, and falls back to authored, deterministic event text if it isn't ready or a request fails or times out.

---

## 3. Benchmark proposal (DO NOT RUN until approved)

### 3.1 Scope
- One runtime: **llama.cpp b11517 win-cuda-12.4-x64**.
- Two models: **Qwen3-4B-Instruct-2507 Q4_K_M** (primary) and **Qwen3-1.7B Q4_K_M** (fallback).
- Two contrasting household profiles, N=25 requests each, per model. That makes 100 schema-constrained requests in total.
- Optional extras (about 10 min each):
  - 20 requests with the schema off, as a control on raw adherence.
  - 1 Vulkan run of the primary.

### 3.2 Downloads (official listings) [V sizes]
| Item | URL | Bytes |
|---|---|---|
| llama.cpp CUDA 12.4 | https://github.com/ggml-org/llama.cpp/releases/download/b11517/llama-b11517-bin-win-cuda-12.4-x64.zip | 265,198,716 |
| CUDA 12.4 runtime DLLs | https://github.com/ggml-org/llama.cpp/releases/download/b11517/cudart-llama-bin-win-cuda-12.4-x64.zip | 391,443,627 |
| Primary model | https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf (sha256 `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`) | 2,497,281,120 |
| Fallback model | https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf (sha256 `b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897`) | 1,107,409,472 |
| (optional) Vulkan build | https://github.com/ggml-org/llama.cpp/releases/download/b11517/llama-b11517-bin-win-vulkan-x64.zip | 33,445,903 |

- **Total download**: ≈ 4.26 GB (≈ 3.97 GiB).
- **Peak disk**: about 5.0–5.5 GB while the zips are kept, about 4.5 GB after deleting them [E: extracted size of zips not published].
- **Expected memory [E]**:
  - Primary: VRAM about 3.0–3.4 GiB for the llama-server process. Host RAM working set about 0.5–1.5 GB (more if mmap pages are counted).
  - Fallback: VRAM about 1.7–2.0 GiB.
- **Expected speed [E]**: GTX 1650 Ti memory bandwidth is about 192 GB/s [U: commonly listed spec; vendor page not fetched].
  - Primary decode upper bound ≈ 192/2.5 ≈ 77 tok/s. Realistic ≈ 35–50 tok/s.
  - A ~150-token JSON reply would take about 3–5 s, plus about 0.5–1.5 s of prompt processing (≈1k tokens).
  - The fallback should be about 2× faster. No trustworthy published 1650 Ti numbers were found; the "willitrunai" pages are calculators, not measurements.

### 3.3 Commands (PowerShell 5.1)

```powershell
# ---------- 0. Workspace (choose any drive; D: shown) ----------
$B = 'D:\llm-bench'
New-Item -ItemType Directory -Force "$B\bin","$B\models","$B\out" | Out-Null

# ---------- 1. Download (curl.exe ships with Win10 1803+) ----------
curl.exe -L -o "$B\llama-cuda.zip"  https://github.com/ggml-org/llama.cpp/releases/download/b11517/llama-b11517-bin-win-cuda-12.4-x64.zip
curl.exe -L -o "$B\cudart.zip"      https://github.com/ggml-org/llama.cpp/releases/download/b11517/cudart-llama-bin-win-cuda-12.4-x64.zip
curl.exe -L -o "$B\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf" https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf
curl.exe -L -o "$B\models\Qwen3-1.7B-Q4_K_M.gguf"             https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf

# ---------- 2. Verify + extract ----------
(Get-FileHash "$B\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf" -Algorithm SHA256).Hash -eq '3605803B982CB64AEAD44F6C1B2AE36E3ACDB41D8E46C8A94C6533BC4C67E597'
(Get-FileHash "$B\models\Qwen3-1.7B-Q4_K_M.gguf" -Algorithm SHA256).Hash -eq 'B139949C5BD74937AD8ED8C8CF3D9FFB1E99C866C823204DC42C0D91FA181897'
Expand-Archive "$B\llama-cuda.zip" "$B\bin" -Force
Expand-Archive "$B\cudart.zip"     "$B\bin" -Force
& "$B\bin\llama-server.exe" --version
& "$B\bin\llama-server.exe" --list-devices      # expect CUDA0: NVIDIA GeForce GTX 1650 Ti

# ---------- 3. VRAM/RAM monitors (separate windows or background) ----------
$smi = Start-Process nvidia-smi -ArgumentList '--query-gpu=timestamp,memory.used,memory.total,utilization.gpu','--format=csv','-lms','500' `
        -RedirectStandardOutput "$B\out\gpu.csv" -NoNewWindow -PassThru
# per-process GPU memory snapshot (run during load):
# nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv

# ---------- 4. Start server (primary). For fallback swap -m and add the kwargs line ----------
function Start-Llm($model, $extra) {
  # ($args is a PowerShell automatic variable - don't use that name)
  $argList = @('-m', "`"$model`"", '-c', '3072', '-ngl', '99', '-np', '1', '-fa', 'auto',
            '--host', '127.0.0.1', '--port', '8080', '--no-webui', '--metrics',
            '--log-file', "`"$B\out\server.log`"") + $extra
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process "$B\bin\llama-server.exe" -ArgumentList $argList -PassThru -WindowStyle Minimized
  do { Start-Sleep -Milliseconds 250
       try { $h = Invoke-WebRequest http://127.0.0.1:8080/health -UseBasicParsing -TimeoutSec 2; $ok = ($h.StatusCode -eq 200) } catch { $ok = $false }
  } until ($ok -or $sw.Elapsed.TotalSeconds -gt 120)
  "cold_start_s=$($sw.Elapsed.TotalSeconds)" | Tee-Object -Append "$B\out\coldstart.txt"
  return $p
}
$srv = Start-Llm "$B\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf" @()
# Fallback: Start-Llm "$B\models\Qwen3-1.7B-Q4_K_M.gguf" @('--chat-template-kwargs','{\"enable_thinking\":false}')
# Check log: Select-String 'offloaded' "$B\out\server.log"   -> must be N/N layers
```

Run the benchmark loop below. Save it as `$B\bench.ps1` and run it with `powershell -ExecutionPolicy Bypass -File $B\bench.ps1 -Model primary -N 25`.

```powershell
param([string]$Model='primary', [int]$N=25, [switch]$NoSchema)
Add-Type -AssemblyName System.Net.Http
$B='D:\llm-bench'; $url='http://127.0.0.1:8080/v1/chat/completions'
$EVENTS   = @('HOUSEHOLD_PLAN')
$VARIANTS = @('HOUSEHOLD_PLAN__ASSISTANCE','HOUSEHOLD_PLAN__STANDARD','HOUSEHOLD_PLAN__INFANT')
$SPEAKERS = @('NPC_FAMILY_MEMBER','NPC_BARANGAY_OFFICIAL','NPC_NEIGHBOR')
$ACTIONS  = @('PLAN_ASSISTANCE','AGREE_MEETING_PLAN','DELAY','PACK_GO_BAG','CHECK_EVAC_ROUTE')
$schema = @{ type='object'; additionalProperties=$false
  required=@('schemaVersion','eventId','variantId','speaker','dialogue','description','actionIds')
  properties=[ordered]@{
    schemaVersion=@{type='integer'; enum=@(1)}
    eventId=@{type='string'; enum=$EVENTS}
    variantId=@{type='string'; enum=$VARIANTS}
    speaker=@{type='string'; enum=$SPEAKERS}
    dialogue=@{type='string'; minLength=1; maxLength=200}
    description=@{type='string'; minLength=1; maxLength=160}
    actionIds=@{type='array'; items=@{type='string'; enum=$ACTIONS}; minItems=1; maxItems=3} } }
$profiles = @{
  A = '{"household":{"members":["lola_78_wheelchair","adult_45","teen_15"],"home":"light_materials_coastal_lowland","vehicle":false},"phase":"PSWS_2","flags":{"goBag":false}}'
  B = '{"household":{"members":["adult_30","adult_29","infant_0"],"home":"concrete_upland","vehicle":true},"phase":"PSWS_2","flags":{"goBag":true}}' }
$expect = @{ A='HOUSEHOLD_PLAN__ASSISTANCE'; B='HOUSEHOLD_PLAN__INFANT' }   # soft semantic check
$sys = "You are the scenario director for a typhoon-preparedness game. Reply with ONE JSON object only. " +
       "Keys: schemaVersion(1), eventId, variantId, speaker, dialogue(<=170 chars), description(<=140 chars), actionIds(1-3 unique). " +
       "Choose ONLY from these IDs. eventId: $($EVENTS -join ',') variantId: $($VARIANTS -join ',') speaker: $($SPEAKERS -join ',') actionIds: $($ACTIONS -join ',')"
$client = New-Object System.Net.Http.HttpClient; $client.Timeout=[TimeSpan]::FromSeconds(120)
$rows = @()
foreach ($pk in @('A','B')) { for ($i=1; $i -le $N; $i++) {
  $body = [ordered]@{ messages=@(@{role='system';content=$sys},@{role='user';content="REQUEST: $($profiles[$pk])"})
          temperature=0.7; top_p=0.8; top_k=20; max_tokens=320; stream=$true
          chat_template_kwargs=@{enable_thinking=$false} }
  if (-not $NoSchema) { $body.response_format=@{type='json_schema'; json_schema=@{name='event'; strict=$true; schema=$schema}} }
  $json = $body | ConvertTo-Json -Depth 20 -Compress
  $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post,$url)
  $req.Content = New-Object System.Net.Http.StringContent($json,[Text.Encoding]::UTF8,'application/json')
  $sw=[Diagnostics.Stopwatch]::StartNew(); $ttft=-1; $sb=New-Object Text.StringBuilder; $tim=$null; $err=''
  try {
    $resp=$client.SendAsync($req,[System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    $rd=New-Object IO.StreamReader($resp.Content.ReadAsStreamAsync().GetAwaiter().GetResult())
    while (-not $rd.EndOfStream) { $line=$rd.ReadLine()
      if ($line.StartsWith('data: ')) { $p=$line.Substring(6); if ($p -eq '[DONE]') { break }
        $o=$p | ConvertFrom-Json
        if ($o.choices -and $o.choices.Count -gt 0 -and $o.choices[0].delta.content) {
          if ($ttft -lt 0) { $ttft=$sw.Elapsed.TotalMilliseconds }; [void]$sb.Append($o.choices[0].delta.content) }
        if ($o.timings) { $tim=$o.timings } } }
  } catch { $err=$_.Exception.Message }
  $total=$sw.Elapsed.TotalMilliseconds; $txt=$sb.ToString()
  $valid=$false; $contract=$false; $sem=$false
  try { $r=$txt | ConvertFrom-Json; $valid=$true
    $ids=@($r.actionIds)
    $contract = ($r.schemaVersion -eq 1) -and ($EVENTS -contains $r.eventId) -and ($VARIANTS -contains $r.variantId) -and
                ($SPEAKERS -contains $r.speaker) -and ($r.dialogue.Length -ge 1) -and ($r.dialogue.Length -le 200) -and
                ($r.description.Length -ge 1) -and ($r.description.Length -le 160) -and ($ids.Count -ge 1) -and ($ids.Count -le 3) -and
                (@($ids | Where-Object { $ACTIONS -notcontains $_ }).Count -eq 0) -and (@($ids | Select-Object -Unique).Count -eq $ids.Count) -and
                (@($r.PSObject.Properties.Name).Count -eq 7)
    $sem = ($r.variantId -eq $expect[$pk]) } catch {}
  $ws=(Get-Process llama-server -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum
  $rows += [pscustomobject]@{model=$Model; profile=$pk; i=$i; schema=(-not $NoSchema); valid=$valid; contract=$contract; semantic=$sem
    ttft_ms=[int]$ttft; total_ms=[int]$total; prompt_n=$tim.prompt_n; prompt_ms=$tim.prompt_ms; gen_n=$tim.predicted_n
    gen_tps=$tim.predicted_per_second; ram_mb=[int]($ws/1MB); err=$err; text=$txt }
} }
$tag = "{0}_{1}" -f $Model, $(if ($NoSchema) {'noschema'} else {'schema'})
$rows | Export-Csv "$B\out\bench_$tag.csv" -NoTypeInformation
function P($a,$q){ $s=@($a|Sort-Object); if($s.Count -eq 0){return $null}; $s[[math]::Min($s.Count-1,[math]::Ceiling($q*$s.Count)-1)] }
$ok = $rows | Where-Object { $_.err -eq '' }
"{0}: valid={1:P1} contract={2:P1} semantic={3:P1} ttft_p50={4} ttft_p95={5} total_p50={6} total_p95={7} gen_tps_avg={8:N1}" -f $tag,
  (@($rows|?{$_.valid}).Count/$rows.Count), (@($rows|?{$_.contract}).Count/$rows.Count), (@($rows|?{$_.semantic}).Count/$rows.Count),
  (P $ok.ttft_ms 0.5),(P $ok.ttft_ms 0.95),(P $ok.total_ms 0.5),(P $ok.total_ms 0.95),(($ok | Measure-Object gen_tps -Average).Average)
```

```powershell
# ---------- 5. Run sequence ----------
powershell -ExecutionPolicy Bypass -File D:\llm-bench\bench.ps1 -Model primary -N 25
#   (optional control) ... -Model primary -N 10 -NoSchema
Stop-Process -Id $srv.Id -Force
$srv = Start-Llm "D:\llm-bench\models\Qwen3-1.7B-Q4_K_M.gguf" @('--chat-template-kwargs','{\"enable_thinking\":false}')
powershell -ExecutionPolicy Bypass -File D:\llm-bench\bench.ps1 -Model fallback -N 25
# Repeat the primary run once WITH the Godot project (or any 2D scene) running, to capture GPU contention.

# ---------- 6. Offline test ----------
# Option A (admin PowerShell):
Get-NetAdapter | Where-Object Status -eq 'Up' | Tee-Object -Variable up | Disable-NetAdapter -Confirm:$false
#   restart server (Stop-Process; Start-Llm ...), run: bench.ps1 -Model primary_offline -N 5
$up | Enable-NetAdapter -Confirm:$false
# Option B: toggle Airplane mode in Action Center, then run the same 5 requests.

# ---------- 7. Failure-recovery test ----------
# Terminal 1: bench.ps1 -Model primary_kill -N 10      Terminal 2 (~3 s later):
Stop-Process -Name llama-server -Force
# Expect: in-flight request -> err populated (client must not hang beyond timeout); then
$t=[Diagnostics.Stopwatch]::StartNew(); $srv = Start-Llm "D:\llm-bench\models\Qwen3-4B-Instruct-2507-Q4_K_M.gguf" @(); "recovery_s=$($t.Elapsed.TotalSeconds)"
# Run bench.ps1 -N 3 again -> must succeed. Also check nvidia-smi shows VRAM released after the kill.

# ---------- 8. Stop monitors + summarize VRAM ----------
Stop-Process -Id $smi.Id
Import-Csv D:\llm-bench\out\gpu.csv | ForEach-Object { [int](($_.' memory.used [MiB]') -replace '[^\d]','') } | Measure-Object -Maximum -Minimum

# ---------- 9. Cleanup ----------
Stop-Process -Name llama-server -Force -ErrorAction SilentlyContinue
Copy-Item D:\llm-bench\out\* <somewhere-in-repo-or-notes> -Recurse   # keep results first
Remove-Item -Recurse -Force D:\llm-bench
# (Nothing else is installed: no services, registry, PATH changes. If '-hf' was ever used, also remove "$env:LOCALAPPDATA\llama.cpp".)
```

Notes:
- PS 5.1 `Start-Process` quoting of `{\"enable_thinking\":false}` is fragile. The bench script also sends `chat_template_kwargs` per request, so the server-side flag is just extra insurance. If quoting fails, drop that flag, or use `-rea off`.
- Swap the placeholder enum lists for the real game IDs before running.
- Build the schema per request from the request's *allowed* IDs. That is how the game should do it too.
- Do the semantic check on more than one field if the event design allows it.

### 3.4 Success criteria (proposed thresholds)
| Metric | Primary (Qwen3-4B-2507) | Fallback (Qwen3-1.7B) |
|---|---|---|
| JSON-parse valid, schema ON | ≥ 99% (grammar should give 100%; a failure means a `max_tokens` cutoff) | ≥ 99% |
| Full contract compliance (enums, lengths, 7 keys, unique actionIds) | ≥ 95% | ≥ 95% |
| Semantic variant match to profile (soft) | ≥ 80% | ≥ 65% |
| TTFT p95 (streaming) | ≤ 1.5 s | ≤ 1.0 s |
| Total latency p50 / p95 | ≤ 4 s / ≤ 8 s | ≤ 2.5 s / ≤ 4 s |
| Decode tok/s (avg) | ≥ 25 | ≥ 50 |
| Cold start (spawn → /health 200) | ≤ 20 s | ≤ 15 s |
| Peak GPU memory used (nvidia-smi total, game running) | ≤ 3.8 GiB, no OOM, 100% layers offloaded | ≤ 3.0 GiB |
| VRAM / RAM drift over the run | < 50 MiB growth | same |
| Offline run | 5/5 succeed | — |
| Kill/recover | client errors within timeout; restart ≤ 20 s; next 3 requests OK | — |

Decision rules:
- If the primary misses the VRAM or latency targets but passes on quality, retry it with `-c 2048 -ctk q8_0 -ctv q8_0`.
- If it still fails, ship the fallback as the default.
- If both pass, ship the primary and keep the fallback as a CPU or low-VRAM mode (`-ngl 0`). On the CPU, expect roughly 8–20 tok/s [E].
- If the primary fails on narrative quality, benchmark Qwen3.5-4B (`enable_thinking:false`) next.

---

## 4. Claims I could NOT verify
1. Real tokens/s, prompt-processing speed and cold-start time on a GTX 1650 Ti for any of these models. No trustworthy published benchmark was found; all latency figures are estimates.
2. GTX 1650 Ti mobile memory bandwidth (≈192 GB/s); the vendor and spec pages blocked fetching.
3. CUDA context and compute-buffer VRAM overheads (250–500 MiB each, estimated).
4. Whether llama.cpp keeps Gemma 4 / Gemma 3n Per-Layer-Embedding tables in host RAM (which decides whether E2B fits in 4 GB).
5. Non-thinking-mode IF scores for Qwen3.5-4B and Granite-4.2-3B; Phi-4-mini's IFEval number; Ministral-3-3B IFEval; Qwen3-0.6B IFEval.
6. Speed of Qwen3.5's Gated-DeltaNet layers and Nemotron-H's Mamba layers in llama.cpp CUDA on Turing (no tensor cores).
7. That Ollama **v0.40.2 specifically** contains the `llama_server.go` json_schema passthrough. I verified it on the `main` branch only. I also did not re-verify `num_gpu` in today's docs, or whether the Ollama app makes background network calls.
8. Extracted (unzipped) disk size of the llama.cpp CUDA and cudart zips.
9. Vulkan vs CUDA relative performance on this GPU.
10. Gemma 4 public launch date: the HF repos were created 2026-03-02 and press says April 2026. The exact date doesn't matter for this decision.

---

## 5. Sources (all accessed 2026-10-09)
- Qwen3.5 model cards and configs: https://huggingface.co/Qwen/Qwen3.5-4B , https://huggingface.co/Qwen/Qwen3.5-2B , https://huggingface.co/Qwen/Qwen3.5-0.8B (README and config.json); HF API listing https://huggingface.co/api/models?author=Qwen&search=Qwen3.5
- Qwen3-4B-Instruct-2507 card: https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507 ; Qwen3-1.7B card: https://huggingface.co/Qwen/Qwen3-1.7B
- GGUF listings (tree API): https://huggingface.co/api/models/unsloth/Qwen3-4B-Instruct-2507-GGUF/tree/main , …/unsloth/Qwen3.5-4B-GGUF, …/unsloth/Qwen3.5-2B-GGUF, …/unsloth/Qwen3.5-0.8B-GGUF, …/Qwen/Qwen3-4B-GGUF, …/Qwen/Qwen3-1.7B-GGUF, …/Qwen/Qwen3-0.6B-GGUF, …/unsloth/Qwen3-1.7B-GGUF, …/unsloth/Qwen3-0.6B-GGUF, …/google/gemma-4-E2B-it-qat-q4_0-gguf, …/google/gemma-4-E4B-it-qat-q4_0-gguf, …/ggml-org/gemma-4-E2B-it-GGUF, …/ggml-org/gemma-4-E4B-it-GGUF, …/unsloth/gemma-4-E2B-it-GGUF, …/unsloth/gemma-4-E4B-it-GGUF, …/google/gemma-3-4b-it-qat-q4_0-gguf, …/google/gemma-3-1b-it-qat-q4_0-gguf, …/unsloth/gemma-3n-E2B-it-GGUF, …/unsloth/Phi-4-mini-instruct-GGUF, …/ggml-org/SmolLM3-3B-GGUF, …/unsloth/Llama-3.2-3B-Instruct-GGUF, …/unsloth/Llama-3.2-1B-Instruct-GGUF, …/ibm-granite/granite-4.2-3b-GGUF, …/LiquidAI/LFM2.5-1.2B-Instruct-GGUF, …/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF, …/mistralai/Ministral-3-3B-Instruct-2512-GGUF
- Gemma 4 card: https://huggingface.co/google/gemma-4-E2B-it ; license: https://ai.google.dev/gemma/docs/gemma_4_license ; Gemma 3 card: https://ai.google.dev/gemma/docs/core/model_card_3 ; Gemma terms: https://ai.google.dev/gemma/terms
- Other cards: https://huggingface.co/microsoft/Phi-4-mini-instruct , https://huggingface.co/HuggingFaceTB/SmolLM3-3B , https://huggingface.co/ibm-granite/granite-4.2-3b , https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct (+ LICENSE), https://huggingface.co/LiquidAI/LFM2.5-2.6B , https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF , https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512
- Llama 3.2: https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/MODEL_CARD.md and LICENSE
- llama.cpp: releases API https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/b11517 ; server README https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md ; grammars README https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md ; schema tests https://github.com/ggml-org/llama.cpp/blob/master/tests/test-json-schema-to-grammar.cpp
- Ollama: https://docs.ollama.com/gpu , https://docs.ollama.com/windows , https://docs.ollama.com/faq , https://docs.ollama.com/capabilities/structured-outputs , https://docs.ollama.com/capabilities/thinking , releases API https://api.github.com/repos/ollama/ollama/releases/latest , source https://github.com/ollama/ollama/blob/main/llm/llama_server.go , https://github.com/ollama/ollama/blob/main/llm/gbnf.go , https://github.com/ollama/ollama/blob/main/scripts/build_windows.ps1 ; library tags https://ollama.com/library/qwen3/tags , https://ollama.com/library/qwen3.5/tags , https://ollama.com/library/gemma4/tags
- NVIDIA CUDA 13.0 release notes (driver ≥580): https://docs.nvidia.com/cuda/archive/13.0.0/cuda-toolkit-release-notes/index.html
- NobodyWho: https://github.com/nobodywho-ooo/nobodywho
- Ollama structured-output issue context: https://www.glukhov.org/post/2025/10/ollama-gpt-oss-structured-output-issues/
- hf-mem guidance: local skill file %USERPROFILE%\.claude\plugins\cache\claude-plugins-official\huggingface-skills\1.0.29\skills\hf-mem\SKILL.md


---

## 6. Measured results (Stage B)

All figures below are **[M] measured on 2026-10-09** on the baseline laptop (GTX 1650 Ti 4 GB, driver 576.02). Runtime: llama.cpp b11517 win-cuda-12.4-x64 + cudart 12.4. The CUDA toolkit was **removed from PATH**, so only the bundled DLLs were available. Model: Qwen3-1.7B-Q4_K_M with `--reasoning off`, `-ngl 99 -c 3072 -np 1`. Requests used a per-request JSON Schema generated by `z.toJSONSchema()` (Zod 4.6.5), sent as `response_format: json_schema`.

### 6.1 Startup
| Case | Time to `/health` 200 |
|---|---|
| Very first launch on this machine (CLI) | **44.7 s**. A one-time warm-up; 41 s were spent after the thread-pool init. |
| Next launches (CLI and Electron dev) | **2.4–3.0 s** |
| Packaged `SignalNo5.exe`, model at a new path on the D: HDD | 6.8 s |
| Bench run, first read of the file after packaging | 14.4 s |

**Implications:**
- The first launch on any new machine is slow. Show a "warming up the AI" state, and **run the app once before the demo** on the demo machine.
- The model lives on D:, the HDD, so cold reads are slower. Keep the demo copy on an SSD where possible.

### 6.2 Generation: 30 requests (2 contrasting profiles × 5 events × 3 reps)
| Metric | Result |
|---|---|
| Valid JSON + Zod contract (incl. duplicate check and blocklist) | **30/30** |
| Total latency per request | p50 **1.94 s**, p95 **2.15 s**, max 2.22 s |
| Prompt processing (~300–350 tokens, no cache) | p50 721 ms |
| Decode speed | p50 **75 tok/s** (range 75–84) |
| GPU memory | baseline 343 MiB → peak 1,892 MiB (**+1,549 MiB**) |
| Server peak working set | 1,682 MB |

**Fault injection through the full Electron IPC path:** bad JSON, an unknown action ID, over-length dialogue and duplicate action IDs were each rejected and replaced by fallback content (`source:"fallback"`), 4/4.

### 6.3 Quality observations (NOT proof of educational correctness)
- **Wrong variant 3/3 times.** For the "with others + assistance needed" profile, the model chose `HOUSEHOLD_PLAN__WITH_OTHERS` instead of `__ASSISTANCE` every time. Variant selection by the model is unreliable at 1.7B.
- **Actions dropped.** The model often returned only 1–2 of the allowed actions, e.g. dropping `DELAY` or `PLAN_ASSISTANCE`. That would silently remove player choices.
- **Flat dialogue.** It's short and instruction-like ("Check advisory for weather updates."), with weak use of the household context. It's acceptable for the pipeline, but thin for the "meaningful personalization" judging criterion.

These results motivate the contract proposal in ARCHITECTURE_LOCK §10 and the Qwen3-4B comparison.

### 6.5 Head-to-head with P1/P2 applied: Qwen3-1.7B vs Qwen3-4B-Instruct-2507 [M, 2026-10-09]

**Identical conditions for both models:**
- The same 30 requests: profile A (apartment, alone, go-bag ready) and profile B (single-story, with others, assistance yes, essential supplies yes, go-bag partial) × 5 events × 3 state variations of flags, inventory and recent decisions.
- The same system prompt, the same per-request schema (variant `const`, `actionIds` exact tuple), and the same sampling (T 0.7, top_p 0.8, top_k 20, max_tokens 300, no prompt cache).
- The same server flags (`-ngl 99 -c 3072 -np 1 --reasoning off`) and the same validation.
- The 1.7B file was read from the D: HDD; the 4B file from the C: SSD.

**Integration finding:** Zod's tuple emits `"items": false`, which llama.cpp rejects with HTTP 400 ("schema must be an object"). The adapter strips boolean `items`. `prefixItems` plus `minItems = maxItems` still pin the list.

| Metric | Qwen3-1.7B Q4_K_M | Qwen3-4B-Instruct-2507 Q4_K_M |
|---|---|---|
| JSON + Zod validity | 30/30 | 30/30 |
| Exact action list (no add/remove/duplicate/reorder) | 30/30 | 30/30 |
| Unknown or duplicate action IDs | 0 | 0 |
| Layers on GPU | 29/29 | **37/37** (no CPU offload needed) |
| GPU memory, total (desktop baseline ≈ 350 MiB) | peak 1,888 MiB (+1,539) | peak **3,353 MiB** (+2,996), ≈ 740 MiB headroom |
| Server peak working set | 1,735 MB | 3,232 MB |
| Load time: first ever / warm restart | 44.7 s first ever (§6.1) · 2.9–3.6 s | **19.2 s** first ever · 3.1 s |
| Latency mean / p50 / p95 / max | 2.49 / 2.36 / 3.15 / 4.58 s | 5.76 / **4.99** / **6.60** / 24.7 s* |
| Prompt processing p50 · decode p50 | 0.84 s · 78 tok/s | 2.12 s · 41 tok/s |
| Generated tokens p50 | 104 | 109 |
| Non-loopback TCP connections mid-run | none observed† | none observed† |

\* The 24.7 s request was the **first request after load** (a one-time warm-up). Excluding it, the max is 6.6 s. The fix is a warm-up request during the loading screen.
† `Get-NetTCPConnection` filtered for remote addresses other than loopback returned an empty result. This is a proxy only; the airplane-mode test is still pending.

#### Automated semantic checks (regex heuristics; they flag items for review, they don't prove anything)
| Check | What it tests | 1.7B | 4B |
|---|---|---|---|
| S1 variant fit | `__ASSISTANCE` mentions help or someone; `__ALONE` has no family terms; `__PARTIAL` signals incompleteness; `__READY` makes no "not packed" claim | 11/15 | 13/15 |
| S2 household | "alone" profile: no family members mentioned | 15/15 | 15/15 |
| S3 previous decisions / state | Doesn't claim the advisory was checked when `WARNING_CHECKED=false` | 10/10 | 9/10 |
| S4 state | Doesn't say "need to pack" when `GO_BAG_PACKED=true` | 18/20 | 20/20 |
| S5 resources | Mentions no items absent from inventory and allowed actions | 29/30 | 28/30 |
| S6 safety | No medical instructions, signal levels, evacuation destinations, hotlines or "guaranteed/safe to" claims | 30/30 | **29/30** |

Several S1/S4 results are regex false positives or negatives. For example, 4B's "you've started packing, let's add more" *does* fit `__PARTIAL`. The fixture also combines B `goBagStatus: partial` with `GO_BAG_PACKED: true` in rep 2, which is an ambiguous state.

#### Reviewer judgement: 10 side-by-side samples (rep 0, profiles A and B × 5 events)
**Reviewer: Claude (AI). To be confirmed by a team member.** Rubric per sample, 0–2 on each of three dimensions:
- **V fit:** matches the selected variant and the household.
- **N voice:** natural, in-character NPC speech, not instructions.
- **G grounded:** invents no forecast, warning, advisory content, places, services, resources or safety instructions. Any invented official or forecast fact scores 0.

| Model | V (/20) | N (/20) | G (/20) | Total (/60) |
|---|---|---|---|---|
| Qwen3-1.7B | 9 | 6 | 19 | 34 |
| Qwen3-4B-2507 | 17 | 20 | **9** | 46 |

**Qualitative read:**
- **1.7B** is safe but flat and instruction-like ("Check the flashlight and conserve the phone battery."). It sometimes contradicts the variant: "We need to pack the go bag properly" for `__READY`, and "we/household" for `__ALONE`.
- **4B** is clearly more personal and in-character: "I'll help you grab the go bag, just let me know what you need from it." But in **4 of the 10 samples** it invented facts the game must never assert:
  - "The advisory says to head to the community center", which is an invented evacuation instruction plus a location.
  - "no typhoon today" and "typhoon warning, but it's not expected to hit directly", which are invented forecasts.
  - "the community center… can help with supplies and transport for older family members", an invented service.
  - It also mentioned a flashlight and radio that weren't in the inventory.

  Only one of these was caught by the S6 regex.

### 6.4 Corrections to the research above
- The llama-server default port in b11517 is **8080**. The "9931" reported earlier was wrong. We pass `--port` explicitly anyway.
- The server logs: *"no API key is set and CORS allows all origins"*. Any local web page could call it. Fixed by passing a random per-launch `--api-key`, which the main process sends as a Bearer token.
- `--no-webui`, `--alias` and `--reasoning off` all exist in b11517 [V: `--help`].
