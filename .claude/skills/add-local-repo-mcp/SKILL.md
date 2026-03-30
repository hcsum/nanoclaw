---
name: add-local-repo-mcp
description: Add or maintain a runtime MCP server backed by a local repository on the host machine. Use when a tool should run from a sibling/local checkout instead of a published package.
---

# Add Local Repo MCP Tool

This skill is for the coding-time agent working on the NanoClaw repository.

Its job is to wire a runtime MCP server that should execute from a local repository on the host, then expose that server cleanly to the containerized runtime agent.

## When to use this skill

Use this skill when you need to:

- add a new MCP server from a local checkout such as `../some-mcp`
- replace a published `uvx`/`npx` MCP package with a local repo during development
- debug why a runtime MCP tool works from a package registry but fails from a local repo
- generalize one local-repo MCP integration into a reusable pattern

## Source of truth by role

- Coding-agent implementation guidance: this file, `/.claude/skills/add-local-repo-mcp/SKILL.md`
- Runtime MCP registration: `container/agent-runner/src/index.ts`
- Host container mounts and env injection: `src/container-runner.ts`
- Runtime session copies: `data/sessions/<group>/agent-runner-src/`
- Restart/sync workflow: `/.claude/skills/refresh-tools-and-skills/SKILL.md`

## Ask the user first

Collect these inputs before editing code:

1. Local repo path on the host, relative to NanoClaw if possible, for example `../seo-mcp`
2. Repo type and launch style:
   - Python project with `pyproject.toml`
   - Node project with `package.json`
   - other command/runtime
3. MCP server name, for example `seo`
4. Expected tool prefix, for example `mcp__seo__*`
5. Required env vars, for example `CAPSOLVER_API_KEY`
6. Whether to keep a published-package fallback when the local repo is absent

## Why local repo MCP tools fail

The common failure modes are:

1. The runtime is still launching a published package such as `uvx seo-mcp` or `npx some-tool`, not the local repo.
2. The local repo is not mounted into the container at all.
3. The local repo is mounted read-only, but the package manager needs write access during build/install.
4. Secrets were added to tracked files such as `.mcp.json` instead of `.env`.
5. The repo source was updated in `container/agent-runner/src/`, but the active group is still running its cached copy in `data/sessions/<group>/agent-runner-src/`.

## Design rules

Follow these rules unless the user explicitly asks for something else:

- Prefer `.env` plus `readEnvFile(...)` for runtime secrets.
- Do not store real secrets in tracked files such as `.mcp.json`.
- Treat the host repo as the source of truth, but do not let the container write into the original checkout.
- Copy local MCP repos into a per-group writable session directory before mounting.
- Keep the local-repo path handling minimal and deterministic.
- If runtime dependencies change in the image, rebuild the container. If only mounted runtime code changes, restart/sync is enough.

## Recommended implementation pattern

### 1. Add a generic per-group local-repo copy step in `src/container-runner.ts`

Create or reuse a helper that:

- takes a host repo path and destination directory
- validates the repo by checking for a sentinel file such as `pyproject.toml` or `package.json`
- copies it into `data/sessions/<group>/mcp-repos/<slug>/`
- excludes heavy or host-specific directories such as `.git`, `.venv`, `node_modules`, `.pdm-build`, and `__pycache__`

Why:

- package managers like `uvx --from <path>` may build from the local project and require write access
- a read-only bind mount of the original repo can fail during build/cleanup
- a session copy avoids polluting the real checkout

### 2. Mount the copied repo into the container as read-write

Mount the session copy to a stable container path such as:

- `/workspace/tools/<slug>`

Use a normal read-write mount, not `:ro`.

Important:

- `/workspace/...` is not automatically writable; only mounts created with `readonly: false` are writable.
- the write access is for container processes like `uvx`, `python`, `node`, or the MCP server process itself.

### 3. Inject required env vars from `.env`

In `src/container-runner.ts`:

- read only the specific keys needed by the MCP tool using `readEnvFile([...])`
- pass them into the container with `-e KEY=value`

Do not rely on `.mcp.json` as the primary secret source in this runtime path.

### 4. Register the MCP server in `container/agent-runner/src/index.ts`

Add a helper that builds the MCP server config.

For Python repos, prefer:

```ts
if (fs.existsSync(path.join(localDir, 'pyproject.toml'))) {
  return {
    command: '/usr/local/bin/uvx',
    args: ['--from', localDir, '<entry-command>'],
    env,
  };
}
```

For Node repos, prefer the equivalent local-project launch form with `npx`, `node`, or the package's own CLI.

Only keep a published-package fallback if the user wants it.

### 5. Add the tool prefix to `allowedTools`

Make sure the runtime agent can call the server's tools, for example:

```ts
'mcp__seo__*';
```

### 6. Update the active session cache when needed

Remember that each group may run from a cached runtime source copy:

- `data/sessions/<group>/agent-runner-src/`

If the current group already has a cached copy, either:

- sync the updated runtime source into that session cache, or
- use the refresh workflow, or
- restart after ensuring the cache will be refreshed

Do not assume editing `container/agent-runner/src/` alone updates a currently active group.

## Verification checklist

1. `npm run build`
2. If the container image changed, run `./container/build.sh`
3. Restart NanoClaw
4. Confirm the local repo is mounted in a running container
5. Confirm the launcher command references the container path, not the host path
6. Ask the runtime agent to call one minimal MCP tool successfully

For direct startup verification, test the same command the runtime will use, for example:

```bash
docker run --rm --entrypoint /bin/bash \
  -v "$PWD/data/sessions/<group>/mcp-repos/<slug>:/workspace/tools/<slug>" \
  nanoclaw-agent:latest -lc \
  '/usr/local/bin/uvx --from /workspace/tools/<slug> <entry-command> --help'
```

If this fails with a read-only file-system error, the mount strategy is wrong.

## Troubleshooting

- **Tool exists in schema but Andy says it is unavailable**
  - The MCP server was not actually registered in `container/agent-runner/src/index.ts`, or the running session cache is stale.

- **Local repo path is ignored**
  - The runtime still points to a published package command instead of the mounted local path.

- **Read-only file-system error during `uvx --from` or similar**
  - The local repo was mounted read-only or the original checkout was mounted directly instead of using a writable session copy.

- **Secret works in one place but not in runtime**
  - The secret was put in `.mcp.json` or a shell session but was never injected by `src/container-runner.ts` into the container environment.

- **Code changes do not affect the active group**
  - Update `data/sessions/<group>/agent-runner-src/` or run the refresh/restart workflow.

## Notes for coding agents

- Keep this generalized. Do not hardcode one specific MCP repo unless the user explicitly wants a one-off integration.
- Prefer a small helper plus one server-config builder over duplicating custom logic for each tool.
- If you add support for multiple local MCP repos, consider a small declarative config structure rather than more ad hoc conditionals.
- If runtime behavior changes, inspect both the source tree and the active session copy before concluding the fix is live.
