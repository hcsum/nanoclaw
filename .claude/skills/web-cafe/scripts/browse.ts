#!/usr/bin/env npx tsx
/**
 * Web.Cafe Integration - Browse Section
 * Browse recent posts from a specific section
 */

import { getBrowserContext, runScript, ScriptResult } from '../lib/browser.js';
import { config } from '../lib/config.js';

interface BrowseInput {
  section: 'topics' | 'tutorials' | 'experiences' | 'all';
  limit?: number;
}

interface PostItem {
  title: string;
  snippet: string;
  url: string;
  author: string;
  date: string;
}

function clampLimit(input?: number): number {
  if (!Number.isFinite(input)) return 20;
  const n = Math.floor(Number(input));
  if (n < 1) return 1;
  if (n > 50) return 50;
  return n;
}

async function browseSection(input: BrowseInput): Promise<ScriptResult> {
  const section = input.section || 'all';
  const limit = clampLimit(input.limit);

  const sectionUrls: Record<string, string> = {
    all: `${config.baseUrl}/all`,
    topics: `${config.baseUrl}/topics`,
    tutorials: `${config.baseUrl}/tutorials`,
    experiences: `${config.baseUrl}/experiences`,
  };

  const url = sectionUrls[section];
  if (!url) {
    return {
      success: false,
      message: `Invalid section: ${section}. Valid options: topics, tutorials, experiences, all`,
    };
  }

  let context = null;
  try {
    context = await getBrowserContext();
    const page = context.pages()[0] || (await context.newPage());

    await page.goto(url, {
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

    // Extract posts
    const posts = await page.evaluate((maxPosts) => {
      const items: PostItem[] = [];

      // Web.cafe uses links with specific classes for post listings
      const postLinks = document.querySelectorAll('a[href*="/topic/"], a[href*="/tutorial/"], a[href*="/experience/"]');

      for (const linkEl of Array.from(postLinks)) {
        if (items.length >= maxPosts) break;

        const link = linkEl as HTMLAnchorElement;
        const url = link.href;

        // Title is in h2 or h3 within the link
        const titleEl = link.querySelector('h2, h3');
        const title = titleEl?.textContent?.trim() || '';
        if (!title) continue;

        // Snippet is in p tag
        const snippetEl = link.querySelector('p');
        const snippet = snippetEl?.textContent?.trim().slice(0, 200) || '';

        // Date/author info is in the metadata div
        const metaEl = link.querySelector('.text-gray-500, .text-xs');
        const metaText = metaEl?.textContent?.trim() || '';

        // Extract date if present
        const dateMatch = metaText.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/);
        const date = dateMatch ? dateMatch[0] : '';

        const author = '';

        items.push({ title, snippet, url, author, date });
      }

      return items;
    }, limit);

    if (posts.length === 0) {
      return {
        success: false,
        message: `No posts found in section "${section}". Page structure may have changed.`,
      };
    }

    // Format output
    const lines: string[] = [];
    lines.push(`Recent posts from ${section} (${posts.length} items)`);
    lines.push('');

    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      lines.push(`${i + 1}. ${p.title}`);
      if (p.author) lines.push(`   Author: ${p.author}`);
      if (p.date) lines.push(`   Date: ${p.date}`);
      if (p.snippet) lines.push(`   ${p.snippet}`);
      lines.push(`   URL: ${p.url}`);
      lines.push('');
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { section, count: posts.length, posts },
    };
  } finally {
    if (context) await context.close();
  }
}

runScript<BrowseInput>(browseSection);
