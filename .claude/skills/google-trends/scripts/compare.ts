#!/usr/bin/env npx tsx

import {
  buildExploreUrl,
  config,
  extractAverageInterest,
  extractKeywordsFromExploreUrl,
  extractTopQueriesForKeyword,
  formatTrendComparisonMessage,
  getBrowserSession,
  normalizeKeywords,
  openExplorePage,
  runScript,
  closeBrowserSession,
  type ScriptResult,
  type BrowserSession,
  type TrendKeywordResult,
  waitForTrendsContent,
} from '../lib/browser.js';

interface CompareInput {
  keywords?: string[];
  geo?: string;
  date?: string;
  explore_url?: string;
}

async function compareTrends(input: CompareInput): Promise<ScriptResult> {
  const keywords = normalizeKeywords(
    input.keywords && input.keywords.length > 0
      ? input.keywords
      : input.explore_url
        ? extractKeywordsFromExploreUrl(input.explore_url)
        : [],
  );

  if (keywords.length < config.limits.minKeywords) {
    return {
      success: false,
      message:
        'At least one keyword is required. Provide keywords directly or a Google Trends explore URL with a q= parameter.',
    };
  }

  const geo = input.geo?.trim() || config.defaults.geo;
  const date = input.date?.trim() || config.defaults.date;
  const url =
    input.explore_url?.trim() || buildExploreUrl({ keywords, geo, date });

  let session: BrowserSession | null = null;
  try {
    session = await getBrowserSession();
    const page = await openExplorePage(session, url);
    await waitForTrendsContent(page);

    const averageInterestMap = await extractAverageInterest(page, keywords);
    const keywordResults: TrendKeywordResult[] = [];

    for (const keyword of keywords) {
      const topQueries = await extractTopQueriesForKeyword(page, keyword);
      keywordResults.push({
        keyword,
        averageInterest: averageInterestMap[keyword] ?? null,
        topQueries: topQueries.topQueries,
        risingQueries: topQueries.risingQueries,
      });
    }

    const resultData = {
      url,
      geo,
      date,
      keywords: keywordResults,
    };

    return {
      success: true,
      data: resultData,
    };
  } finally {
    await closeBrowserSession(session);
  }
}

runScript<CompareInput>(compareTrends);
