---
name: learn-web-cafe
description: Visit https://web.cafe to learn indie developer growth methodology from experienced practitioners sharing real-world insights on promotion, niche discovery, market research, and mindset.
---

# Learn from Web.Cafe

Use the `web-access` skill to explore and learn from the community.

## Required Browsing Mode

All Web.Cafe browsing should go through `web-access`.

- Load `web-access` first.
- Use the host browser through the `web_access_*` tools.
- Operate in your own background tab.
- Close tabs you created after the work is complete.

## How to navigate Web.Cafe reliably

Web.Cafe uses client-side routing and some clickable content does not expose a normal `href` in the DOM. Do not assume article URLs are always available from anchor tags.

- Prefer inspecting the rendered page first with `web_access_eval`.
- If a card or article title is a clickable element such as `p.cursor-pointer`, click the actual rendered element instead of trying to reconstruct the URL.
- Before clicking, assign the target node a temporary id in `web_access_eval`, scroll it into view, then click it with `web_access_call` using `/clickAt` or `/click`.
- After clicking, check whether navigation opened a new tab or changed the current tab by comparing `/targets` and `/info`.
- If direct clicking fails, fall back to `element.click()` inside `web_access_eval`, then re-check `/targets` and `/info`.

For pages that list many articles, a reliable pattern is:

1. Use `web_access_eval` to find the title node by visible text.
2. Add a temporary id such as `nc-target` and call `scrollIntoView({ block: "center" })`.
3. Click `#nc-target` with `/clickAt` first.
4. Re-check `/targets` and `/info` to discover the opened detail page.

Do not rely only on `a[href]` collection for Web.Cafe exploration.

## What to extract

For each case study or discussion, capture the underlying methodology, not the surface details:

- **Promotion** — how did they drive traffic? What channels, tactics, or strategies did they use?
- **Niche discovery** — how did they find or come up with their niche? What was their thought process?
- **Market research** — what tools and methods did they use to validate demand? How did they assess competition?
- **Methodology and mindset** — what principles or frameworks guide their decisions? How do they think about risk, time investment, and tradeoffs?

After each session, actively revise your notes rather than just appending. Update beliefs that changed, note contradictions, and refine principles that became more precise.

## Learning Goal

Understand how experienced indie founders approach building and growing websites — their processes, tools, and mental models. Extract transferable insights about promotion channels, niche selection, market validation, and the mindset required for solo projects. Do not look for specific keywords or traffic numbers — those are symptoms, not causes.

## Working style

1. **Before starting**: Read `/workspace/group/webcafe/notes.md` thoroughly. Understand what you've already covered and what patterns or principles you've identified. Decide what new questions or gaps to explore this session.
2. **Explore and read**: Use `web-access` to discover and read relevant content. Start broad from the home page, `/experiences`, or `/tutorials`, then narrow down to specific pages by clicking through the rendered UI. If a page has little text content but video, skip it.
3. **Synthesize**: After reading new content, update the notes — not by appending, but by revising and refining your overall understanding. Update the "What I know now" section with new/evolved insights, add new questions to "What I still want to learn", and note any contradictions or nuances you discovered.

## About web.cafe

- https://new.web.cafe, home page shows latest posts across sections
- https://new.web.cafe/experiences — team experiences shared by the community owner
- https://new.web.cafe/tutorials — tutorial columns and articles
- The site search uses Simplified Chinese, so search in Chinese unless the term is widely-known in English (e.g. "SEO", "Adsense", "API")

## Notes structure

The `/workspace/group/webcafe/notes.md` should evolve over time and serve as a living document of your evolving understanding. A good structure:

```markdown
# Web.Cafe 学习笔记

## What I know now (updated each session)

- Key principles and frameworks discovered
- Patterns across multiple case studies (with URLs)
- How indie founders approach specific problems

## What I still want to learn (refreshed each session)

- Questions that emerged from this session
- Topics to explore next time
- Contradictions or uncertainties to resolve

## Key sources (always updated)

- URLs of pages that shaped your understanding

## This session's raw findings (temporary)

- Brief notes of what was read this session
```

When you update notes after a session, use the raw findings to revise the "What I know now" and "What I still want to learn" sections — integrate new insights, drop things that turned out to be wrong or superficial, and sharpen the framing.

## Completion checklist (REQUIRED before returning)

This skill is not complete until all of the following are done:

- [ ] Revised `/workspace/group/webcafe/notes.md` — integrated new insights, updated beliefs, refined key principles

## Avoid

- treating one post as proof of a winning strategy
- copying founder claims without extracting the underlying approach or reasoning
- **returning article titles as findings** — titles are not findings
- **surface-level summaries** — always ask "what is this person actually doing and why?"
- looking for specific keywords — focus on how niches are found and validated, not what the keywords are
- relying on a single page when broader evidence is available
- **just appending notes without revising** — always integrate new learnings into your evolving understanding
