---
name: browser
description: Generic browser automation for any website. Navigate, inspect pages, click elements, fill forms, scroll, and extract content. Works with any site including web.cafe, documentation, research sites, etc.
---

# Browser Automation

Host-based browser automation with visible Chrome window. Andy can dynamically explore websites, decide actions based on what he sees, and extract information.

## Features

- **Generic**: Works with any website, not site-specific
- **Visible browser**: Chrome window on host machine for debugging
- **Persistent sessions**: Maintains login state across uses
- **Flexible**: Andy decides what to do based on page content

## Workflow

1. **Open** a URL
2. **Snapshot** to see what's on the page (elements, links, buttons)
3. **Action** to interact (click, fill, scroll)
4. **Read** to extract content
5. Repeat as needed

## MCP Tools

### browser_open
Navigate to a URL.

```typescript
browser_open({ url: "https://example.com" })
```

Returns: Page title and URL

### browser_snapshot
Get current page state with interactive elements.

```typescript
browser_snapshot({
  interactive: true,  // Only show clickable/fillable elements
  limit: 50          // Max elements to return
})
```

Returns: List of elements with references like `@e1`, `@e2` that can be used in actions.

Example output:
```
Page: Example Site
URL: https://example.com
Elements: 15

@e1 input type="search" placeholder="Search..."
@e2 button "Sign In"
@e3 a "Documentation" href="https://example.com/docs"
@e4 a "Pricing" href="https://example.com/pricing"
```

### browser_action
Perform actions on the page.

**Click:**
```typescript
browser_action({
  action: "click",
  selector: "@e2"  // or CSS selector like "button.submit"
})
```

**Fill form:**
```typescript
browser_action({
  action: "fill",
  selector: "@e1",
  value: "search query"
})
```

**Scroll:**
```typescript
browser_action({
  action: "scroll",
  direction: "down",  // or "up"
  amount: 500        // pixels
})
```

**Press key:**
```typescript
browser_action({
  action: "press",
  value: "Enter"
})
```

**Wait:**
```typescript
browser_action({
  action: "wait",
  amount: 2000  // milliseconds
})
```

### browser_read
Extract text content from the page.

```typescript
browser_read({
  selector: "article"  // Optional: scope to specific element
})
```

Returns: Page title and text content (up to 5000 chars)

## Example Usage

**Research a topic:**
```
1. browser_open({ url: "https://new.web.cafe" })
2. browser_snapshot({ interactive: true })
   → See search input @e1, navigation links
3. browser_action({ action: "fill", selector: "@e1", value: "SEO strategies" })
4. browser_action({ action: "press", value: "Enter" })
5. browser_snapshot({ interactive: true })
   → See search results @e5, @e6, @e7
6. browser_action({ action: "click", selector: "@e5" })
7. browser_read()
   → Extract article content
```

**Browse documentation:**
```
1. browser_open({ url: "https://docs.example.com" })
2. browser_snapshot({ interactive: true })
3. browser_action({ action: "click", selector: "@e3" })
4. browser_read({ selector: ".documentation-content" })
```

## Configuration

Browser profile: `~/.nanoclaw/browser-profile`
- Persistent cookies and login sessions
- Separate from your personal Chrome profile

## Notes

- Browser window is visible for debugging
- Sessions persist across uses (stays logged in)
- Works with any website, not just web.cafe
- Andy can dynamically decide what to do based on page content
- Element references (@e1, @e2) are only valid for current page state
- Re-snapshot after navigation or significant DOM changes
