---
name: browser-use
description: A fallback web accessing tool, only use it when the user explicitly asks for it.
---

# browser-use

Use `browser-use` as a fallback research tool for tasks that need multi-step browsing, site navigation, scrolling, or reuse of a previously saved browser login session.

## Use it when

- The user explicitly asks to use browser-use
- A dedicated site-specific tool does not exist for the target site, or the available dedicated tool cannot do the needed research
- `WebSearch` or `WebFetch` would be too shallow
- You need to inspect multiple pages before answering
- A previously saved login session may help access the needed content

## Tool

```text
mcp__nanoclaw__browser_use_research
mcp__nanoclaw__browser_use_status
mcp__nanoclaw__browser_use_cancel
```

Arguments:

- `goal`: required research objective
- `start_url`: optional URL to begin from
- `max_steps`: optional cap on browser steps

Behavior:

- `browser_use_research` starts a background task and returns a `request_id` immediately
- use `browser_use_status` to inspect progress
- use `browser_use_cancel` to stop a running task
- after calling `browser_use_research`, stop browsing in that turn and wait for the background result instead of using `web-access`, `WebSearch`, or `WebFetch` for the same task

Decision rule:

- First prefer dedicated site tools
- Then prefer `WebSearch` or `WebFetch` when they are enough
- Use `browser-use` only as the fallback path, unless the user explicitly asked for it

## Notes

- This tool is main-group only
- The runtime uses its own OpenAI configuration, separate from the main NanoClaw model
- The OpenAI gateway is run in Responses API mode only
- If the user explicitly asks for `web-access`, honor that and do not substitute `browser-use`
- If the user asks for general research but does not mention `browser-use`, avoid it unless other web tools clearly cannot finish the job
- If a site probably needs login and the saved session does not exist yet, tell the user to run `npm run browser-use:login` first
- Keep the returned `request_id` when starting a task so you can check or cancel it later
- After the background task completes, the host sends the result back to the chat automatically
