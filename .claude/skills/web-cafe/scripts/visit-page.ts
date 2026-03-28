#!/usr/bin/env npx tsx

import {
  type ScriptResult,
  buildResearchReport,
  clampPageLimit,
  closeBrowserSession,
  collectCandidateLinks,
  ensureLikelyLoggedIn,
  extractPageInsight,
  getBrowserSession,
  normalizeWebCafeUrl,
  openPage,
  runScript,
  type BrowserSession,
  visitRepresentativePages,
} from '../lib/browser.js';

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
  let session: BrowserSession | null = null;

  try {
    session = await getBrowserSession();
    const url = normalizeWebCafeUrl(input.url);
    const page = await openPage(session, url);
    await ensureLikelyLoggedIn(page);

    const current = await extractPageInsight(page);
    const links = await collectCandidateLinks(page, 16);
    const relatedPages = await visitRepresentativePages(
      session,
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
    await closeBrowserSession(session);
  }
}

runScript<VisitPageInput>(visitPage);
