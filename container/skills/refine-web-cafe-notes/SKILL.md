---
name: refine-web-cafe-notes
description: Filter Web.Cafe learning notes by removing off-topic content per User Preference. Only deletes what is explicitly out of scope. Does not rewrite, consolidate, distill, or rename existing content. Use after learn-web-cafe or manually via /refine-web-cafe-notes.
---

# Refine Web.Cafe Notes

## When to Invoke

Call this skill after every `learn-web-cafe` session, before closing tabs and before declaring the learning session complete. It can also be triggered manually by the user.

**Default notes path**: `/workspace/group/webcafe/notes.md`

## Core Principle

This skill **filters out-of-scope content and lightly consolidates related material**, but does not rewrite or over-simplify. The notes should remain rich with case studies, data, and detail.

The goal: remove what is explicitly not wanted, group what belongs together, but keep all the substance.

Do:

- Delete entries explicitly marked out of scope in `## User Preference`
- Merge duplicate or near-duplicate entries on the same topic (combine into one, keep all data from both)
- Group related content under clear section headings
- Keep all case studies, data points, URLs, names, formulas, and session records intact

Do not:

- Rewrite or rephrase existing notes
- Delete content just because it is "too long", "too surface-level", or "not a principle"
- Force分散的笔记合并成几条干巴巴的原则
- Reduce case studies to bullet-point summaries — preserve the narrative and specific numbers

## Absolute Rules

1. **Never modify `## User Preference` or any content beneath it.** Read it to understand scope, but do not alter a single word.

2. **Only delete what is explicitly out of scope.** A topic is out of scope only if `## User Preference` explicitly says "not important", "not for now", or similar. If User Preference says nothing about a topic, keep it.

3. **Never delete in-scope content for any reason.** Do not delete because it is "too long", "too surface-level", "not a principle", "just a case study", or "needs distilling". If the topic is in scope, the entry stays — regardless of its format, length, or whether it has been "properly refined".

4. **Session records and raw findings are not disposable.** If a session record has URLs, data, names, or observations from a browsing session, it is evidence. Do not delete it because it "lacks structure". Keep all session records intact.

5. **Never delete or merge entries in `## What I Still Want to Learn`（待探索） section.** This section tracks learning goals and exploration direction. Entries here represent active learning intent — they must not be removed, consolidated, or moved out of this section, regardless of their format or whether they appear "unrefined". Only the user can decide to promote an item from this section to "What I Know Now".

## What to Delete

Only delete entries that meet ALL of these conditions:

1. The topic is **explicitly** marked out of scope in `## User Preference` (e.g., "不关心XXX", "not important", "not for now")
2. The entry is **not** providing necessary context for an in-scope topic
3. The entry has **no** specific data, real names, URLs, or numbers that might be useful reference material

If any of these are unclear, do not delete — keep instead.

## What to Keep (Never Delete)

These categories have independent value and must never be deleted for lack of refinement:

- Entries with specific data points (traffic numbers, revenue, timeframes, conversion rates)
- Entries with real person names and their specific results
- Entries with specific tool names, URLs, version numbers, or formulas
- Session raw records documenting what was learned when
- Entries that are purely descriptive without extracted methodology
- Long, detailed case studies
- Duplicate or near-duplicate entries — merge them (see below), do not delete
- Entries that repeat information from other sessions

## Workflow

### Step 1: Read User Preference

Read `## User Preference` and extract the explicit out-of-scope topics. Be precise — "adsense" mentioned as out-of-scope means only adsense entries are deleted, not everything that mentions monetization.

### Step 2: Delete Out-of-Scope Content

For each section and entry outside `## User Preference`, check: does User Preference explicitly say this topic is not wanted?

If **yes, out of scope** → delete.
If **no or unclear** → keep.
If **ambiguous** → keep rather than delete.

### Step 3: Merge and Consolidate Related Content

After deletion, consolidate content on the same topic:

- **Same topic, multiple scattered entries** → merge into one entry, keep all specific data from every source (numbers, URLs, names, formulas)
- **Same person/case appearing in multiple places** → consolidate into one complete record
- **Contradictions between sources** → keep both, label the contradiction clearly
- **Near-duplicates** → combine into one entry rather than deleting

**Do not over-simplify during merging.** When merging case studies or multiple entries on the same topic, preserve all the detail — do not compress into a one-liner. The merged entry should contain everything from each source. The goal is to eliminate redundancy while retaining every specific data point, URL, and number.

### Step 4: Report

Report to the user:

```
Notes filtered.

Deleted: [X] entries removed as out-of-scope
Remaining: [X] entries kept unchanged
```

List the topics that were deleted so the user can see what was removed.

## If Notes File Does Not Exist

If `/workspace/group/webcafe/notes.md` does not exist, create it with this template:

```markdown
# Web.Cafe 学习笔记

## User Preference

[Placeholder — user should fill this in to set scope for future sessions]

## What I Know Now

[Empty — to be filled after first learning session]

## Key Sources

[Empty — to be filled after first learning session]

## What I Still Want to Learn

[Empty — to be filled after first learning session]
```

Report: "Notes file initialized at `/workspace/group/webcafe/notes.md`. Please fill in `## User Preference` to set the scope for future sessions."

## Session Completeness Checklist

This skill is not complete until:

- [ ] Only entries explicitly marked out-of-scope in `## User Preference` were deleted
- [ ] Related content on the same topic was merged (not deleted)
- [ ] All data points, URLs, names, and numbers were preserved during merging
- [ ] No entry was deleted because it was "too long", "too surface-level", or "needed distilling"
- [ ] No entry was rewritten or over-simplified
- [ ] Contradictions between sources were preserved and labeled, not resolved
- [ ] `## What I Still Want to Learn`（待探索） section left untouched — no entries deleted, merged, or moved
- [ ] Change report delivered to the user
