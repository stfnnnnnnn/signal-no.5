# Skill Configuration

This file lists the Claude Code skills available for this project and explains how to set them up on a new machine.

Animation skills and frontend/design skills are **not** included here. That covers `animate`, `impeccable`, `frontend-design`, `ui-ux-pro-max`, and the rest of the design pack.

---

## 1. Requirements

- Claude Code (CLI, the VS Code extension, or the desktop app), signed in to a Claude account.
- Git, so plugins can be installed from GitHub marketplaces.
- Optional:
  - Python 3.10+ for the Hugging Face CLI.
  - Node 18+ for the Vercel CLI.

Check what you have:

```bash
claude --version
git --version
```

---

## 2. Where skills come from

| Source | How you get it | Skills |
|---|---|---|
| **Built-in** | Included with Claude Code | `code-review`, `simplify`, `security-review`, `init`, `run`, `loop`, `schedule`, `claude-api`, `update-config`, `fewer-permission-prompts`, `keybindings-help`, `plugin-authoring` |
| **superpowers** plugin | Plugin install | `superpowers:*` |
| **commit-commands** plugin | Plugin install | `commit-commands:*` |
| **code-review** plugin | Plugin install | `code-review:code-review` |
| **remember** plugin | Plugin install | `remember:*` |
| **huggingface-skills** plugin | Plugin install, then HF login | `huggingface-skills:*` |
| **vercel** plugin | Plugin install, then Vercel login | `vercel:*` |
| **Anthropic skills** | Come with your claude.ai account (Settings → Capabilities) | `anthropic-skills:*`, `artifact-*`, `dataviz` |

---

## 3. Setup steps

### Step 1: Add the plugin marketplaces

Run these inside a Claude Code session:

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add obra/superpowers-marketplace
```

### Step 2: Install the plugins

```
/plugin install superpowers@claude-plugins-official
/plugin install commit-commands@claude-plugins-official
/plugin install code-review@claude-plugins-official
/plugin install remember@claude-plugins-official
/plugin install huggingface-skills@claude-plugins-official
/plugin install vercel@claude-plugins-official
```

You can also run `/plugin` and pick each plugin from the menu. When it asks for a scope, choose **Project** so the plugin is saved in this repo's settings.

### Step 3: Confirm the project settings

After Step 2, `.claude/settings.json` in this repo should look like this. Committing it means teammates get the same plugins:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "commit-commands@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "remember@claude-plugins-official": true,
    "huggingface-skills@claude-plugins-official": true,
    "vercel@claude-plugins-official": true,
    "playwright@anthropic-plugin-directory": true
  }
}
```

> `playwright` is a browser-automation MCP server, not a skill. It is listed because `run` and `superpowers:verification-before-completion` use it to check the app in a real browser.

### Step 4: Sign in to the plugins that need accounts

**Hugging Face** (needed to download models and use the Hub):

```bash
pip install -U "huggingface_hub[cli]"
hf auth login        # paste a token from https://huggingface.co/settings/tokens
```

Then run `/mcp` in Claude Code, choose `plugin:huggingface-skills:huggingface-skills`, and authorize it.

**Vercel** (only needed if you deploy to Vercel):

```bash
npm i -g vercel
vercel login
```

Then run `/mcp`, choose `plugin:vercel:vercel`, and authorize it.

### Step 5: Turn on the Anthropic skills

Go to **claude.ai → Settings → Capabilities** and turn on Skills. The `anthropic-skills:*` set (docx, pptx, xlsx, pdf, deep-research, and others) then appears in Claude Code automatically when you sign in with the same account.

### Step 6: Restart and check

Restart Claude Code, or run `/reload-plugins`. Then ask:

```
list the available skills
```

Every skill in Section 4 should be listed. If one is missing, see Section 6.

---

## 4. Skill reference

### Workflow and process: `superpowers`

| Skill | Use it when |
|---|---|
| `superpowers:brainstorming` | Before building any feature: work out the intent and requirements first |
| `superpowers:writing-plans` | You have requirements and need a step-by-step implementation plan |
| `superpowers:executing-plans` | Carrying out a written plan, with review checkpoints |
| `superpowers:subagent-driven-development` | Running plan tasks with subagents in the current session |
| `superpowers:dispatching-parallel-agents` | There are 2 or more independent tasks to run in parallel |
| `superpowers:test-driven-development` | Writing tests before the implementation |
| `superpowers:systematic-debugging` | Any bug or failing test, before proposing a fix |
| `superpowers:verification-before-completion` | Before saying something is done: run it and show the evidence |
| `superpowers:requesting-code-review` | After finishing a feature, before merging |
| `superpowers:receiving-code-review` | Acting on review feedback carefully |
| `superpowers:using-git-worktrees` | Keeping feature work isolated from the main working copy |
| `superpowers:finishing-a-development-branch` | Deciding how to merge or integrate finished work |
| `superpowers:writing-skills` | Creating or editing your own skills |
| `superpowers:diagnosing-superpowers` | Figuring out why a session went badly |

**These map onto the project workflow in CLAUDE.md:**
Inspect → `brainstorming` · Plan → `writing-plans` · Implement → `executing-plans` / `test-driven-development` · Validate → `verification-before-completion` · Report → `requesting-code-review`

### Code quality and git

| Skill | Use it when |
|---|---|
| `code-review` | Reviewing the current changes for bugs (`/code-review low`…`max`, or `ultra` for a cloud review) |
| `code-review:code-review` | Reviewing a GitHub pull request |
| `simplify` | Cleaning up changed code (does not look for bugs) |
| `security-review` | Running a security pass on the changes |
| `commit-commands:commit` | Creating a commit |
| `commit-commands:commit-push-pr` | Committing, pushing, and opening a PR in one step |
| `commit-commands:clean_gone` | Deleting local branches whose remote branch is gone |

### Running and project setup (built-in)

| Skill | Use it when |
|---|---|
| `init` | Creating or refreshing CLAUDE.md |
| `run` | Starting the app and checking that a change actually works |
| `update-config` | Changing settings, permissions, hooks, or environment variables |
| `fewer-permission-prompts` | Allowlisting read-only commands you run often |
| `keybindings-help` | Customizing keyboard shortcuts |
| `plugin-authoring` | Writing your own Claude Code plugin or hooks |
| `loop` | Repeating a task on an interval (e.g. `/loop 5m …`) |
| `schedule` | Running cloud agents on a schedule |
| `claude-api` | Working with the Claude API or Anthropic SDK |

### Local AI and Hugging Face (`huggingface-skills`)

These are the most relevant to this project's local AI inference requirement.

| Skill | Use it when |
|---|---|
| `huggingface-local-models` | Running models locally with llama.cpp / GGUF (CPU, CUDA, Metal) |
| `transformers-js` | Running models in the browser or Node with no server |
| `huggingface-best` | Choosing the best model for a task or for your hardware |
| `hf-mem` | Estimating how much RAM/VRAM a model needs |
| `hf-cli` | Downloading models and datasets, managing the cache and repos |
| `huggingface-gradio` | Building a quick Python demo UI |
| `huggingface-spaces` / `huggingface-zerogpu` | Hosting a demo on HF Spaces |
| `huggingface-datasets` | Browsing or querying datasets |
| `huggingface-papers` / `huggingface-paper-publisher` | Researching papers or publishing them on the Hub |
| `huggingface-tool-builder` | Building tools that use the Hub API |
| `huggingface-llm-trainer` / `trl-training` | Fine-tuning LLMs |
| `huggingface-vision-trainer` | Training vision models |
| `train-sentence-transformers` | Training embedding models |
| `huggingface-lora-space-builder` | Building a LoRA demo Space |
| `huggingface-community-evals` | Evaluating models locally |
| `huggingface-trackio` | Tracking experiments |
| `hf-cloud-*` (5 skills) | Deploying to AWS SageMaker; not needed for a local prototype |

### Deployment (`vercel`)

| Skill | Use it when |
|---|---|
| `vercel:deploy` | Deploying a preview (`/vercel:deploy`) or to production (`/vercel:deploy prod`) |
| `vercel:env` / `vercel:status` / `vercel:bootstrap` | Managing environment variables, checking project status, setting up the project |
| `vercel:nextjs`, `vercel:ai-sdk`, `vercel:vercel-functions`, `vercel:vercel-storage`, `vercel:workflow`, `vercel:ai-gateway`, … | Framework and platform reference while building |

### Memory (`remember`)

| Skill | Use it when |
|---|---|
| `remember:remember` | Saving the session state so the next session can pick up where you left off |
| `remember:doctor` | Checking that memory capture is working |

### Documents, research, and artifacts (claude.ai account)

| Skill | Use it when |
|---|---|
| `anthropic-skills:deep-research` | Doing multi-source research |
| `anthropic-skills:docx` / `pptx` / `xlsx` / `pdf` | Producing Word, PowerPoint, Excel, or PDF files (e.g. the hackathon pitch deck) |
| `anthropic-skills:docs` | Working on shared Claude Docs |
| `anthropic-skills:skill-creator` | Writing new skills |
| `anthropic-skills:built-in-browser` / `chrome-browser` / `computer-use` | Controlling a browser or the desktop |
| `dataviz` | Making any chart or graph |
| `artifact-design` / `artifact-diagramming` / `artifact-capabilities` | Publishing web pages or diagrams as claude.ai artifacts |

---

## 5. How to use a skill

- **Run it directly:** type `/skill-name`, e.g. `/superpowers:brainstorming` or `/code-review high`.
- **Let Claude choose:** describe the task, e.g. "find a small local model for summarizing text". Claude loads the matching skill on its own.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| A skill isn't listed | Run `/plugin` and check that the plugin is installed **and** enabled, then run `/reload-plugins` |
| "MCP server requires authentication" | Run `/mcp`, choose the server, and authorize it (see Step 4) |
| `anthropic-skills:*` is missing | Turn on Skills at claude.ai → Settings → Capabilities, then sign in again |
| Skills show up twice | The same plugin is enabled from two marketplaces. Keep only one, e.g. `superpowers@claude-plugins-official` |
| A marketplace is out of date | Run `/plugin marketplace update <name>` |
