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

interface ExploreExperiencesInput {
  goal?: string;
  max_pages?: number;
}

async function exploreExperiences(
  input: ExploreExperiencesInput,
): Promise<ScriptResult> {
  const maxPages = clampPageLimit(input.max_pages, 5);
  let session: BrowserSession | null = null;

  try {
    session = await getBrowserSession();
    const page = await openPage(session, 'https://new.web.cafe/experiences');
    await ensureLikelyLoggedIn(page);

    const links = await collectCandidateLinks(page, 28);
    const pages = await visitRepresentativePages(session, links, maxPages);

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
    await closeBrowserSession(session);
  }
}

runScript<ExploreExperiencesInput>(exploreExperiences);
