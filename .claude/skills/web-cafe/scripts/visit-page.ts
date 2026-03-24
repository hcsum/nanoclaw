#!/usr/bin/env npx tsx

import {
  type ScriptResult,
  buildResearchReport,
  clampPageLimit,
  collectCandidateLinks,
  ensureLikelyLoggedIn,
  extractPageInsight,
  getBrowserContext,
  normalizeWebCafeUrl,
  openPage,
  runScript,
  visitRepresentativePages,
} from '../lib/browser.js';

import type { BrowserContext } from 'playwright';

interface VisitPageInput {
  url: string;
  goal?: string;
  max_pages?: number;
}

async function visitPage(input: VisitPageInput): Promise<ScriptResult> {
  if (!input.url || !input.url.trim()) {
    return { success: false, message: 'Missing url' };
  }

  const maxPages = clampPageLimit(input.max_pages, 3);
  let context: BrowserContext | null = null;

  try {
    context = await getBrowserContext();
    const url = normalizeWebCafeUrl(input.url);
    const page = await openPage(context, url);
    await ensureLikelyLoggedIn(page);

    const current = await extractPageInsight(page);
    const links = await collectCandidateLinks(page, 16);
    const relatedPages = await visitRepresentativePages(
      context,
      links,
      maxPages,
    );

    return buildResearchReport({
      title: 'Web.Cafe Page Visit',
      listingSummary: [
        ...(input.goal?.trim() ? [`Research goal: ${input.goal.trim()}.`] : []),
        `Primary page title: ${current.title || current.h1 || url}.`,
        `Nearby internal links collected: ${links.length}.`,
        `Related subpages visited: ${relatedPages.length}.`,
      ],
      pages: [current, ...relatedPages],
      sources: [url, ...relatedPages.map((item) => item.url)],
    });
  } finally {
    if (context) await context.close();
  }
}

runScript<VisitPageInput>(visitPage);
