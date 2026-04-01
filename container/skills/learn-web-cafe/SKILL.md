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
- Track every `targetId` you create.
- Close every tab you created after the work is complete, including tabs opened speculatively and never used.
- Prefer reusing an existing working tab instead of opening a new one unless parallel reading is actually useful.

## How to navigate Web.Cafe reliably

Web.Cafe uses client-side routing and some clickable content does not expose a normal `href` in the DOM. Do not assume article URLs are always available from anchor tags.

The main failure mode on this site is trying to infer or reconstruct URLs from titles, authors, or guessed route patterns. Do not do that.

- Prefer inspecting the rendered page first with `web_access_eval`.
- If a card or article title is a clickable element such as `p.cursor-pointer`, click the actual rendered element instead of trying to reconstruct the URL.
- Before clicking, assign the target node a temporary id in `web_access_eval`, scroll it into view, then click it with `web_access_call` using `/clickAt` or `/click`.
- After clicking, check whether navigation opened a new tab or changed the current tab by comparing `/targets` and `/info`.
- If direct clicking fails, fall back to `element.click()` inside `web_access_eval`, then re-check `/targets` and `/info`.

## Required decision rules

- If `a[href]` lookup returns `undefined`, an empty array, or unrelated links, stop trying to extract a URL and click the rendered node instead.
- Never invent detail-page URLs from a title, author, guessed slug, or guessed route such as `/post/...`.
- Never treat a `404` page as evidence that the content does not exist if the URL was guessed rather than discovered from the UI.
- If search results or detail listings expose real `a[href]` links, you may reuse those exact URLs.
- If a page only exposes text and clickable nodes, the rendered click path is the source of truth.
- If one path already returned the real URL you need, immediately abandon speculative alternative tabs and close them.
- If a newly opened tab does not contribute to the final answer or note update, close it as soon as that becomes clear.

For pages that list many articles, a reliable pattern is:

1. Use `web_access_eval` to find the title node by visible text.
2. Add a temporary id such as `nc-target` and call `scrollIntoView({ block: "center" })`.
3. Click `#nc-target` with `/clickAt` first.
4. Re-check `/targets` and `/info` to discover the opened detail page.

Example logic for a visible title with no `href`:

```javascript
(() => {
  const el = Array.from(document.querySelectorAll('p, h2, h3, a')).find(
    (node) => node.textContent?.includes('Adsense 申请的正确流程'),
  );
  if (!el) return JSON.stringify({ found: false });
  el.id = 'nc-target';
  el.scrollIntoView({ block: 'center' });
  return JSON.stringify({
    found: true,
    tag: el.tagName,
    text: el.textContent?.trim() || '',
  });
})();
```

Then click `#nc-target`. Do not run more `href` guesses after this point.

Do not rely only on `a[href]` collection for Web.Cafe exploration.

## What to extract

First respect `## User Preference` at the top of `/workspace/group/webcafe/notes.md`.

- Use it as the scope filter for this session: it decides what to research, what to keep, and what to cut.
- Treat items marked as not important or not important for now as out of scope unless they are necessary context for a preferred topic.
- If a page is mostly out of scope, skip it. If it mixes high- and low-priority material, keep only the useful parts.

For each case study or discussion, capture the underlying methodology, not the surface details:

- **Promotion** — how did they drive traffic? What channels, tactics, or strategies did they use?
- **Niche discovery** — how did they find or come up with their niche? What was their thought process?
- **Market research** — what tools and methods did they use to validate demand? How did they assess competition?
- **Methodology and mindset** — what principles or frameworks guide their decisions? How do they think about risk, time investment, and tradeoffs?

## Learning Goal

Understand how experienced indie founders approach building and growing websites — their processes, tools, and mental models. Extract transferable insights about promotion channels, niche selection, market validation, and the mindset required for solo projects. Do not look for specific keywords or traffic numbers — those are symptoms, not causes.

## Working style

1. **Before starting**: Read `/workspace/group/webcafe/notes.md` thoroughly, including `## User Preference` at the top. Use that section to decide what is in scope this session, what to deprioritize, and which gaps are actually worth exploring.
2. **Explore and read**: Use `web-access` to discover and read relevant content. Start broad from the home page, `/experiences`, or `/tutorials`, then narrow down to specific pages by clicking through the rendered UI. Follow the `User Preference` scope filter while choosing pages and extracting findings. If a page has little text content but video, skip it.
3. **Cleanup**: Before finishing, close every `targetId` created during the session. Do not leave behind idle search tabs, 404 tabs, or speculative tabs that are no longer needed.

## About web.cafe

- https://new.web.cafe, home page shows latest posts across sections
- https://new.web.cafe/experiences — team experiences shared by the community owner
- https://new.web.cafe/tutorials — tutorial columns and articles
- The site search uses Simplified Chinese, so search in Chinese unless the term is widely-known in English (e.g. "SEO", "Adsense", "API")

## Completion checklist (REQUIRED before returning)

This skill is not complete until all of the following are done:

- [ ] Invoked `/refine-web-cafe-notes` to fully refine and distil the notes

## Avoid

- treating one post as proof of a winning strategy
- copying founder claims without extracting the underlying approach or reasoning
- **returning article titles as findings** — titles are not findings
- **surface-level summaries** — always ask "what is this person actually doing and why?"
- looking for specific keywords — focus on how niches are found and validated, not what the keywords are
- relying on a single page when broader evidence is available

- spending session time on topics that `## User Preference` says the user does not care about unless they are necessary context for a preferred topic

- leaving behind browser tabs created during the session, especially speculative search tabs that were never used
