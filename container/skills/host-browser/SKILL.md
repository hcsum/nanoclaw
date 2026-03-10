---
name: host-browser
description: Use the visible browser running on the host machine for web research, interactive exploration, and debugging. Prefer this when you need the user to see browser automation happening on the host.
---

# Host Browser

Use this skill by default for web research and interactive browsing when the host browser path is available.

This skill uses the MCP browser tools:
- `mcp__nanoclaw__browser_open`
- `mcp__nanoclaw__browser_snapshot`
- `mcp__nanoclaw__browser_action`
- `mcp__nanoclaw__browser_read`

Do not use `agent-browser` in this skill unless the host browser path is unavailable or fails. `agent-browser` runs inside the container and is headless.

## Workflow

1. Open the page with `mcp__nanoclaw__browser_open`
2. Inspect the current page with `mcp__nanoclaw__browser_snapshot`
3. Interact with elements using refs from the snapshot via `mcp__nanoclaw__browser_action`
4. Extract page content with `mcp__nanoclaw__browser_read`
5. Repeat snapshot/action/read as the page changes

## Notes

- This is for host-visible browsing and research.
- Use `interactive: true` snapshots by default.
- Re-run `browser_snapshot` after navigation or major DOM changes before using element refs again.
- If host browser tools time out, fail repeatedly, or are unavailable, switch to `agent-browser`.
- If the task only needs headless browsing in the container, use `agent-browser` instead.
