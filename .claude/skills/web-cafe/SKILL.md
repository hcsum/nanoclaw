---
name: web-cafe
description: Add or maintain the Web.Cafe runtime integration. This is a coding-agent skill for setting up Web.Cafe tools, scripts, and agent guidance in NanoClaw, not the runtime research prompt itself.
---

# Add Web.Cafe Integration

This skill is for the coding-time agent working on the repository.

Its job is to add or maintain the Web.Cafe integration that runtime agents use later.

The runtime agent guidance is canonical in `container/skills/learn-web-cafe/SKILL.md`, which is synced into each group's `data/sessions/{group}/.claude/skills/` by `src/container-runner.ts` and mounted in the container at `/home/node/.claude/skills/`.

## What this integration provides

| Action            | Tool                                 | Description                                                        |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Search            | `web_cafe_search`                    | Search Web.Cafe and analyze matching pages                         |
| Experiences       | `web_cafe_explore_experiences`       | Review `/experiences` listings and representative detail pages     |
| Tutorial Articles | `web_cafe_explore_tutorial_articles` | Review `/tutorials?status=article` and representative detail pages |
| Tutorial Columns  | `web_cafe_explore_tutorial_columns`  | Review `/tutorials?status=column` and representative detail pages  |
| Visit Page        | `web_cafe_visit_page`                | Inspect any specific `new.web.cafe` page                           |

## Source of truth by role

- Coding-agent implementation guidance: this file, `/.claude/skills/web-cafe/SKILL.md`
- Runtime agent guidance for Andy: `container/skills/learn-web-cafe/SKILL.md`
- Runtime MCP tool definitions: `container/agent-runner/src/ipc-mcp-stdio.ts`
- Host-side IPC dispatch: `src/web-cafe.ts`
- Browser automation scripts: `.claude/skills/web-cafe/scripts/*.ts`

## When to use this skill

Use this skill when you need to:

- add Web.Cafe support to a fork that does not have it yet
- adjust how the Web.Cafe tools behave
- improve the runtime prompt/guidance Andy sees for Web.Cafe research
- fix login/session issues in the integration code
- extend the integration with new Web.Cafe-specific workflows

## Why this exists

- Web.Cafe may require login or richer client-side navigation for search and deep exploration.
- The host must use the user's real headed Chrome session so existing login state carries over.
- Runtime agents need dedicated tool guidance that is separate from coding-agent implementation instructions.

## Implementation checklist

1. Ensure the runtime MCP tools exist in `container/agent-runner/src/ipc-mcp-stdio.ts`
2. Ensure the host IPC handler exists in `src/web-cafe.ts`
3. Ensure the browser scripts exist under `.claude/skills/web-cafe/scripts/`
4. Ensure runtime guidance exists in `container/skills/learn-web-cafe/SKILL.md`
5. Build and restart so the runtime agent sees the updated tools/skills

## Local setup

1. Ensure Playwright is installed:

```bash
npm ls playwright dotenv-cli || npm install playwright dotenv-cli
```

2. Enable Chrome remote debugging and make sure your normal Chrome is logged into Web.Cafe.

3. Run the connection/login check:

```bash
npx dotenv -e .env -- npx tsx .claude/skills/web-cafe/scripts/setup.ts
```

4. Build and restart NanoClaw:

```bash
npm run build
./container/build.sh
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

## Notes for coding agents

- Do not treat this file as Andy's runtime prompt. That belongs in `container/skills/learn-web-cafe/SKILL.md`.
- If you change runtime Web.Cafe behavior, usually update both the MCP tool descriptions and the runtime skill guidance together.
- Preserve the separation of concerns:
  - root `/.claude/skills/...` = coding-agent instructions for modifying the repo
  - `container/skills/...` = runtime-agent instructions for using tools inside the container
- After changing this integration, validate with `npm run build`, then rebuild the container if runtime files changed.

## Notes

- This integration is main-group only.
- It uses the host's current Chrome session in headed mode.
- If login expires, sign back in inside your normal Chrome and rerun the setup script.
