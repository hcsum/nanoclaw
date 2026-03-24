---
name: learn-google-trends
description: Research Google Trends with a dedicated compare tool. Use when the user wants keyword demand comparison, average interest, or top related queries from Google Trends.
---

# Learn from Google Trends

Use Google Trends as a research source for:

- comparing search demand across multiple keywords
- checking which terms sustain interest over time
- finding top queries attached to each compared keyword
- spotting adjacent user language and search intent

Prefer the dedicated Google Trends MCP tool over generic browsing when it is available.

## Core tool

- `google_trends_compare`
  - Opens a Google Trends compare page in a real browser
  - Captures the `Average interest` metric for each keyword in the comparison
  - Clicks each keyword and captures the first page of `Top queries` plus change values

## Recommended workflow

1. Start with 2-5 keywords
   - Compare close variants, adjacent niches, or competing phrasings.
   - Good examples: singular vs plural, broad term vs buyer-intent term, consumer phrase vs creator phrase.

2. Read the averages first
   - Use `Average interest` as the quick demand snapshot.
   - Do not treat it as search volume. It is relative interest inside the chosen comparison.

3. Inspect top queries per keyword
   - Look for repeated modifiers, user goals, and tool/platform names.
   - Compare how the query mix changes between related keywords.

4. Synthesize for action
   - Translate findings into naming choices, content angles, and niche validation steps.
   - Call out whether one keyword appears broader, more commercial, or more specific.

## What to look for

When researching for Andy's indie-dev mission, prioritize:

- terms with durable relative interest
- modifiers that reveal high intent
- product, tool, app, generator, or pricing language
- queries that expose unmet needs or use cases
- differences in user intent between similar keywords

## Output expectations

When reporting back, try to include:

- the compared keywords
- which keyword has the highest average interest
- the strongest top-query patterns for each keyword
- what these patterns imply for site naming, positioning, or content
- the Google Trends compare URL used

Write findings into the workspace research notes at `/workspace/group/research/google-trends-notes.md`.

When adding a new entry or appending a section:

- always include the current date and time
- keep each notes file around 1000 lines and do not let it grow much beyond that
- when the current file is full, start a new file in the same folder using sequential names like `google-trends-note-1.md`, `google-trends-note-2.md`, and so on

## Avoid

- treating relative interest as literal search volume
- assuming top queries alone prove a market
- comparing too many unrelated keywords in one run
- returning raw rows without interpretation
