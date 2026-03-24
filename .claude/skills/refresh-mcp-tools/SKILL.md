---
name: refresh-mcp-tools
description: Refresh NanoClaw MCP tool visibility after adding or changing tools in container/agent-runner. Use when Andy says a tool is missing ("No such tool available"), cannot see a new MCP tool after restart, or session-level agent-runner cache is stale.
---

# Refresh MCP Tools

Fix stale MCP tool registration by syncing per-session `agent-runner-src` caches and restarting the NanoClaw service.

This is also the manual fix when `container/agent-runner/src/*` code changes are not taking effect, even if the issue is not MCP-tool-related. NanoClaw may keep using the per-session copy under `data/sessions/<group>/agent-runner-src/`, so rebuilding the host or container alone may not refresh runtime behavior.

## Script

The host-side fix can be automated with:

```bash
bash .claude/skills/refresh-mcp-tools/refresh.sh --tool-name <tool_name>
```

Useful variants:

```bash
bash .claude/skills/refresh-mcp-tools/refresh.sh --sync-only
bash .claude/skills/refresh-mcp-tools/refresh.sh
```

The script can:

- optionally verify a tool name exists in `container/agent-runner/src/ipc-mcp-stdio.ts`
- sync `container/agent-runner/src/` into every session cache
- restart NanoClaw with the appropriate host command

It cannot fully automate the final verification step inside the chat runtime, so still do this after running it:

## Manual Verification

Ask Andy to call the tool directly:

```text
@Andy call mcp__nanoclaw__<tool_name> with a minimal test input
```

## Runbook

1. Optional source check + sync + restart:
   ```bash
   bash .claude/skills/refresh-mcp-tools/refresh.sh --tool-name <your_tool_name>
   ```
2. Sync cached agent-runner sources only:
   ```bash
   bash .claude/skills/refresh-mcp-tools/refresh.sh --sync-only
   ```
3. Sync and restart NanoClaw without a source-name check:
   ```bash
   bash .claude/skills/refresh-mcp-tools/refresh.sh
   ```
4. Verify in chat by asking Andy to call the tool directly:
   ```text
   @Andy call mcp__nanoclaw__<tool_name> with a minimal test input
   ```

## When To Use This

- After editing `container/agent-runner/src/*`
- When a new MCP tool does not appear after rebuild/restart
- When runtime behavior still matches old `agent-runner` code after rebuild/restart
- When different NanoClaw installs behave differently despite matching source and env vars

## What The Script Does

- Copy `container/agent-runner/src/` into every `data/sessions/*/agent-runner-src/`
- Create missing `agent-runner-src` directories for existing session folders
- Optionally confirm the requested tool name exists in `container/agent-runner/src/ipc-mcp-stdio.ts`
- Restart service using platform-specific command:
- macOS: `launchctl kickstart -k gui/$(id -u)/com.nanoclaw`
- Linux user service: `systemctl --user restart nanoclaw`
- Linux root service: `systemctl restart nanoclaw`
- Fallback: `./start-nanoclaw.sh`

## Troubleshooting

- Tool still missing after sync: verify the active group has a session folder under `data/sessions/<group>/`.
- Tool exists in source but not in runtime logs: make one test message after restart to force a new container run.
- Service restart fails due permissions: run the printed restart command directly in your host shell.
