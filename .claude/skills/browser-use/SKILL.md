---
name: browser-use
description: Browser-based deep web research for NanoClaw using a dedicated OpenAI-backed host runtime and saved browser profile.
---

# Browser Use

Use this skill when the user asks for deep web research that needs multi-step browsing, interactive reading, or reuse of a saved signed-in browser session.

The browser-use runtime is OpenAI-only in this project and uses the OpenAI Responses API mode for the configured gateway.

## When to use it

- The user explicitly asks to use browser-use
- The user asks you to inspect, explain, summarize, or research a website
- The task needs more than a quick `WebSearch` or `WebFetch`
- The user explicitly asks you to research a topic on the web
- The research may require navigating several pages, scrolling, or reading content behind a previously saved login session

## When not to use it

- Simple factual lookups
- Posting content, changing settings, purchasing, or other account actions
- Tasks that can be answered reliably with normal web tools

## Tool

Use `mcp__nanoclaw__browser_use_research` to start a job, `mcp__nanoclaw__browser_use_status` to check it, and `mcp__nanoclaw__browser_use_cancel` to stop it.

Arguments:

- `goal`: clear research objective
- `start_url` optional: preferred website to begin from
- `max_steps` optional: upper bound on browsing steps

`browser_use_research` returns a `request_id` immediately. Keep it if the user may want to check status or cancel later.

## Operating rules

- If the user explicitly asks for browser-use, use it
- If the user asks to research a website, browse a website for information, or explain what a website is, use browser-use unless they explicitly asked for `agent-browser`
- Prefer built-in `WebSearch` and `WebFetch` first only for small non-site-specific questions
- Use this skill only for research, not arbitrary browser control
- If the task likely needs login and the saved browser profile has not been prepared, tell the user to run `npm run browser-use:login`
- For long jobs, tell the user you started a background task and mention the `request_id`
- After calling `browser_use_research`, stop that turn. Do not continue the same task with `agent-browser`, `WebSearch`, or `WebFetch`. Wait for the background result or use `browser_use_status` / `browser_use_cancel`.
- Summarize the findings and cite the important visited URLs in the final answer
