#!/usr/bin/env npx tsx

import {
  type ScriptResult,
  buildResearchReport,
  clampPageLimit,
  closeBrowserSession,
  collectCandidateLinks,
  ensureLikelyLoggedIn,
  getBrowserSession,
  openPage,
  runScript,
  type BrowserSession,
  visitRepresentativePages,
} from '../lib/browser.js';

interface ExploreTutorialArticlesInput {
  goal?: string;
  max_pages?: number;
}

async function exploreTutorialArticles(
  input: ExploreTutorialArticlesInput,
): Promise<ScriptResult> {
  const maxPages = clampPageLimit(input.max_pages, 5);
  let session: BrowserSession | null = null;

  try {
    session = await getBrowserSession();
    const page = await openPage(
      session,
      'https://new.web.cafe/tutorials?status=article',
    );
    await ensureLikelyLoggedIn(page);

    const links = await collectCandidateLinks(page, 32);
    const pages = await visitRepresentativePages(session, links, maxPages);

    return buildResearchReport({
      title: 'Web.Cafe Tutorial Articles Exploration',
      listingSummary: [
        ...(input.goal?.trim() ? [`Research goal: ${input.goal.trim()}.`] : []),
        'Listing page sampled: https://new.web.cafe/tutorials?status=article',
        `Candidate article links collected: ${links.length}.`,
        `Representative article pages visited: ${pages.length}.`,
      ],
      pages,
      sources: [
        'https://new.web.cafe/tutorials?status=article',
        ...pages.map((item) => item.url),
      ],
    });
  } finally {
    await closeBrowserSession(session);
  }
}

runScript<ExploreTutorialArticlesInput>(exploreTutorialArticles);
