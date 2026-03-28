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

interface ExploreTutorialColumnsInput {
  goal?: string;
  max_pages?: number;
}

async function exploreTutorialColumns(
  input: ExploreTutorialColumnsInput,
): Promise<ScriptResult> {
  const maxPages = clampPageLimit(input.max_pages, 5);
  let session: BrowserSession | null = null;

  try {
    session = await getBrowserSession();
    const page = await openPage(
      session,
      'https://new.web.cafe/tutorials?status=column',
    );
    await ensureLikelyLoggedIn(page);

    const links = await collectCandidateLinks(page, 28);
    const pages = await visitRepresentativePages(session, links, maxPages);

    return buildResearchReport({
      title: 'Web.Cafe Tutorial Columns Exploration',
      listingSummary: [
        ...(input.goal?.trim() ? [`Research goal: ${input.goal.trim()}.`] : []),
        'Listing page sampled: https://new.web.cafe/tutorials?status=column',
        `Candidate column links collected: ${links.length}.`,
        `Representative column pages visited: ${pages.length}.`,
      ],
      pages,
      sources: [
        'https://new.web.cafe/tutorials?status=column',
        ...pages.map((item) => item.url),
      ],
    });
  } finally {
    await closeBrowserSession(session);
  }
}

runScript<ExploreTutorialColumnsInput>(exploreTutorialColumns);
