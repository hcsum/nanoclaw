---
name: keyword-research
description: Find high-potential keywords by combining Web.Cafe heuristics, SEO MCP data, Google Trends, live SERP inspection, X discussion, and browser research across sites like Reddit. Save the output to a dedicated keyword research note.
---

# Keyword Research

Use this skill when the user wants promising SEO keywords, niche angles, or site ideas that are actually worth building.

This skill is for finding keywords with real upside for a solo founder, not for producing a giant keyword dump.

## Primary goal

Find a small set of keywords that look attractive because they combine:

- real user demand
- manageable competition
- clear page or tool intent
- evidence of pain, desire, or repeated use cases from real users
- a realistic attack angle for a solo founder

## Required sources

Use all of these when they are relevant and available:

1. `/workspace/group/notes/webcafe.md`
2. SEO MCP tools
3. `check-google-trends`
4. `check-serp-inspection`
5. `x-search`
6. `web-access`

`web-access` may be used to browse any useful site, including Reddit, forums, directories, product sites, Chrome Web Store, Product Hunt, GitHub, and niche communities.

## Before starting

1. Read `/workspace/group/notes/webcafe.md` first.
2. Extract the heuristics that matter for this session.
3. Use those heuristics as your filter, especially:
   - trend or fresh-demand discovery matters
   - tool-style intent is often attractive
   - low-to-moderate difficulty is preferred
   - do not trust intuition without validation
   - live SERP weakness matters more than abstract metrics alone

If `/workspace/group/notes/webcafe.md` does not exist, continue anyway, but say that the Web.Cafe note base was unavailable.

## Research workflow

### 1. Define the search space

Start from the user's topic, product area, or interest.

Expand into candidate phrases using:

- direct keyword variants
- tool-intent modifiers such as `generator`, `checker`, `calculator`, `template`, `maker`, `converter`, `editor`, `analyzer`, `tracker`, `planner`
- audience or platform modifiers
- pain-point modifiers
- workflow and comparison modifiers

Prefer short, concrete, user-language phrases over invented marketing wording.

### 2. Expand with SEO MCP first

Use SEO MCP as the first structured source.

At minimum, use:

- keyword idea generation to expand the seed list
- keyword difficulty to estimate ranking resistance

Use other SEO MCP outputs when useful:

- traffic checks for competing domains or exact pages
- backlink checks to understand how strong the current winners are

Do not stop at one seed. Expand, cluster, and narrow.

### 3. Compare trends intentionally

Use `check-google-trends` to compare close variants.

Use Trends to answer questions like:

- is the term rising, stable, or fading
- which wording users prefer
- which modifiers reveal adjacent needs
- whether the term looks seasonal or durable

Do not treat Trends as search volume. Use it to compare relative demand and language.

### 4. Inspect the live SERP

Use `check-serp-inspection` and follow its workflow.

For shortlisted keywords, determine:

- what intent Google is rewarding
- whether the top results are strong or weak
- whether forums, mediocre tools, stale listicles, or weak programmatic pages are ranking
- whether a solo founder could ship a better page or tool

If the SERP is clearly dominated by strong exact-match pages from major brands, say so and move on.

### 5. Cross-check real user language

Use `x-search` to see what people are saying on X about the topic, product category, or pain point.

Look for:

- repeated complaints
- feature requests
- use-case language
- comparisons between tools
- signs that a phrase is emerging or becoming normalized

If X has weak signal, say that directly instead of forcing a conclusion.

### 6. Browse communities and websites with web-access

Load `web-access` and browse real sites when community or product evidence is needed.

Good targets include:

- Reddit threads and subreddits
- niche forums
- Product Hunt launches
- GitHub issues and discussions
- Chrome Web Store reviews
- app marketplaces
- competitor landing pages
- template galleries or directories

Use this to validate whether the keyword reflects a real repeated job-to-be-done.

Do not browse aimlessly. Use browsing to answer specific research questions.

### 7. Judge keyword quality

A keyword is high potential when several of these are true:

- demand looks stable or rising
- wording is natural and specific
- difficulty is low or moderate relative to the opportunity
- the SERP has visible weakness
- users clearly want a tool, template, workflow, or comparison page
- a focused solo-founder page could satisfy the intent better than current results
- the adjacent community signal matches the search behavior

Reject keywords when several of these are true:

- vague or broad intent
- no visible user pain
- SERP dominated by giant trusted brands with excellent pages
- weak or purely novelty traffic with no repeat value
- no plausible page you could build that is meaningfully better

## Output expectations

Do not return a giant spreadsheet-style dump unless the user explicitly asks for it.

Default to a compact research memo with:

1. top keyword opportunities
2. why each one looks attractive
3. the recommended page or tool angle
4. notable risks or reasons to avoid near-misses

When useful, include a simple table with columns like:

- keyword
- why it matters
- trend read
- KD / competition read
- SERP verdict
- community signal
- recommended build angle
- status: pursue / watch / reject

## Notes output

Write the durable result to:

`/workspace/group/notes/keyword-research.md`

If the file does not exist, create it.

Append each new session with this structure:

```markdown
<ISO timestamp>
## Keyword Research

### Topic

[what was researched]

### Best Opportunities

- keyword: ...
  - why: ...
  - trend: ...
  - serp: ...
  - community: ...
  - build: ...

### Rejected Or Weak Keywords

- keyword: ...
  - reason: ...

### Sources Used

- Web.Cafe notes
- SEO MCP
- Google Trends
- SERP inspection
- X search
- browser research
```

Preserve concrete evidence. Keep URLs, community phrases, and platform names when they help future sessions.

## Browser rules

When using `web-access`:

- operate in your own background tabs
- track every `targetId` you create
- close every tab you created before finishing
- prefer direct inspection over assumptions

## Avoid

- picking keywords from metrics alone
- treating Trends as volume
- trusting SEO difficulty without checking the SERP
- stopping after one source
- browsing Reddit or X without extracting concrete language or demand signal
- recommending keywords without a clear page or tool concept
- writing only conclusions to the note and dropping the evidence
