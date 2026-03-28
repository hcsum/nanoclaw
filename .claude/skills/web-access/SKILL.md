---
name: web-access
description: Add or maintain the Web Access host-browser proxy integration so container agents can drive the user's Chrome through IPC.
---

# Add Web Access Integration

This skill is for the coding-time agent working on the repository.

Its job is to add or maintain the Web Access integration that runtime agents use later.

The runtime agent guidance is canonical in `container/skills/web-access/SKILL.md`, which is synced into each group's `data/sessions/{group}/.claude/skills/` by `src/container-runner.ts` and mounted in the container at `/home/node/.claude/skills/`.

## What this integration provides

| Action     | Tool              | Description                                                                                |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------ |
| Proxy call | `web_access_call` | Send a request from the container to a host-side CDP proxy that controls the user's Chrome |

## Source of truth by role

- Coding-agent implementation guidance: this file, `/.claude/skills/web-access/SKILL.md`
- Runtime agent guidance for Andy: `container/skills/web-access/SKILL.md`
- Runtime MCP tool definitions: `container/agent-runner/src/ipc-mcp-stdio.ts`
- Host-side IPC dispatch: `src/web-access.ts`
- Host proxy scripts: `.claude/skills/web-access/scripts/*`

## When to use this skill

Use this skill when you need to:

- add Web Access support to a fork that does not have it yet
- adjust how NanoClaw reaches the host Chrome CDP proxy
- improve the runtime prompt/guidance Andy sees for browser-driven web work
- fix host/browser connection issues in the integration code

## Why this exists

- The runtime agent runs in a container and cannot talk to the host browser directly.
- The host process must bridge container tool calls to the user's real Chrome session.
- Runtime agents need stable tool guidance that matches the host bridge behavior.

## Implementation checklist

1. Ensure the runtime MCP tool exists in `container/agent-runner/src/ipc-mcp-stdio.ts`
2. Ensure the host IPC handler exists in `src/web-access.ts`
3. Ensure the host proxy scripts exist under `.claude/skills/web-access/scripts/`
4. Ensure runtime guidance exists in `container/skills/web-access/SKILL.md`
5. Build and restart so the runtime agent sees the updated tool/skill

## Local setup

1. Enable Chrome remote debugging in the user's normal Chrome profile.
2. Build and restart NanoClaw:

```bash
npm run build
./container/build.sh
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

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
- It uses the host's real Chrome session rather than launching a separate container browser.
- If Chrome loses remote-debugging authorization, rerun the setup check by triggering a Web Access call.
