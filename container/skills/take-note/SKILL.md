---
name: take-note
description: Save notes when the user says "mark this down", "take a note", "markdown [term]", or similar.
---

# Take Note

Write notes to `/workspace/group/notes/` when the user says things like:

- "mark this down"
- "take a note"
- "write this down"
- "remember this"
- "markdown [something]"

## File Naming

Format: `YYYY-MM-DD.md`

Example: `2026-03-30.md`

All notes for the same day go into the same file.

## File Rotation

Keep files under ~1000 lines. If appending would exceed this, create a new file with the next day's date.

## How to Write a Note

```bash
mkdir -p /workspace/group/notes
date_file=$(date -u +%Y-%m-%d).md
printf '<!-- %s -->\n%s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "${content}" >> /workspace/group/notes/${date_file}
```

## "markdown [term]" Requests

When the user says "markdown [term]":

1. Recall relevant context from the current conversation about that term
2. Format as:

```markdown
## term-name

Description or context about the term, including what was previously discussed...
```

## Example Triggers

- User: "markdown Tanstack AI"
  -> Recall conversation context about Tanstack AI and write a description

## Notes

- Notes go in `/workspace/group/notes/`
- Files are simple markdown
- Each entry is timestamped with an HTML comment for provenance
