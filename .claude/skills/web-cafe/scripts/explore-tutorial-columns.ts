#!/usr/bin/env npx tsx

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

import type { BrowserContext } from 'playwright';

interface ExploreTutorialColumnsInput {
  goal?: string;
  max_pages?: number;
}

async function exploreTutorialColumns(
  input: ExploreTutorialColumnsInput,
): Promise<ScriptResult> {
  const maxPages = clampPageLimit(input.max_pages, 5);
  let context: BrowserContext | null = null;

  try {
    context = await getBrowserContext();
    const page = await openPage(
      context,
      'https://new.web.cafe/tutorials?status=column',
    );
    await ensureLikelyLoggedIn(page);

    const links = await collectCandidateLinks(page, 28);
    const pages = await visitRepresentativePages(context, links, maxPages);

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
    if (context) await context.close();
  }
}

runScript<ExploreTutorialColumnsInput>(exploreTutorialColumns);
