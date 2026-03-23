---
name: browser-use
description: Add browser-use web research integration to NanoClaw. Gives agents a background research tool backed by a Python browser-use runtime and OpenAI Responses API. Use when asked to set up, install, or enable browser-use.
---

# Browser Use — Installation Guide

Adds multi-step web research capability to NanoClaw agents. Agents call an MCP tool; the host spawns a Python browser-use process in the background and pushes the result back to the chat when done.

## Phase 1: Pre-flight

Check prerequisites before making any changes:

- Python 3.10+ is available
- The browser-use Python package is installed (ask user for the path if unsure — this is `BROWSER_USE_REFERENCE_DIR`)
- `BROWSER_USE_OPENAI_API_KEY` is available from the user
- NanoClaw is already installed (`src/index.ts` and `src/ipc.ts` exist)

Ask the user:
1. Path to the browser-use Python package (e.g. `../browser-use`)
2. OpenAI API key for browser-use
3. OpenAI model to use (default: `gpt-4.1`)
4. Custom OpenAI base URL if using a gateway (optional)
5. Whether to run the browser headlessly (default: `false`)

## Phase 2: Create host-side files

Create two new files in `src/`:

**`src/browser-use.ts`** — Host-side IPC handler. Handles three task types dispatched from `src/ipc.ts`:
- `browser_use_research` — reads env config, spawns Python backend (`run_browser_use.py` in research mode) asynchronously, immediately writes a "started" IPC result with the `request_id` back to the container (non-blocking), then on Python process close pushes a completion message directly into the chat via the IPC messages dir
- `browser_use_status` — reads `data/browser-use/{requestId}.json` status file synchronously, returns it as result
- `browser_use_cancel` — sends SIGTERM to the tracked process, updates status file, returns confirmation

Key design details:
- Maintains a `Map<string, ChildProcess>` of active research processes for cancel support
- Writes status records to `data/browser-use/` at start, update, and completion
- On completion, writes a host message to `data/ipc/{group}/messages/` (not another result file) — this is what delivers the final answer to the user
- Reads all env vars from `.env` via `readEnvFile` helper
- Python interpreter resolution order: `BROWSER_USE_PYTHON` env var → `BROWSER_USE_REFERENCE_DIR/.venv/bin/python` → `.venv/bin/python` → `python3`
- Script path: `.claude/skills/browser-use/scripts/run_browser_use.py`

**`src/browser-use-login.ts`** — Entry point for `npm run browser-use:login`. Calls the Python backend in interactive `login` mode (inherits stdio so the user can interact with the browser).

## Phase 3: Wire into `src/ipc.ts`

- Import `handleBrowserUseIpc` from `./browser-use.js`
- In the IPC task dispatch logic, call `handleBrowserUseIpc(data, sourceGroup, isMain, DATA_DIR)` before the unknown-type warning — it returns `false` if the task type is not browser-use, so it does not interfere with other task types

## Phase 4: Add MCP tools to `container/agent-runner/src/ipc-mcp-stdio.ts`

Add three tools to the MCP server (main-group only, enforced at the tool level):

- `browser_use_research(goal, start_url?, max_steps?)` — writes IPC task, polls `browser_use_results/{requestId}.json` with a short timeout (30s is enough since the host responds immediately with "started")
- `browser_use_status(request_id)` — writes IPC task, polls for status result
- `browser_use_cancel(request_id)` — writes IPC task, polls for cancel confirmation

The tool description for `browser_use_research` should instruct the agent not to use any other browsing tool for the same task after calling this, and to stop and wait for the background result.

## Phase 5: Update `package.json`

Add script: `"browser-use:login": "tsx src/browser-use-login.ts"`

## Phase 6: Configure `.env`

Add the values collected in Phase 1:

- `BROWSER_USE_OPENAI_API_KEY`
- `BROWSER_USE_OPENAI_MODEL` (default: `gpt-4.1`)
- `BROWSER_USE_OPENAI_API_MODE=responses` (required — this runtime uses Responses API only)
- `BROWSER_USE_REFERENCE_DIR`
- `BROWSER_USE_HEADLESS` (default: `false`)
- `BROWSER_USE_MAX_STEPS` (default: `30`)
- `BROWSER_USE_BASE_URL` (if using a custom gateway)

Also update `.env.example` with the same keys (with empty or default values).

## Phase 7: Build and restart

```
npm run build
./container/build.sh
```

Then restart the service (macOS: `launchctl kickstart -k gui/$(id -u)/com.nanoclaw`, Linux: `systemctl --user restart nanoclaw`).

## Phase 8: Verify

- Service restarts cleanly (check logs)
- Ask the user to trigger a research task from their main group — they should receive a "Started browser-use task…" acknowledgement immediately, then a completion message when Python finishes
- If they want to save login sessions for authenticated sites: `npm run browser-use:login`

## Troubleshooting

- **Python not found** — set `BROWSER_USE_PYTHON` in `.env` to the explicit interpreter path; alternatively check that `BROWSER_USE_REFERENCE_DIR/.venv/bin/python` exists
- **No result / timeout** — verify `BROWSER_USE_OPENAI_API_MODE=responses` (Chat Completions mode is not supported), confirm API key is valid
- **Task status** — check `data/browser-use/` for JSON status files, one per `request_id`
- **Login sessions not used** — confirm `BROWSER_USE_USER_DATA_DIR` matches the path where `npm run browser-use:login` saved the profile (default: `data/browser-use-profile`)
- **MCP tools missing after rebuild** — run `/refresh-mcp-tools`
