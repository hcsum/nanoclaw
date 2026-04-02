---
name: web-access
description: Add or maintain the Web Access host-browser proxy integration so container agents can drive a dedicated Chromium browser through IPC.
---

# Add Web Access Integration

This skill is for the coding-time agent working on the repository.

Its job is to add or maintain the Web Access integration that runtime agents use later.

The runtime agent guidance is canonical in `container/skills/web-access/SKILL.md`, which is synced into each group's `data/sessions/{group}/.claude/skills/` by `src/container-runner.ts` and mounted in the container at `/home/node/.claude/skills/`.

## What this integration provides

| Action     | Tool              | Description                                                                                      |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| Proxy call | `web_access_call` | Send a request from the container to a host-side CDP proxy that controls a host Chromium browser |

## Source of truth by role

- Coding-agent implementation guidance: this file, `/.claude/skills/web-access/SKILL.md`
- Runtime agent guidance for Andy: `container/skills/web-access/SKILL.md`
- Runtime MCP tool definitions: `container/agent-runner/src/ipc-mcp-stdio.ts`
- Host-side IPC dispatch: `src/web-access.ts`
- Host proxy scripts: `.claude/skills/web-access/scripts/*`

## When to use this skill

Use this skill when you need to:

- add Web Access support to a fork that does not have it yet
- adjust how NanoClaw reaches the host Chromium CDP proxy
- improve the runtime prompt/guidance Andy sees for browser-driven web work
- fix host/browser connection issues in the integration code

## Why this exists

- The runtime agent runs in a container and cannot talk to the host browser directly.
- The host process must bridge container tool calls to a host-side Chromium browser session.
- Runtime agents need stable tool guidance that matches the host bridge behavior.

## Implementation checklist

1. Ensure the runtime MCP tool exists in `container/agent-runner/src/ipc-mcp-stdio.ts`
2. Ensure the host IPC handler exists in `src/web-access.ts`
3. Ensure the host proxy scripts exist under `.claude/skills/web-access/scripts/`
4. Ensure runtime guidance exists in `container/skills/web-access/SKILL.md`
5. Build and restart so the runtime agent sees the updated tool/skill

## Setup workflow for coding agents

This skill should be applied interactively. Do not dump a block of `.env` instructions on the user unless automatic detection fails.

### Ask only one primary question

Use `AskUserQuestion` to ask which dedicated browser the user wants Web Access to control:

- Brave (recommended)
- Chrome
- Chrome Canary
- Chromium
- Edge
- Custom path

If the user chooses `Custom path`, ask for the executable path. Otherwise, do not ask for path, port, profile directory, or DevTools file up front.

### Auto-detect everything else

After the browser choice is known, the coding agent should determine the rest automatically where possible:

- Browser path: probe common install locations on the current platform
- Debug port: default to `9222`
- Dedicated profile dir: derive a stable path like `/tmp/<browser>-web-access-profile`
- DevToolsActivePort file: derive from the profile dir as `<profile-dir>/DevToolsActivePort`
- Extra args: leave empty unless there is a concrete browser-specific need

Only ask a follow-up question if the browser executable cannot be found automatically.

### Persist the result

Write the detected values to `.env` using:

- `WEB_ACCESS_BROWSER_PORT`
- `WEB_ACCESS_BROWSER_PATH`
- `WEB_ACCESS_BROWSER_USER_DATA_DIR`
- `WEB_ACCESS_BROWSER_DEVTOOLS_FILE`
- `WEB_ACCESS_BROWSER_ARGS` (only if needed)

The user should not need to edit `.env` manually for the common case.

### Validate automatically

After writing `.env`, the coding agent should:

1. Run `npm run build`
2. Restart NanoClaw if needed
3. Run the host setup check
4. Verify that the configured browser owns the debug port
5. Verify that the proxy responds on `3456`

If the browser is not running, Web Access should auto-start it.

## Local setup

1. Prefer a dedicated Chromium-based browser instance instead of the user's daily browser.
2. Configure `WEB_ACCESS_BROWSER_*` in `.env`.
3. Build and restart NanoClaw:

```bash
npm run build
./container/build.sh
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

Recommended dedicated Brave instance on macOS:

```bash
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/brave-web-access-profile
```

Matching `.env` settings:

```bash
WEB_ACCESS_BROWSER_PORT=9222
WEB_ACCESS_BROWSER_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
WEB_ACCESS_BROWSER_USER_DATA_DIR=/tmp/brave-web-access-profile
WEB_ACCESS_BROWSER_DEVTOOLS_FILE=/tmp/brave-web-access-profile/DevToolsActivePort
```

If `WEB_ACCESS_BROWSER_PATH` and the matching profile settings are present, Web Access will auto-start that dedicated browser when needed.

### Common macOS browser paths

- Brave: `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`
- Chrome: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Chrome Canary: `/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary`
- Chromium: `/Applications/Chromium.app/Contents/MacOS/Chromium`
- Edge: `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`

## Notes for coding agents

- Do not treat this file as Andy's runtime prompt. That belongs in `container/skills/web-access/SKILL.md`.
- Keep the host bridge repo-local; do not depend on an external global skill install path.
- If you change runtime Web Access behavior, update both the MCP tool description and the runtime skill guidance together.
- Preserve the separation of concerns:
  - root `/.claude/skills/...` = coding-agent instructions for modifying the repo
  - `container/skills/...` = runtime-agent instructions for using tools inside the container
- After changing this integration, validate with `npm run build`, then rebuild the container if runtime files changed.

## Notes

- This integration is main-group only.
- It uses a host Chromium browser reachable over CDP. Prefer a dedicated browser app/profile so it does not interfere with the user's daily browser.
- Supported choices are typically Brave, Chrome, Chrome Canary, Chromium, and Edge.
- If the dedicated browser is not running, the host setup can auto-start it.
