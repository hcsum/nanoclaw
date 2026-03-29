---
name: refresh-tools-and-skills
description: Refresh NanoClaw tools and skills after code changes. Use when tools or skills appear stale, missing, or out of sync with the source.
---

# Refresh Tools and Skills

Sync session caches from source files and restart the NanoClaw service.

## Script

```bash
bash .claude/skills/refresh-tools-and-skills/refresh.sh
```

Useful variants:

```bash
bash .claude/skills/refresh-tools-and-skills/refresh.sh --build          # rebuild + sync + restart
bash .claude/skills/refresh-tools-and-skills/refresh.sh --tool-name <name>  # verify tool first
```

## When To Use This

- After adding or removing skills in `container/skills/`
- After editing `container/agent-runner/src/*`
- When a tool says "No such tool available" after restart
- When `capabilities` lists skills that no longer exist in source

## What Gets Synced

The script syncs two session cache directories for every active session:

- `data/sessions/<group>/agent-runner-src/` — copies `container/agent-runner/src/`
- `data/sessions/<group>/.claude/skills/` — copies `container/skills/`, removes stale skills

These are bind-mounted into the container at `/app/src` and `/home/node/.claude/` respectively.

## What Requires a Container Rebuild

Only changes to files that are **baked into the image** (not overwritten by mounts):

| File/Directory | Needs Rebuild? | Why |
|---|---|---|
| `container/skills/*` | No | Synced to session cache at runtime |
| `container/agent-runner/src/*` | No | Synced to session cache at runtime |
| `container/agent-runner/package.json` | **Yes** | `npm install` runs inside the image |
| Base image (Node version, OS) | **Yes** | Only in the image |

## Runbook

1. **Default (sync + restart):**
   ```bash
   bash .claude/skills/refresh-tools-and-skills/refresh.sh
   ```
   Use this for most cases — skills, tool code, and logic changes.

2. **With container rebuild:**
   ```bash
   bash .claude/skills/refresh-tools-and-skills/refresh.sh --build
   ```
   Use this after changing `package.json` dependencies or base image.

3. **Verify a tool exists:**
   ```bash
   bash .claude/skills/refresh-tools-and-skills/refresh.sh --tool-name <tool_name>
   ```

4. **Verify in chat:**
   ```
   @Andy call mcp__nanoclaw__<tool_name> with a minimal test input
   ```

## Troubleshooting

- Tool still missing: verify the active group has a session folder under `data/sessions/<group>/`.
- Skill still listed after removal: stale skills are removed during sync.
- Service restart fails: run the printed restart command manually.
