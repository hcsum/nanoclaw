---
name: browser-use
description: Add browser-use web research integration to NanoClaw. Gives agents a background research tool backed by a Python browser-use runtime and OpenAI Responses API. Use when asked to set up, install, or enable browser-use.
---

# Browser Use

This skill is for the coding-time agent working on the repository.

Its job is to add or repair the full browser-use integration so runtime agents can launch a background browser research task, check status, and cancel it later.

This skill must be strong enough to recreate the implementation from scratch. Treat the files and behaviors below as required, not optional guidance.

## What this integration provides

| Action   | Tool                        | Description                                                        |
| -------- | --------------------------- | ------------------------------------------------------------------ |
| Research | `browser_use_research`      | Start a background browser-use task and return a request ID        |
| Status   | `browser_use_status`        | Check the current status and stored metadata for a prior request   |
| Cancel   | `browser_use_cancel`        | Cancel a running background browser-use task by request ID         |
| Login    | `npm run browser-use:login` | Open an interactive login flow using the saved browser-use profile |

## Source of truth by role

- Coding-agent implementation guidance: this file, `/.claude/skills/browser-use/SKILL.md`
- Host-side runtime implementation: `src/browser-use.ts`
- Login entrypoint: `src/browser-use-login.ts`
- IPC dispatch wiring: `src/ipc.ts`
- Runtime MCP definitions: `container/agent-runner/src/ipc-mcp-stdio.ts`
- Runtime tool exposure: `container/agent-runner/src/index.ts`
- Python backend script: `/.claude/skills/browser-use/scripts/run_browser_use.py`

## When to use this skill

Use this skill when you need to:

- add browser-use support to a fork that does not have it yet
- repair browser-use after code drift or accidental deletion
- expose the runtime tools to the agent again after they disappeared from `allowedTools`
- adjust background-task behavior, status tracking, or completion-message formatting
- update the Python/browser-use backend wiring or env handling

## Pre-flight

Before changing code, verify:

1. Python 3.10+ is available.
2. The browser-use Python package exists, or ask the user for its path. This becomes `BROWSER_USE_REFERENCE_DIR`.
3. The user has an OpenAI API key for browser-use.
4. NanoClaw core is present (`src/ipc.ts`, `container/agent-runner/src/ipc-mcp-stdio.ts`, and `container/agent-runner/src/index.ts`).

Ask the user for:

1. Path to the browser-use Python package, for example `../browser-use`
2. OpenAI API key for browser-use
3. OpenAI model to use, default `gpt-4.1`
4. Custom OpenAI base URL if using a gateway
5. Whether the browser should run headless, default `false`
6. Optional login start URL, default `https://www.google.com/`

## Required files

The implementation is not complete unless all of these exist and are wired together:

1. `src/browser-use.ts`
2. `src/browser-use-login.ts`
3. `/.claude/skills/browser-use/scripts/run_browser_use.py`
4. `src/ipc.ts` integration
5. `container/agent-runner/src/ipc-mcp-stdio.ts` tool definitions
6. `container/agent-runner/src/index.ts` `allowedTools` entries
7. `package.json` script entry for `browser-use:login`
8. `.env.example` entries for all required browser-use env vars

If any of these are missing, restore them.

## Host implementation requirements

Create `src/browser-use.ts` with these exported entry points:

- `handleBrowserUseIpc(data, sourceGroup, isMain, dataDir): Promise<boolean>`
- `startBrowserUseLoginSession(startUrl?): Promise<{ success: boolean; message: string; data?: unknown }>`

### IPC task types

`handleBrowserUseIpc` must handle exactly these IPC task types:

- `browser_use_research`
- `browser_use_status`
- `browser_use_cancel`

If `data.type` is not one of those, it must return `false` so other IPC handlers can continue.

### Required host behavior

The host implementation must:

- enforce main-group-only access
- maintain `Map<string, ChildProcess>` for active research processes so cancel works
- write per-request status files to `data/browser-use/{requestId}.json`
- write immediate IPC results to `data/ipc/{group}/browser_use_results/{requestId}.json`
- write final completion messages to `data/ipc/{group}/messages/*.json` so the finished result is pushed back into chat asynchronously
- spawn the Python backend in `research` mode without blocking the main process
- support `status` and `cancel` lookups by `targetRequestId`
- remove finished processes from the active-process map
- terminate long-running research tasks after a timeout

### Required status record shape

The JSON written to `data/browser-use/{requestId}.json` should include at least:

- `requestId`
- `status` with one of `running`, `completed`, `failed`, `cancelled`
- `startedAt`
- `updatedAt`
- `chatJid`
- `goal`
- `startUrl`
- `maxSteps`
- `pid`
- `message`
- `data`

### Required research flow

For `browser_use_research`:

1. Validate `goal` is present.
2. Resolve `maxSteps` from the request or env default.
3. Clamp to a hard maximum of 100.
4. Write an initial `running` status file.
5. Spawn the Python backend with payload JSON on stdin.
6. Immediately write an IPC result back to the container saying the task started.
7. When the Python process exits:
   - mark final status as `completed` or `failed`
   - parse the Python stdout JSON result
   - persist final status
   - push a completion message into the chat message queue

### Required cancel flow

For `browser_use_cancel`:

- require `targetRequestId`
- fail clearly if the task is not currently running
- send `SIGTERM`
- mark status as `cancelled`
- remove the process from the active-process map
- return the cancelled status object in the IPC result

### Completion message format

The final pushed chat message should be derived from the Python result and should:

- begin with `browser-use task <requestId> completed.` or `browser-use task <requestId> failed.`
- include a summary if available
- include `Key findings:` bullets if available
- include `Sources:` bullets if available
- include `Notes:` bullets if available

If the Python result has no structured `data`, fall back to its plain `message`.

## Environment handling requirements

Read browser-use configuration from `.env` using `readEnvFile`, but allow process env to override it.

The host implementation must read these keys:

- `BROWSER_USE_OPENAI_API_KEY`
- `BROWSER_USE_OPENAI_MODEL`
- `BROWSER_USE_OPENAI_API_MODE`
- `BROWSER_USE_BASE_URL`
- `BROWSER_USE_HEADLESS`
- `BROWSER_USE_MAX_STEPS`
- `BROWSER_USE_USER_DATA_DIR`
- `BROWSER_USE_PYTHON`
- `BROWSER_USE_REFERENCE_DIR`
- `BROWSER_USE_LOGIN_URL`
- `ALL_PROXY`
- `all_proxy`
- `HTTPS_PROXY`
- `https_proxy`
- `HTTP_PROXY`
- `http_proxy`
- `NO_PROXY`
- `no_proxy`
- `PROXY_USERNAME`
- `PROXY_PASSWORD`

### Python interpreter resolution

Resolve Python in this order:

1. `BROWSER_USE_PYTHON`
2. `BROWSER_USE_REFERENCE_DIR/.venv/bin/python`
3. `.venv/bin/python` in the NanoClaw repo
4. `python3`

If none are usable, return a clear error.

### Script path

The host must execute:

- `/.claude/skills/browser-use/scripts/run_browser_use.py`

and set `NANOCLAW_ROOT=process.cwd()` in the spawned environment.

## Login entrypoint requirements

Create `src/browser-use-login.ts` that:

- imports `startBrowserUseLoginSession` from `./browser-use.js`
- optionally accepts a start URL from `process.argv[2]`
- exits with code 1 on failure
- is wired in `package.json` as:

```json
"browser-use:login": "tsx src/browser-use-login.ts"
```

## IPC wiring requirements

In `src/ipc.ts`:

1. Import `handleBrowserUseIpc` from `./browser-use.js`
2. In the default IPC dispatch branch, call it before the unknown-type warning
3. If it returns `true`, stop processing that IPC task

This is required so browser-use tasks do not fall through as unknown IPC types.

## Runtime MCP tool requirements

In `container/agent-runner/src/ipc-mcp-stdio.ts`, define exactly these tools:

1. `browser_use_research(goal, start_url?, max_steps?)`
2. `browser_use_status(request_id)`
3. `browser_use_cancel(request_id)`

### MCP tool behavior

These tools must:

- enforce main-group-only access at the tool level
- write IPC task files to the tasks directory
- wait for JSON results in `browser_use_results/{requestId}.json`
- return result text plus JSON payload when present

### MCP tool descriptions

`browser_use_research` should explicitly tell the runtime agent:

- to use it mostly when the user directly asks for it or when background browser research is the right fit
- not to keep using other browsing tools for the same task after starting it
- to wait for the background completion message or use the status tool if needed

## Runtime exposure requirements

This is the piece most likely to be forgotten.

In `container/agent-runner/src/index.ts`, add these to `allowedTools`:

- `mcp__nanoclaw__browser_use_research`
- `mcp__nanoclaw__browser_use_status`
- `mcp__nanoclaw__browser_use_cancel`

If the MCP tools exist in `ipc-mcp-stdio.ts` but are missing from `allowedTools`, the implementation is broken because the agent cannot actually call them.

When repairing browser-use, always check both files:

- `container/agent-runner/src/ipc-mcp-stdio.ts`
- `container/agent-runner/src/index.ts`

## Python backend requirements

The backend script at `/.claude/skills/browser-use/scripts/run_browser_use.py` must:

- support `research` and `login` modes
- read JSON from stdin for `research`
- use the browser-use Python package
- create or reuse a persistent browser profile directory
- use OpenAI Responses API mode only
- fail clearly if `BROWSER_USE_OPENAI_API_MODE` is not `responses`
- return strict JSON on stdout for `research`

### Expected research result shape

The research result should be compatible with the host formatter and contain:

- `success`
- `message`
- optional `data.summary`
- optional `data.findings` array
- optional `data.sources` array with `{ title?, url? }`
- optional `data.notes` array

### Research task prompt contract

The Python layer should instruct browser-use to:

- start from `start_url` if provided, otherwise choose a relevant starting point
- do research only
- not post, purchase, or change account settings
- read multiple sources
- stop when enough information is gathered
- return strict JSON only

## Package and env file changes

### `package.json`

Ensure this script exists:

```json
"browser-use:login": "tsx src/browser-use-login.ts"
```

### `.env.example`

Ensure all of these keys are present with empty or default values:

- `BROWSER_USE_OPENAI_API_KEY=`
- `BROWSER_USE_OPENAI_MODEL=gpt-4.1`
- `BROWSER_USE_OPENAI_API_MODE=responses`
- `BROWSER_USE_BASE_URL=`
- `BROWSER_USE_HEADLESS=false`
- `BROWSER_USE_MAX_STEPS=30`
- `BROWSER_USE_USER_DATA_DIR=data/browser-use-profile`
- `BROWSER_USE_REFERENCE_DIR=`
- `BROWSER_USE_PYTHON=`
- `BROWSER_USE_LOGIN_URL=https://www.google.com/`

## Rebuild checklist

If the implementation was deleted, rebuild in this order:

1. Restore `/.claude/skills/browser-use/scripts/run_browser_use.py`
2. Recreate `src/browser-use.ts`
3. Recreate `src/browser-use-login.ts`
4. Rewire `src/ipc.ts`
5. Re-add MCP tools in `container/agent-runner/src/ipc-mcp-stdio.ts`
6. Re-add `allowedTools` exposure in `container/agent-runner/src/index.ts`
7. Re-add `package.json` login script
8. Re-add `.env.example` keys
9. Build and test

## Verification

After any change, verify all of this:

1. TypeScript builds:

```bash
npm run build
```

2. The agent is actually allowed to call the tools. Confirm these strings exist in `container/agent-runner/src/index.ts`:

```text
mcp__nanoclaw__browser_use_research
mcp__nanoclaw__browser_use_status
mcp__nanoclaw__browser_use_cancel
```

3. The MCP server still defines the tools in `container/agent-runner/src/ipc-mcp-stdio.ts`.

4. The IPC router still calls `handleBrowserUseIpc`.

5. The Python backend file exists at `/.claude/skills/browser-use/scripts/run_browser_use.py`.

6. Ask the user to trigger a browser-use research task from the main group. Expected behavior:
   - immediate started acknowledgement with a request ID
   - later a pushed completion message with summary/findings/sources/notes

7. If saved sessions are needed, verify:

```bash
npm run browser-use:login
```

## Common failure mode

If browser-use appears "installed" but the agent cannot use it, check `allowedTools` first. Missing `mcp__nanoclaw__browser_use_*` entries in `container/agent-runner/src/index.ts` will make the integration unavailable even if everything else still exists.

## Notes for coding agents

- Do not stop after adding the host code; browser-use is incomplete until runtime MCP definitions and `allowedTools` are both present.
- Do not replace the background-task model with a synchronous request unless the user explicitly asks for that behavior change.
- Preserve the split of responsibilities:
  - `src/browser-use.ts` = host bridge, status, background process lifecycle, message pushback
  - `src/browser-use-login.ts` = local interactive login entrypoint
  - `container/agent-runner/src/ipc-mcp-stdio.ts` = runtime tools
  - `container/agent-runner/src/index.ts` = runtime tool exposure
  - `/.claude/skills/browser-use/scripts/run_browser_use.py` = Python browser-use backend
