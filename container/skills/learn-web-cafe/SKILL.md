---
name: learn-web-cafe
description: Learn about how to make money through building websites around SEO keywords on Web.Cafe. Use the tools to research niche ideas, keyword discovery methods, founder case studies, and traffic/monetization patterns.
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

0. **Check for already-visited URLs (REQUIRED before any browsing)**
   - Read `/workspace/group/research/visited-urls.md`
   - Remove any URLs from your planned reading list that already appear in it
   - Only visit URLs that are new to you

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
- clues about hidden keyword sources even when founders do not state the exact keyword directly
- validated success cases and failure cases that change whether a niche is worth entering

## Output expectations

For each case study or article read, output must include:

- the candidate keyword or niche
- **specific method used** (not "they found a keyword" — what tool, what search term, what exact step)
- **specific numbers or outcomes** (traffic, revenue, time to rank, ranking position)
- **mechanism** (why does this work? what is the underlying reason?)
- **My assessment:** [Do I agree this is a good opportunity? Why or why not, based on what I've seen elsewhere?]
- concrete Web.Cafe source URLs
- what the case implies for a solo founder right now

If you cannot fill in all of the above, you have not read deeply enough. Re-read or drill down further.

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

## Completion checklist (REQUIRED before returning)

This skill is not complete until all of the following are done:

- [ ] Every URL visited this session has been added to `/workspace/group/research/visited-urls.md` (date + one-line summary)
- [ ] Any new URLs or topics discovered but not visited this session have been added to `/workspace/group/research/learning-queue.md`
- [ ] `/workspace/group/research/webcafe-notes.md` has a new section with this session's findings
- [ ] Every case study entry includes a "My assessment:" line with a genuine evaluation
- [ ] If this session is part of a longer queue, use `schedule_task` to schedule the next session

**Returning without completing this checklist = incomplete execution.**

## Good usage patterns

- Start from `https://new.web.cafe/topics`, inspect interesting entries, then recurse with `web_cafe_visit_page`
- Use `web_cafe_search` to discover terminology real founders use, then search those terms again
- Combine case-study pages with tutorial pages before recommending a direction

## Avoid

- treating one post as proof of a market
- copying founder claims without extracting the deeper keyword or site-shape lesson
- **returning article titles as findings** — titles are not findings
- **generic summaries with no specific method, number, or mechanism**
- revisiting URLs already in `visited-urls.md`
- relying only on search or only on direct page visits when both are useful
- broad keyword suggestions with no monetization angle
- stopping before the completion checklist is done
