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

interface ExploreExperiencesInput {
  goal?: string;
  max_pages?: number;
}

async function exploreExperiences(
  input: ExploreExperiencesInput,
): Promise<ScriptResult> {
  const maxPages = clampPageLimit(input.max_pages, 5);
  let context: BrowserContext | null = null;

  try {
    context = await getBrowserContext();
    const page = await openPage(context, 'https://new.web.cafe/experiences');
    await ensureLikelyLoggedIn(page);

    const links = await collectCandidateLinks(page, 28);
    const pages = await visitRepresentativePages(context, links, maxPages);

    return buildResearchReport({
      title: 'Web.Cafe Experiences Exploration',
      listingSummary: [
        ...(input.goal?.trim() ? [`Research goal: ${input.goal.trim()}.`] : []),
        `Listing page sampled: https://new.web.cafe/experiences`,
        `Candidate detail links collected: ${links.length}.`,
        `Representative experience pages visited: ${pages.length}.`,
      ],
      pages,
      sources: [
        'https://new.web.cafe/experiences',
        ...pages.map((item) => item.url),
      ],
    });
  } finally {
    if (context) await context.close();
  }
}

runScript<ExploreExperiencesInput>(exploreExperiences);
