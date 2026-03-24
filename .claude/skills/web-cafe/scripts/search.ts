#!/usr/bin/env npx tsx

import { BrowserContext, Locator, Page } from 'playwright';

import {
  type ScriptResult,
  buildResearchReport,
  clampPageLimit,
  collectCandidateLinks,
  ensureLikelyLoggedIn,
  getBrowserContext,
  openPage,
  runScript,
  visitRepresentativePages,
} from '../lib/browser.js';

interface SearchInput {
  query: string;
  goal?: string;
  max_pages?: number;
}

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    if (
      await locator
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return locator.first();
    }
  }
  return null;
}

async function findSearchInput(page: Page): Promise<Locator | null> {
  const direct = await firstVisible([
    page.locator('input[type="search"]'),
    page.locator('[role="searchbox"]'),
    page.locator('input[placeholder*="搜索"]'),
    page.locator('input[placeholder*="search" i]'),
    page.locator('input[aria-label*="搜索"]'),
    page.locator('input[aria-label*="search" i]'),
  ]);
  if (direct) return direct;

  const trigger = await firstVisible([
    page.locator('button[aria-label*="搜索"]'),
    page.locator('button[aria-label*="search" i]'),
    page.locator('button:has-text("搜索")'),
    page.locator('a:has-text("搜索")'),
    page.locator('[role="button"]:has-text("搜索")'),
  ]);

  if (trigger) {
    await trigger.click();
    await page.waitForTimeout(700);
  }

  return firstVisible([
    page.locator('input[type="search"]'),
    page.locator('[role="searchbox"]'),
    page.locator('input[placeholder*="搜索"]'),
    page.locator('input[placeholder*="search" i]'),
    page.locator('input[aria-label*="搜索"]'),
    page.locator('input[aria-label*="search" i]'),
  ]);
}

async function searchViaUi(
  context: BrowserContext,
  query: string,
): Promise<{
  page: Page;
  resultLinks: Awaited<ReturnType<typeof collectCandidateLinks>>;
}> {
  const page = await openPage(context, 'https://new.web.cafe/');
  await ensureLikelyLoggedIn(page);

  const input = await findSearchInput(page);
  if (!input) {
    throw new Error('Search UI changed; selector verification failed.');
  }

  await input.fill(query);
  await page.waitForTimeout(300);
  await input.press('Enter');
  await page.waitForTimeout(2500);

  const resultLinks = await collectCandidateLinks(page, 24);
  return { page, resultLinks };
}

async function searchWebCafe(input: SearchInput): Promise<ScriptResult> {
  if (!input.query || !input.query.trim()) {
    return { success: false, message: 'Search query cannot be empty' };
  }

  const query = input.query.trim().slice(0, 120);
  const maxPages = clampPageLimit(input.max_pages, 4);
  let context: BrowserContext | null = null;

  try {
    context = await getBrowserContext();
    const { resultLinks } = await searchViaUi(context, query);

    if (resultLinks.length === 0) {
      return {
        success: false,
        message: `No search results were captured for "${query}". The search UI may have changed or returned no visible results.`,
      };
    }

    const pages = await visitRepresentativePages(
      context,
      resultLinks,
      maxPages,
    );

    return buildResearchReport({
      title: 'Web.Cafe Search Results',
      listingSummary: [
        ...(input.goal?.trim() ? [`Research goal: ${input.goal.trim()}.`] : []),
        `Search query: ${query}.`,
        `Visible candidate results captured: ${resultLinks.length}.`,
        `Representative result pages visited: ${pages.length}.`,
      ],
      pages,
      sources: pages.map((item) => item.url),
    });
  } finally {
    if (context) await context.close();
  }
}

runScript<SearchInput>(searchWebCafe);
