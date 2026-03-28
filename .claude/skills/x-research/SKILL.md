---
name: x-research
description: Read-only X (Twitter) research tools for NanoClaw. Provides home feed reading and search. Use for research, monitoring, and trend discovery on X.
---

# X Research

This skill keeps only the read-only X workflows:

- `x_search`
- `x_read_home_feed`

It uses the user's current Chrome session through the same CDP path as `web-access`, so X login state comes from the browser the user is already using.

## What this integration provides

| Action | Tool               | Description                                                    |
| ------ | ------------------ | -------------------------------------------------------------- |
| Search | `x_search`         | Search X posts by query, hashtag, or user                      |
| Feed   | `x_read_home_feed` | Read posts from the X home feed for research and summarization |

## Source of truth by role

- Coding-agent implementation guidance: this file, `/.claude/skills/x-research/SKILL.md`
- Host-side IPC dispatch: `src/x-research.ts`
- Browser automation scripts: `/.claude/skills/x-research/scripts/*.ts`
- Runtime MCP definitions: `container/agent-runner/src/ipc-mcp-stdio.ts`

## Local setup

1. Ensure Playwright is installed:

```bash
npm ls playwright dotenv-cli || npm install playwright dotenv-cli
```

2. Ensure Chrome remote debugging is enabled and your normal Chrome is signed into X. Then run the check script:

```bash
npx dotenv -e .env -- npx tsx .claude/skills/x-research/scripts/setup.ts
```

3. Build and restart NanoClaw:

```bash
npm run build
./container/build.sh
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

## Notes

- This skill is main-group only.
- It uses the host's current Chrome session instead of a separate browser profile.
- Post/like/reply/retweet/quote support was intentionally removed from this skill.
