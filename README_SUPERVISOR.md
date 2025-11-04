# KiloCode Local Supervisor (experimental)

**Goal**: Add a local, privacy-first supervision loop to KiloCode that **detects failures**, **explains root causes**, and **proposes or applies safe remediations** using a **local LLM** (Ollama/llama.cpp), without changing KiloCode’s core UX.

## Why

KiloCode occasionally trips on predictable issues (missing folders, path mistakes, flaky tests, version drift). Humans end up doing repetitive fixes. The **Local Supervisor** automates that boilerplate and keeps the agent on task.

## Key Capabilities

- Observe terminal/task output, file edits, and (optionally) MCP tool calls
- Classify failures and generate a **Remediation Plan** (minimal patches/commands/tests)
- **Policy‑gated auto‑fix** for low‑risk scenarios; ask user otherwise
- Lightweight **Reflexion memory** per repo to reuse effective fixes
- **Local‑only** by default (bind to `127.0.0.1`), container‑friendly

## Quickstart (Dev Container)

Prereqs: Docker Desktop, VS Code, **Dev Containers** extension.

```bash
# 1) Fork the upstream repo on GitHub, then clone your fork
git clone https://github.com/<YOU>/kilocode.git
cd kilocode


# 2) Open in VS Code and Reopen in Container (Node 20)
# Command Palette → “Dev Containers: Reopen in Container”


# 3) Inside the container
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
pnpm -w check-types || true && pnpm -w lint || true


# 4) Build the extension (optional .vsix)
pnpm build
# Install latest vsix in your VS Code host (optional):
code --install-extension $(ls -1v bin/kilo-code-*.vsix | tail -n1)
```
