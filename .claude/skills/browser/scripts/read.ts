#!/usr/bin/env npx tsx
/**
 * Browser Automation - Read
 * Extract text content from current page
 */

import { getBrowserContext, runScript, ScriptResult } from '../lib/browser.js';

interface ReadInput {
  selector?: string; // Optional CSS selector to scope reading
}

async function readPage(input: ReadInput): Promise<ScriptResult> {
  let context = null;

  try {
    context = await getBrowserContext();
    const page = context.pages()[0];

    if (!page) {
      return { success: false, message: 'No active page. Use browser_open first.' };
    }

    const title = await page.title();
    const url = page.url();

    // Extract text content
    const content = await page.evaluate((selector) => {
      const root = selector ? document.querySelector(selector) : document.body;
      if (!root) return '';

      // Remove script and style elements
      const clone = root.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script, style, nav, header, footer').forEach((el) => el.remove());

      return clone.textContent?.trim() || '';
    }, input.selector);

    if (!content) {
      return { success: false, message: 'No content found on page' };
    }

    // Limit content length
    const maxLength = 5000;
    const truncated = content.length > maxLength;
    const text = truncated ? content.slice(0, maxLength) + '...' : content;

    return {
      success: true,
      message: `${title}\n\n${text}${truncated ? '\n\n(Content truncated)' : ''}`,
      data: { title, url, content: text, truncated },
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

runScript<ReadInput>(readPage);
