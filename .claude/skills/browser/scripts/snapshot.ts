#!/usr/bin/env npx tsx
/**
 * Browser Automation - Snapshot
 * Get current page state with interactive elements
 */

import { getBrowserContext, runScript, ScriptResult } from '../lib/browser.js';
import { config } from '../lib/config.js';

interface SnapshotInput {
  interactive?: boolean; // Only show interactive elements
  limit?: number; // Max elements to return
}

interface Element {
  ref: string;
  tag: string;
  type?: string;
  text?: string;
  href?: string;
  placeholder?: string;
}

async function snapshot(input: SnapshotInput): Promise<ScriptResult> {
  const interactive = input.interactive !== false; // Default true
  const limit = input.limit || 50;

  let context = null;

  try {
    context = await getBrowserContext();
    const page = context.pages()[0];

    if (!page) {
      return { success: false, message: 'No active page. Use browser_open first.' };
    }

    const title = await page.title();
    const url = page.url();

    // Extract elements
    const elements = await page.evaluate(
      ({ interactive, limit }) => {
        const results: Element[] = [];
        let refCounter = 1;

        const selectors = interactive
          ? 'a, button, input, textarea, select, [role="button"], [onclick]'
          : 'a, button, input, textarea, select, h1, h2, h3, p, div, span';

        const els = document.querySelectorAll(selectors);

        for (const el of Array.from(els)) {
          if (results.length >= limit) break;

          const htmlEl = el as HTMLElement;

          // Skip hidden elements
          const style = window.getComputedStyle(htmlEl);
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          // Skip elements with no visible content
          const text = htmlEl.textContent?.trim() || '';
          const href = (htmlEl as HTMLAnchorElement).href || '';
          const placeholder = (htmlEl as HTMLInputElement).placeholder || '';

          if (!text && !href && !placeholder) continue;

          const element: Element = {
            ref: `@e${refCounter++}`,
            tag: htmlEl.tagName.toLowerCase(),
          };

          if (htmlEl.tagName === 'INPUT') {
            element.type = (htmlEl as HTMLInputElement).type;
          }

          if (text && text.length < 100) {
            element.text = text;
          }

          if (href) {
            element.href = href;
          }

          if (placeholder) {
            element.placeholder = placeholder;
          }

          results.push(element);
        }

        return results;
      },
      { interactive, limit },
    );

    // Format output
    const lines: string[] = [];
    lines.push(`Page: ${title}`);
    lines.push(`URL: ${url}`);
    lines.push(`Elements: ${elements.length}`);
    lines.push('');

    for (const el of elements) {
      let desc = `${el.ref} ${el.tag}`;
      if (el.type) desc += ` type="${el.type}"`;
      if (el.text) desc += ` "${el.text}"`;
      if (el.href) desc += ` href="${el.href}"`;
      if (el.placeholder) desc += ` placeholder="${el.placeholder}"`;
      lines.push(desc);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { title, url, elements },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (context) await context.close();
  }
}

runScript<SnapshotInput>(snapshot);
