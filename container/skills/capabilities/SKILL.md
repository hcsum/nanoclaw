---
name: capabilities
description: Show what this NanoClaw instance can do — installed skills, available tools, and system info. Read-only. Use when the user asks what the bot can do, what's installed, or runs /capabilities.
---

# /capabilities — System Capabilities Report

Generate a structured read-only report of what this NanoClaw instance can do.

**Main-channel check:** Only the main channel has `/workspace/project` mounted. Run:

```bash
test -d /workspace/project && echo "MAIN" || echo "NOT_MAIN"
```

If `NOT_MAIN`, respond with:

> This command is available in your main chat only. Send `/capabilities` there to see what I can do.

Then stop — do not generate the report.

## How to gather the information

Run these commands and compile the results into the report format below.

### 1. Installed skills

List skill directories available to you:

```bash
ls -1 /home/node/.claude/skills/ 2>/dev/null || echo "No skills found"
```

Each directory is an installed skill. The directory name is the skill name.

### 2. Available tools

Read the allowed tools from your SDK configuration. You always have access to:

- **Core:** Bash, Read, Write, Edit, Glob, Grep
- **Web:** WebSearch, WebFetch
- **Orchestration:** Task, TaskOutput, TaskStop, TeamCreate, TeamDelete, SendMessage
- **Other:** TodoWrite, ToolSearch, Skill, NotebookEdit
- **MCP:** mcp**nanoclaw**\* (messaging, tasks, group management)

### 3. MCP server tools

Read the MCP tools from your SDK configuration and report the `mcp__nanoclaw__*` tools you actually have access to. Do not rely on a fixed built-in list.

Common examples include:

- `schedule_task`, `pause_task`, `resume_task`, `cancel_task`
- `refresh_groups`
- `google_trends_compare`
- `web_access_call`, `web_access_wait`, `web_access_screenshot`, `web_access_go`, `web_access_eval`

Only list tools that are actually available in the current session.

### 4. Container utilities

Check versions in the container:

```bash
node --version 2>/dev/null
claude --version 2>/dev/null
```

### 5. Group info

```bash
ls /workspace/group/CLAUDE.md 2>/dev/null && echo "Group memory: yes" || echo "Group memory: no"
ls /workspace/extra/ 2>/dev/null && echo "Extra mounts: $(ls /workspace/extra/ 2>/dev/null | wc -l | tr -d ' ')" || echo "Extra mounts: none"
```

## Report format

Present the report as a clean, readable message. Example:

```
📋 *NanoClaw Capabilities*

*Installed Skills:*
• /capabilities — This report
(list all found skills)

*Tools:*
• Core: Bash, Read, Write, Edit, Glob, Grep
• Web: WebSearch, WebFetch
• Orchestration: Task, TeamCreate, SendMessage
• MCP: schedule_task, pause_task, resume_task, cancel_task, refresh_groups, google_trends_compare, web_access_call, web_access_wait, web_access_screenshot, web_access_go, web_access_eval

*Container Utilities:*
• Node: vXX.X.X
• Claude Code: vX.X.X

*System:*
• Group memory: yes/no
• Extra mounts: N directories
• Main channel: yes
```

Adapt the output based on what you actually find — don't list things that aren't installed.

**See also:** `/status` for a quick health check of session, workspace, and tasks.
