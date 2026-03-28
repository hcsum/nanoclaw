---
name: learn-web-cafe
description: Research Web.Cafe for keyword ideas, site opportunities, founder lessons, and community signals. Use when the user asks about web.cafe, indie dev case studies, keyword discovery, niche research, or wants lessons extracted from new.web.cafe.
---

# Learn from Web.Cafe

Use Web.Cafe as a research source for:

- profitable niche ideas
- keyword discovery methods
- founder case studies and lessons learned
- traffic, SEO, content, and monetization patterns

Prefer the dedicated Web.Cafe MCP tools over generic browsing when they are available.

## Core tools

- `web_cafe_search`
  - Best for discovering topics, posts, and angles from a keyword or theme
  - Good starting point when you do not yet know which page to inspect
- `web_cafe_visit_page`
  - Best for drilling into a specific `https://new.web.cafe/...` page
  - Also inspects nearby related pages and exposes source URLs for chaining
- `web_cafe_explore_experiences`
  - Best for scanning founder case studies and execution writeups
- `web_cafe_explore_tutorial_articles`
  - Best for tactical how-to content
- `web_cafe_explore_tutorial_columns`
  - Best for recurring columns and deeper thematic series

## Recommended workflow

Use a multi-round workflow instead of one-shot browsing.

1. Start broad
   - Use `web_cafe_search` for a theme like `新词`, `SEO`, `关键词`, `Adsense`, `订阅`, `工具站`, or `出海`.
   - If the user already gave a Web.Cafe URL such as `https://new.web.cafe/topics`, start with `web_cafe_visit_page` on that page.

2. Extract promising pages
   - Read the returned summary and `Sources` URLs.
   - Identify promising subpages: concrete case studies, keyword methods, monetization posts, niche breakdowns, tool comparisons, failure writeups.

3. Drill down
   - Call `web_cafe_visit_page` on the most interesting URL.
   - Reuse newly discovered URLs from that result for another round if needed.
   - Repeat until you have enough evidence, not just one anecdote.

4. Cross-check
   - Use `web_cafe_search` again with narrower or adjacent terms discovered during browsing.
   - Example: start with `新词`, then refine into `比赛`, `流量`, `Adsense`, `工具站`, or a niche name you found.

5. Synthesize for action
   - Do not just summarize pages.
   - Convert findings into decisions: keyword opportunity, site idea, monetization path, risk level, and next validation steps.

## What to look for

When researching for Andy's indie-dev mission, prioritize:

- repeated user pain points
- high-intent search behavior
- underserved long-tail keywords
- weak competitors or low-quality existing pages
- site formats a solo founder can ship quickly
- monetization fit: ads, subscriptions, affiliate, lead gen, tools, directories
- patterns that appear across multiple posts, not isolated claims

## Output expectations

When reporting back, try to include:

- the candidate keyword or niche
- why demand seems real
- why competition may be weak or beatable
- what kind of site should be built
- likely monetization path
- concrete Web.Cafe source URLs that support the conclusion

Write findings into the workspace research notes at `/workspace/group/research/webcafe-notes.md`.

When adding a new entry or appending a section:

- always include the current date and time
- write enough detail that someone can understand the research later without reopening the source pages
- include: the user question or goal, the search terms used, key findings, supporting evidence, concrete source URLs, and recommended next steps
- capture specific facts and examples from sources instead of only high-level summaries
- note uncertainty, conflicting signals, or weak evidence when present
- prefer structured sections and bullets over a short paragraph
- keep each notes file around 1000 lines and do not let it grow much beyond that
- when the current file is full, start a new file in the same folder using sequential names like `webcafe-note-1.md`, `webcafe-note-2.md`, and so on

## Good usage patterns

- Start from `https://new.web.cafe/topics`, inspect interesting entries, then recurse with `web_cafe_visit_page`
- Use `web_cafe_search` to discover terminology real founders use, then search those terms again
- Combine case-study pages with tutorial pages before recommending a direction

## Avoid

- treating one post as proof of a market
- generic summaries with no URLs or no action items
- relying only on search or only on direct page visits when both are useful
- broad keyword suggestions with no monetization angle
