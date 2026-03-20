#!/usr/bin/env npx tsx
/**
 * X Integration - Read Home Feed
 * Usage: echo '{"limit":25}' | npx tsx read-home.ts
 */

import { getBrowserContext, runScript, config, ScriptResult } from '../lib/browser.js';

interface ReadHomeInput {
  limit?: number;
}

interface FeedItem {
  author: string;
  text: string;
  url: string;
  time: string;
}

function clampLimit(input?: number): number {
  if (!Number.isFinite(input)) return 40;
  const n = Math.floor(Number(input));
  if (n < 5) return 5;
  if (n > 60) return 60;
  return n;
}

function toMessage(items: FeedItem[]): string {
  const lines: string[] = [];
  lines.push(`Fetched ${items.length} posts from X home feed.`);
  lines.push('Use these posts to summarize themes and highlights:');
  lines.push('');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push(`${i + 1}. @${item.author}`);
    lines.push(`text: ${item.text}`);
    if (item.url) lines.push(`url: ${item.url}`);
    if (item.time) lines.push(`time: ${item.time}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

async function readHomeFeed(input: ReadHomeInput): Promise<ScriptResult> {
  const limit = clampLimit(input.limit);

  let context = null;
  try {
    context = await getBrowserContext();
    const page = context.pages()[0] || await context.newPage();

    await page.goto('https://x.com/home', {
      timeout: config.timeouts.navigation,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(config.timeouts.pageLoad);

    const isLoginPage = await page
      .locator('input[autocomplete="username"]')
      .isVisible()
      .catch(() => false);
    if (isLoginPage) {
      return {
        success: false,
        message: 'X login expired. Run X auth setup again.',
      };
    }

    const blocked = await page
      .locator('text=/something went wrong|try reloading|suspicious activity/i')
      .first()
      .isVisible()
      .catch(() => false);
    if (blocked) {
      return {
        success: false,
        message: 'X showed a block/challenge page for automated access.',
      };
    }

    const items: FeedItem[] = [];
    const seen = new Set<string>();

    for (let step = 0; step < 10 && items.length < limit; step++) {
      const batch = await page.evaluate(() => {
        type Raw = {
          author: string;
          text: string;
          url: string;
          time: string;
        };
        const out: Raw[] = [];
        const cards = Array.from(
          document.querySelectorAll('article[data-testid="tweet"]'),
        );

        for (const card of cards) {
          const text = Array.from(
            card.querySelectorAll('[data-testid="tweetText"]'),
          )
            .map((el) => (el.textContent || '').trim())
            .join(' ')
            .trim();

          if (!text) continue;

          const statusLink = card.querySelector(
            'a[href*="/status/"]',
          ) as HTMLAnchorElement | null;
          const url = statusLink?.href || '';

          let author = '';
          if (url) {
            const m = url.match(/x\.com\/([^/]+)\/status\//i);
            author = m?.[1] || '';
          }
          if (!author) {
            const profileLink = card.querySelector(
              'a[href^="/"][role="link"]',
            ) as HTMLAnchorElement | null;
            const href = profileLink?.getAttribute('href') || '';
            const m = href.match(/^\/([^/]+)$/);
            author = m?.[1] || 'unknown';
          }

          const timeEl = card.querySelector('time');
          const time = timeEl?.getAttribute('datetime') || '';

          out.push({ author, text, url, time });
        }

        return out;
      });

      for (const row of batch) {
        const key = `${row.url}|${row.text.slice(0, 120)}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(row);
          if (items.length >= limit) break;
        }
      }

      if (items.length >= limit) break;
      await page.mouse.wheel(0, 1800);
      await page.waitForTimeout(1200);
    }

    if (items.length === 0) {
      return {
        success: false,
        message: 'No feed posts found. X may be blocking or feed is empty.',
      };
    }

    return {
      success: true,
      message: toMessage(items.slice(0, limit)),
      data: {
        count: Math.min(items.length, limit),
      },
    };
  } finally {
    if (context) await context.close();
  }
}

runScript<ReadHomeInput>(readHomeFeed);
