---
name: browser-use
description: Use a dedicated browser-use runtime for deeper web research with saved login sessions when normal web tools are not enough.
allowed-tools: mcp__nanoclaw__browser_use_research
---

# browser-use

Use `browser-use` for deeper web research tasks that need multi-step browsing, site navigation, scrolling, or reuse of a previously saved browser login session.

## Use it when

- The user explicitly asks to use browser-use
- The user asks what a website is, what it does, what is on it, or asks you to research a website
- The user explicitly asks for web research
- `WebSearch` or `WebFetch` would be too shallow
- You need to inspect multiple pages before answering
- A previously saved login session may help access the needed content

## Do not use it when

- A quick factual lookup is enough
- The task would post, purchase, modify account settings, or do anything besides research
- The user only needs one simple page fetched

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
- after calling `browser_use_research`, stop browsing in that turn and wait for the background result instead of using `agent-browser`, `WebSearch`, or `WebFetch` for the same task

## Notes

- This tool is main-group only
- The runtime uses its own OpenAI configuration, separate from the main NanoClaw model
- The OpenAI gateway is run in Responses API mode only
- If the user explicitly asks for `agent-browser`, honor that and do not substitute `browser-use`
- If a site probably needs login and the saved session does not exist yet, tell the user to run `npm run browser-use:login` first
- Keep the returned `request_id` when starting a task so you can check or cancel it later
- After the background task completes, the host sends the result back to the chat automatically
