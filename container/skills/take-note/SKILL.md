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

Format: `1.md`, `2.md`, `3.md`, ...

Start with `1.md`. Keep writing to the current file until it exceeds ~1000 lines, then create the next number file.

## File Rotation

Write to the highest-numbered existing file under ~1000 lines. If appending would exceed ~1000 lines, create a new file with the next integer number.

## How to Write a Note

```bash
mkdir -p /workspace/group/notes
# Find the current note file:
current_file=1.md
if [ -d /workspace/group/notes ]; then
  # Get highest existing number
  highest=$(ls -1 /workspace/group/notes/ | grep -E '^[0-9]+\.md$' | sed 's/\.md//' | sort -n | tail -n 1)
  if [ -n "$highest" ]; then
    # Check line count
    line_count=$(wc -l < /workspace/group/notes/${highest}.md)
    if [ "$line_count" -lt 1000 ]; then
      current_file="${highest}.md"
    else
      current_file="$((highest + 1)).md"
    fi
  fi
fi
printf '<!-- %s -->\n%s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "${content}" >> /workspace/group/notes/${current_file}
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
- Files are simple markdown, numbered sequentially starting at 1
- Each entry is timestamped with an HTML comment for provenance
