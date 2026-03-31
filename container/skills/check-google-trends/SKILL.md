---
name: check-google-trends
description: Use Google Trends to compare keyword demand, find top queries, and spot user intent patterns.
---

# Check Google Trends

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
   - Use the result to decide which keyword deserves SERP inspection next, not as the final decision by itself.

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
- which terms seem better for quick validation versus longer-term opportunity
- the Google Trends compare URL used

**REQUIRED — write findings to `/workspace/group/research/google-trends-notes.md` before returning.**

This file may not exist yet — if it doesn't, create it. Writing to this file is not optional. Returning without writing = incomplete execution.

Each entry must include:

- date and time
- the keywords compared and the `google_trends_compare` URL used
- average interest scores for each keyword
- top query patterns per keyword (specific phrases, not just "high intent queries")
- **My interpretation:** which keyword is more promising and why, based on this data combined with other evidence I've collected
- what to check next (SERP, X signals, etc.)

Keep each notes file around 1000 lines; start `google-trends-note-1.md`, `google-trends-note-2.md`, etc. when full.

## Avoid

- treating relative interest as literal search volume
- treating Trends alone as enough to recommend building a site
- assuming top queries alone prove a market
- comparing too many unrelated keywords in one run
- returning raw rows without interpretation
