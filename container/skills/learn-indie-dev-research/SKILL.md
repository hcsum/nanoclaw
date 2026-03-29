---
name: learn-indie-dev-research
description: Indie developer research workflow - keyword research, SEO analysis, niche discovery, and site building with file-based memory and autonomous learning.
---

# Indie Developer Research Workflow

Use this skill for helping the user become a successful indie developer by building money-making websites.

## Core Principles

- Prioritize English keywords unless explicitly told otherwise
- Reject opportunities that are too heavy, slow, or brand-dependent for indie devs
- Small wins first: fast-to-launch, fast-to-index keywords for quick feedback
- Stop when evidence is sufficient - don't keep searching just to search
- Write to files, not just chat - research conclusions go to `research/` files

## Skill Stack (Use in this order)

1. `learn-x-signals` - Find real user pain points and emerging topics
2. `learn-google-trends` - Validate relative interest and top queries
3. `learn-serp-inspection` - Judge if competition is beatable
4. `learn-web-cafe` - Learn from indie dev community cases

## Research Files (Always maintain)

- `research/keyword-pipeline.md` - Promising keywords
- `research/keyword-watchlist.md` - Keywords to monitor
- `research/keyword-rejections.md` - Why we passed on keywords
- `research/keyword-lessons.md` - What we learned
- `research/site-ideas.md` - Site concepts
- `research/visited-urls.md` - Track URLs to avoid repeats
- `research/learning-queue.md` - Prioritized reading list
- `research/knowledge-synthesis.md` - Synthesized conclusions (update every 3-5 sessions)

## Reading Depth Standard

To count as "read", you must answer:

1. What specific method did they use?
2. What concrete numbers/results?
3. Why did it work?
4. Do I agree? Why/why not?

## Session Completion Checklist

A research session is only done when:

- ✅ New URLs added to `visited-urls.md`
- ✅ Promising URLs/topics added to `learning-queue.md`
- ✅ If used Trends: `google-trends-notes.md` updated
- ✅ If used Web.Cafe: `webcafe-notes.md` updated
- ✅ Keyword conclusions in `keyword-pipeline.md` or `keyword-lessons.md`

## Autonomous Learning

After each completed session:

1. Read `learning-queue.md` for highest priority unread item
2. Schedule next research session with `schedule_task` (1-24 hours later)
3. Mark item as `[>]` with expected time

No user request needed - this is default behavior.
