#!/usr/bin/env npx tsx
/**
 * Web.Cafe Integration - Search
 * Search for content by query
 */

import { getBrowserContext, runScript, ScriptResult } from '../lib/browser.js';
import { config } from '../lib/config.js';

interface SearchInput {
  query: string;
  limit?: number;
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  author: string;
  date: string;
  section: string;
}

function clampLimit(input?: number): number {
  if (!Number.isFinite(input)) return 10;
  const n = Math.floor(Number(input));
  if (n < 1) return 1;
  if (n > 50) return 50;
  return n;
}

async function searchWebCafe(input: SearchInput): Promise<ScriptResult> {
  if (!input.query || input.query.trim().length === 0) {
    return { success: false, message: 'Search query cannot be empty' };
  }

  const limit = clampLimit(input.limit);
  let context = null;

  try {
    context = await getBrowserContext();
    const page = context.pages()[0] || (await context.newPage());

    // Go to homepage first to ensure logged in
    await page.goto(config.baseUrl, {
      timeout: config.timeouts.navigation,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(config.timeouts.pageLoad);

    // Check if logged in
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

    // Find and use search input
    const searchInput = await page.locator('input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]').first();
    const searchVisible = await searchInput.isVisible().catch(() => false);

    if (!searchVisible) {
      return {
        success: false,
        message: 'Search input not found. Make sure you are logged in.',
      };
    }

    // Perform search
    await searchInput.fill(input.query);
    await searchInput.press('Enter');
    await page.waitForTimeout(config.timeouts.pageLoad);

    // Extract search results
    const results = await page.evaluate((maxResults) => {
      const items: SearchResult[] = [];

      // Web.cafe uses links with specific classes for search results
      const resultLinks = document.querySelectorAll('a[href*="/topic"], a[href*="/tutorial"], a[href*="/experience"]');

      for (const linkEl of Array.from(resultLinks)) {
        if (items.length >= maxResults) break;

        const link = linkEl as HTMLAnchorElement;
        const url = link.href;

        // Skip navigation links
        if (!url.includes('/topic/') && !url.includes('/tutorial/') && !url.includes('/experience/')) {
          continue;
        }

        // Title is in h2 within the link
        const titleEl = link.querySelector('h2, h3');
        const title = titleEl?.textContent?.trim() || '';
        if (!title) continue;

        // Snippet is in p tag
        const snippetEl = link.querySelector('p');
        const snippet = snippetEl?.textContent?.trim().slice(0, 200) || '';

        // Date/author info is in the metadata div
        const metaEl = link.querySelector('.text-gray-500, .text-xs');
        const metaText = metaEl?.textContent?.trim() || '';

        // Extract date if present (format: YYYY-MM-DD HH:MM)
        const dateMatch = metaText.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/);
        const date = dateMatch ? dateMatch[0] : '';

        // Author is harder to extract, leave empty for now
        const author = '';

        let section = '';
        if (url.includes('/topic/')) section = 'topic';
        else if (url.includes('/tutorial/')) section = 'tutorial';
        else if (url.includes('/experience/')) section = 'experience';

        items.push({ title, snippet, url, author, date, section });
      }

      return items;
    }, limit);

    if (results.length === 0) {
      return {
        success: false,
        message: `No results found for "${input.query}". Try a different query.`,
      };
    }

    // Format output
    const lines: string[] = [];
    lines.push(`Found ${results.length} results for "${input.query}"`);
    lines.push('');

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      lines.push(`${i + 1}. ${r.title}`);
      if (r.author) lines.push(`   Author: ${r.author}`);
      if (r.date) lines.push(`   Date: ${r.date}`);
      if (r.section) lines.push(`   Section: ${r.section}`);
      if (r.snippet) lines.push(`   ${r.snippet}`);
      lines.push(`   URL: ${r.url}`);
      lines.push('');
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { count: results.length, query: input.query, results },
    };
  } finally {
    if (context) await context.close();
  }
}

runScript<SearchInput>(searchWebCafe);
