import { describe, expect, it } from 'vitest';

import {
  buildExploreUrl,
  extractKeywordsFromExploreUrl,
  parseAverageInterestFromLines,
  parseQueriesFromLines,
} from '../.claude/skills/google-trends/lib/browser.ts';

describe('Google Trends helpers', () => {
  it('extracts keywords from a double-encoded Trends URL', () => {
    expect(
      extractKeywordsFromExploreUrl(
        'https://trends.google.com/explore?q=ai%2520girlfriend%2Cai%2520roleplay&date=today%205-y&geo=Worldwide',
      ),
    ).toEqual(['ai girlfriend', 'ai roleplay']);
  });

  it('builds a compare URL from keywords, date, and geo', () => {
    expect(
      buildExploreUrl({
        keywords: ['ai girlfriend', 'ai roleplay'],
        date: 'today 12-m',
        geo: 'US',
      }),
    ).toBe(
      'https://trends.google.com/trends/explore?q=ai+girlfriend%2Cai+roleplay&date=today+12-m&geo=US',
    );
  });

  it('parses average-interest values from nearby lines', () => {
    expect(
      parseAverageInterestFromLines(
        ['Average interest', 'ai girlfriend', '78', 'ai roleplay', '42'],
        ['ai girlfriend', 'ai roleplay'],
      ),
    ).toEqual({
      'ai girlfriend': 78,
      'ai roleplay': 42,
    });
  });

  it('parses top and rising query rows from split query sections', () => {
    expect(
      parseQueriesFromLines(
        [
          'People who searched for ai girlfriend also searched for these queries',
          'Commonly searched queries',
          'Query',
          'ai girlfriend app',
          '+4,500%',
          'best ai girlfriend',
          'Breakout',
          'Query',
          'ai girlfriend free',
          'Breakout',
        ],
        'ai girlfriend',
      ),
    ).toEqual({
      topQueries: [
        { query: 'ai girlfriend app', change: '+4,500%' },
        { query: 'best ai girlfriend', change: 'Breakout' },
      ],
      risingQueries: [{ query: 'ai girlfriend free', change: 'Breakout' }],
    });
  });
});
