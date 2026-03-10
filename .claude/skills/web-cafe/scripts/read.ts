#!/usr/bin/env npx tsx
/**
 * Web.Cafe Integration - Read
 * Read and extract content from a specific URL
 */

import { getBrowserContext, runScript, ScriptResult } from '../lib/browser.js';
import { config } from '../lib/config.js';

interface ReadInput {
  url: string;
}

interface ContentData {
  title: string;
  author: string;
  date: string;
  body: string;
  tags: string[];
  section: string;
}

async function readWebCafe(input: ReadInput): Promise<ScriptResult> {
  if (!input.url || input.url.trim().length === 0) {
    return { success: false, message: 'URL cannot be empty' };
  }

  // Validate URL is from web.cafe
  if (!input.url.includes('web.cafe')) {
    return { success: false, message: 'URL must be from web.cafe domain' };
  }

  let context = null;
  try {
    context = await getBrowserContext();
    const page = context.pages()[0] || (await context.newPage());

    await page.goto(input.url, {
      timeout: config.timeouts.navigation,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(config.timeouts.pageLoad);

    // Check if login required
    const needsLogin = await page
      .locator('text=/登 录|sign in/i')
      .first()
      .isVisible()
      .catch(() => false);

    if (needsLogin) {
      return {
        success: false,
        message: 'Login required. Run setup script first.',
      };
    }

    // Extract content
    const content = await page.evaluate(() => {
      const data: Partial<ContentData> = {
        title: '',
        author: '',
        date: '',
        body: '',
        tags: [],
        section: '',
      };

      // Title - look for h1 or main heading
      const titleEl = document.querySelector('h1, [class*="title"]');
      data.title = titleEl?.textContent?.trim() || '';

      // Author - look for author/username elements
      const authorEl = document.querySelector(
        '[class*="author"], [class*="username"], [class*="user"]',
      );
      data.author = authorEl?.textContent?.trim() || '';

      // Date - look for time elements
      const dateEl = document.querySelector('time, [class*="date"], [class*="time"]');
      data.date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

      // Body - main content area
      const bodyEl = document.querySelector(
        'article, [class*="content"], [class*="body"], main',
      );
      if (bodyEl) {
        // Remove script, style, and nav elements
        const clone = bodyEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, nav, header, footer').forEach((el) => el.remove());
        data.body = clone.textContent?.trim() || '';
      }

      // Tags - look for tag/label elements
      const tagEls = document.querySelectorAll('[class*="tag"], [class*="label"]');
      data.tags = Array.from(tagEls)
        .map((el) => el.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 0);

      // Section - infer from URL or breadcrumbs
      const url = window.location.pathname;
      if (url.includes('/topic')) data.section = 'topic';
      else if (url.includes('/tutorial')) data.section = 'tutorial';
      else if (url.includes('/experience')) data.section = 'experience';

      return data;
    });

    if (!content.title && !content.body) {
      return {
        success: false,
        message: 'Could not extract content from page. Page structure may have changed.',
      };
    }

    // Format output
    const lines: string[] = [];
    lines.push(`Title: ${content.title || 'N/A'}`);
    if (content.author) lines.push(`Author: ${content.author}`);
    if (content.date) lines.push(`Date: ${content.date}`);
    if (content.section) lines.push(`Section: ${content.section}`);
    if (content.tags && content.tags.length > 0) {
      lines.push(`Tags: ${content.tags.join(', ')}`);
    }
    lines.push('');
    lines.push('Content:');
    lines.push(content.body || 'No content extracted');

    return {
      success: true,
      message: lines.join('\n'),
      data: content,
    };
  } finally {
    if (context) await context.close();
  }
}

runScript<ReadInput>(readWebCafe);

