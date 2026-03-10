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

      // Look for post items
      const postEls = document.querySelectorAll(
        'article, [class*="post"], [class*="item"], [class*="card"]'
      );

      for (const el of Array.from(postEls)) {
        if (items.length >= maxPosts) break;

        const titleEl = el.querySelector('h1, h2, h3, [class*="title"]');
        const title = titleEl?.textContent?.trim() || '';
        if (!title) continue;

        const linkEl = el.querySelector('a[href*="/topic"], a[href*="/tutorial"], a[href*="/experience"]') as HTMLAnchorElement;
        const url = linkEl?.href || '';
        if (!url) continue;

        const snippetEl = el.querySelector('p, [class*="content"], [class*="desc"], [class*="summary"]');
        const snippet = snippetEl?.textContent?.trim().slice(0, 200) || '';

        const authorEl = el.querySelector('[class*="author"], [class*="user"]');
        const author = authorEl?.textContent?.trim() || '';

        const dateEl = el.querySelector('time, [class*="date"]');
        const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

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
