# AGENTS Guide

This file is for coding agents working in `/Users/sum/Codes/nanoclaw`.

## Repo Overview

- NanoClaw is a TypeScript/Node.js app with a single host process and containerized runtime agents.
- Core app code lives in `src/`.
- Runtime agent-facing skills live in `container/skills/` and get synced into per-group session folders.
- Coding-agent skills live in `.claude/skills/` and describe how to modify the repository itself.
- Main architectural references: `README.md`, `CLAUDE.md`, `docs/SPEC.md`, `docs/SECURITY.md`, `docs/nanoclaw-architecture-final.md`.

## Commands

### Install / setup

- `npm install` — install dependencies.
- `npm run setup` — run the guided setup entrypoint.
- `npm run web-cafe:login` — establish Web.Cafe headed-browser auth for the integration.
- `npm run browser-use:login` — establish browser-use login state if needed.

### Development

- `npm run dev` — run the app with `tsx` from `src/index.ts`.
- `npm run build` — compile TypeScript to `dist/` with `tsc`.
- `npm run start` — run the compiled app from `dist/index.js`.
- `./container/build.sh` — rebuild the runtime agent container.

### Type checking / formatting

- `npm run typecheck` — strict TypeScript check without emitting files.
- `npm run format` — format `src/**/*.ts` with Prettier.
- `npm run format:fix` — same as `format`.
- `npm run format:check` — verify formatting only.
- There is currently no dedicated ESLint/lint script in `package.json`; use `typecheck`, `format:check`, and tests as the main quality gates.

### Tests

- `npm run test` — run the full Vitest suite once.
- `npm run test:watch` — run Vitest in watch mode.
- Single file: `npx vitest run src/group-queue.test.ts`
- Single test by name: `npx vitest run src/group-queue.test.ts -t "only runs one container per group at a time"`
- Alternate single test pattern: `npx vitest run -t "Telegram message stored"`

### Service management

- `npm run mac:start` — load the macOS launch agent.
- `npm run mac:stop` — unload the macOS launch agent.
- `npm run mac:restart` — restart the macOS launch agent.
- `npm run log` — tail `logs/nanoclaw.log`.
- Linux equivalents are documented in `CLAUDE.md` and `README.md` with `systemctl --user`.

## What to Run Before Finishing

- For most code changes: `npm run build` and `npm run test`.
- For TypeScript-heavy refactors: also run `npm run typecheck`.
- For formatting-sensitive changes in `src/`: run `npm run format:check`.
- If you change runtime container files (`container/`, `container/agent-runner/`, synced runtime skills), rebuild with `./container/build.sh`.
- If you change startup/runtime integration behavior, consider restarting the service as well.

## Code Style

### Language and module conventions

- The repo uses TypeScript with `strict: true` and `module: NodeNext`.
- Use ESM imports/exports.
- Use explicit `.js` extensions in local TypeScript imports, e.g. `import { logger } from './logger.js';`.
- Prefer named exports for shared utilities, types, and constants.
- Keep files ASCII unless the file already uses non-ASCII or it is required.

### Imports

- Group imports in this order:
  1. Node built-ins
  2. Third-party packages
  3. Local imports
- Separate groups with a blank line.
- Within a group, keep imports stable and readable; existing files usually sort roughly alphabetically, but preserving nearby conventions matters more than reordering everything.
- Type imports are often folded into normal imports in this codebase unless `import type` clearly improves clarity.

### Formatting

- Follow Prettier defaults as established by the existing files.
- Use semicolons.
- Prefer single quotes.
- Keep lines readable; the codebase accepts multiline object literals, parameter lists, and import lists when needed.
- Favor small helper functions over deeply nested inline logic.

### Types

- Add explicit types for exported functions, interfaces, and non-trivial return values.
- Prefer `interface` for exported object shapes that model domain concepts.
- Use `type` aliases for unions, mapped types, or utility compositions.
- Prefer `Record<string, T>` for string-keyed maps when appropriate.
- Avoid `any`; if unavoidable, isolate it and keep the unsafeness narrow.
- Reuse existing domain types from `src/types.ts` and nearby modules instead of inventing near-duplicates.

### Naming

- `PascalCase` for classes, interfaces, and types.
- `camelCase` for functions, methods, variables, and local helpers.
- `SCREAMING_SNAKE_CASE` for top-level constants that behave like configuration or fixed markers.
- Test files use the same basename plus `.test.ts`.
- Prefer descriptive names over abbreviations unless the abbreviation is already common in the repo (`jid`, `ctx`, `env`, `ipc`).

### Error handling and logging

- Fail safely and log with context using `logger` from `src/logger.ts`.
- Prefer structured logging: `logger.warn({ chatJid, err }, 'Failed to ...')`.
- Use `try`/`catch` around I/O, JSON parsing, IPC, external services, and browser automation boundaries.
- If a failure is recoverable, log and return a safe fallback rather than crashing the loop.
- Throw errors for programmer mistakes or invalid invariants when the caller should stop.
- Do not leak secrets into logs.

### Comments and docs

- Keep comments sparse and useful.
- Comment non-obvious invariants, security constraints, mount behavior, IPC contracts, or subtle runtime interactions.
- Avoid restating what the code already says.
- Preserve existing architecture comments; they often explain important safety assumptions.

### Testing style

- Use Vitest (`describe`, `it`, `expect`, `vi`).
- Keep tests close to the implementation in `src/**/*.test.ts`.
- Test behavior, not just implementation details.
- The repo commonly uses fake timers and mocked `fs`/IPC dependencies for queueing and scheduler tests.
- When fixing a bug, add or update a targeted regression test if practical.

## Architecture-Specific Guidance

- Preserve the distinction between coding-agent and runtime-agent layers:
  - `.claude/skills/` = coding-time instructions for modifying the repo.
  - `container/skills/` = runtime-agent instructions synced into session `.claude/skills/`.
- `src/container-runner.ts` syncs `container/skills/` into `data/sessions/{group}/.claude/skills/`.
- The main group gets `/workspace/project` mounted read-only inside the container; do not undermine that security model casually.
- Runtime agents should not receive host secrets directly; credential handling goes through the credential proxy.
- When changing channel/runtime behavior, inspect related code across `src/index.ts`, `src/ipc.ts`, `src/router.ts`, `src/container-runner.ts`, and `container/agent-runner/src/`.

## Rules Files

- No `.cursor/rules/` directory was found.
- No `.cursorrules` file was found.
- No `.github/copilot-instructions.md` file was found.
- If any of those files are added later, treat them as additional agent instructions to merge with this guide.

## Practical Workflow

- Read the local area first and follow existing patterns before editing.
- Prefer minimal, surgical changes over broad rewrites.
- Do not revert unrelated user changes in the worktree.
- Update docs or skill guidance when behavior changes in a way future agents must understand.
- If you modify runtime-facing tool descriptions or runtime skills, verify whether a rebuild/restart is needed for the change to take effect.
