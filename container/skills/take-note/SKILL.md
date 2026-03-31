---
name: take-note
description: Save notes when the user says "mark this down", "take a note", "markdown [term]", or similar.
---

# Take Note

Distinguish between two types of notes:

## Type 1: Content to consume later

Write to `/workspace/group/notes/`

Use for: articles, links, videos, resources — things the user wants to read/watch later.

Example triggers:

- "save this for later"
- "read this later"
- "add to my reading list"
- "bookmark this"
- "check this out later"

## Type 2: User preferences and facts

Write to `./CLAUDE.md`

Use for: facts about the user — interests, preferences, habits, personal info. Things the agent should remember to give personalized responses.

Example triggers:

- "remember I like..."
- "I'm interested in..."
- "my preference is..."
- "don't forget that I..."
- "I'm into..."
- "you should know that I..."

The `./CLAUDE.md` is the agent's memory for this channel/group. Use it for:

- User's interests and hobbies
- Communication style preferences
- Facts about the user (name, location, etc.)
- Things the agent should know to give better responses

## "markdown [term]" Requests

When the user says "markdown [term]":

1. Recall relevant context from the current conversation about that term
2. Format as:

```markdown
## term-name

Description or context about the term, including what was previously discussed...
```

Default to `/workspace/group/notes/` for markdown requests unless it's clearly a user preference.

## How to Write a Note (Type 1 - User Notes)

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

## How to Write a Note (Type 2 - Agent Memory)

Append to `./CLAUDE.md` with a new section. If `./CLAUDE.md` doesn't exist, create it with this structure:

```markdown
# Channel Memory

## User Preferences

<!-- timestamp -->

- Preference or fact here
```

If the file exists, append new entries under the appropriate section.

## Notes

- Type 1 (content): Notes go in `/workspace/group/notes/`, numbered sequentially, timestamped
- Type 2 (preferences): Notes go in `./CLAUDE.md` for channel-specific memory
