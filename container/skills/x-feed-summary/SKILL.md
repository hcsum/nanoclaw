---
name: x-feed-summary
description: Read and summarize X home feed for important themes, sentiment, and signal detection. Use for trend discovery and topic monitoring.
---

# X Feed Summary

Use the local X home-feed script when the user wants to analyze what's appearing in their X home feed for important themes, sentiment, and emerging narratives.

## Command

Run:

```bash
printf '%s' '{"limit":40}' | NANOCLAW_ROOT=/home/node npx tsx /home/node/.claude/skills/x-feed-summary/scripts/read-home.ts
```

- The script returns JSON with `success`, `message`, and optional `data`.
- If the proxy is unavailable, use Web Access first so the host-side browser proxy is started, then retry.

## Output format

Default to a numbered list with moderate detail.

- A short title line is fine when the user asked for a summary or report.
- Use `1.` `2.` `3.` style numbering.
- Each item can be 2-4 sentences when needed.
- Prefer 4-7 items total.
- Put the main signal first and lower-signal items later.
- Keep citations inline only when they materially help, for example a handle or product name.

## How to summarize the home feed

Do not just list posts. Synthesize the feed into a handful of clear takeaways:

- the strongest themes or clusters
- what people seem excited about, worried about, or arguing about
- recurring phrases, complaints, use cases, or requests
- what looks like real signal vs noise
- your interpretation only when it adds value

Cover enough breadth to reflect the actual feed. It is fine to include several distinct themes if they are genuinely present.

If the user wants examples, include a few representative posts or accounts and keep them inside the numbered points.

## Avoid

- dumping a long list of posts with no synthesis
- over-optimizing for brevity when the feed clearly has multiple important threads
- creating too many section headers or turning the answer into a rigid newsletter template
- treating a few loud posts as broad consensus
- confusing engagement bait with meaningful signal
