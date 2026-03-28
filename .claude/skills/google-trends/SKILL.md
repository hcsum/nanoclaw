---
name: google-trends
description: Add or maintain the Google Trends runtime integration. Use when you want a dedicated tool for keyword comparison, average interest, and top query extraction from Google Trends.
---

# Add Google Trends Integration

This skill is for the coding-time agent working on the repository.

Its job is to add or maintain the Google Trends integration that runtime agents use later.

The runtime agent guidance is canonical in `container/skills/learn-google-trends/SKILL.md`, which is synced into each group's `data/sessions/{group}/.claude/skills/` by `src/container-runner.ts` and mounted in the container at `/home/node/.claude/skills/`.

## What this integration provides

| Action  | Tool                    | Description                                                                         |
| ------- | ----------------------- | ----------------------------------------------------------------------------------- |
| Compare | `google_trends_compare` | Open a Google Trends compare page, capture average interest, and scrape top queries |

## Source of truth by role

- Coding-agent implementation guidance: this file, `/.claude/skills/google-trends/SKILL.md`
- Runtime agent guidance for Andy: `container/skills/learn-google-trends/SKILL.md`
- Runtime MCP tool definitions: `container/agent-runner/src/ipc-mcp-stdio.ts`
- Host-side IPC dispatch: `src/google-trends.ts`
- Browser automation scripts: `.claude/skills/google-trends/scripts/*.ts`

## When to use this skill

Use this skill when you need to:

- add Google Trends research support to a fork that does not have it yet
- adjust how the Trends compare tool behaves
- improve the runtime prompt/guidance Andy sees for Trends research
- fix selector, consent, or scraping issues in the integration code

## Why this exists

- Google Trends is dynamic and better handled with a real browser than plain fetch.
- Runtime agents need one stable site-specific tool for keyword comparison research.
- The host must gather both summary metrics and first-page top-query rows for each term.

## Implementation checklist

1. Ensure the runtime MCP tool exists in `container/agent-runner/src/ipc-mcp-stdio.ts`
2. Ensure the host IPC handler exists in `src/google-trends.ts`
3. Ensure the browser scripts exist under `.claude/skills/google-trends/scripts/`
4. Ensure runtime guidance exists in `container/skills/learn-google-trends/SKILL.md`
5. Build and restart so the runtime agent sees the updated tool/skill

## Local setup

1. Ensure Playwright is installed:

```bash
npm ls playwright dotenv-cli || npm install playwright dotenv-cli
```

2. Enable Chrome remote debugging in your normal Chrome.
   - This skill now uses your current Chrome session through the same remote-debugging path as `web-access`.

3. Build and restart NanoClaw:

```bash
npm run build
./container/build.sh
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

## Notes for coding agents

- Do not treat this file as Andy's runtime prompt. That belongs in `container/skills/learn-google-trends/SKILL.md`.
- If you change runtime Google Trends behavior, usually update both the MCP tool description and the runtime skill guidance together.
- Preserve the separation of concerns:
  - root `/.claude/skills/...` = coding-agent instructions for modifying the repo
  - `container/skills/...` = runtime-agent instructions for using tools inside the container
- After changing this integration, validate with `npm run build`, then rebuild the container if runtime files changed.

## Notes

- This integration is main-group only.
- It uses the host's current Chrome session in headed mode.
- Google may occasionally show consent or anti-bot interstitials, so keep selectors defensive.
