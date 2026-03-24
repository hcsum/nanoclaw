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

interface ExploreTutorialArticlesInput {
  goal?: string;
  max_pages?: number;
}

async function exploreTutorialArticles(
  input: ExploreTutorialArticlesInput,
): Promise<ScriptResult> {
  const maxPages = clampPageLimit(input.max_pages, 5);
  let context: BrowserContext | null = null;

  try {
    context = await getBrowserContext();
    const page = await openPage(
      context,
      'https://new.web.cafe/tutorials?status=article',
    );
    await ensureLikelyLoggedIn(page);

    const links = await collectCandidateLinks(page, 32);
    const pages = await visitRepresentativePages(context, links, maxPages);

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
    if (context) await context.close();
  }
}

runScript<ExploreTutorialArticlesInput>(exploreTutorialArticles);
