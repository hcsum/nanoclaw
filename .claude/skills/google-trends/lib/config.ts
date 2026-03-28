import * as path from 'path';

const PROJECT_ROOT = process.env.NANOCLAW_ROOT || process.cwd();

function firstDefined(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    if (value && value.trim()) return value;
  }
  return undefined;
}

export const config = {
  baseUrl: 'https://trends.google.com/explore',
  projectRoot: PROJECT_ROOT,
  webAccessCheckScript: path.join(
    PROJECT_ROOT,
    '.claude',
    'skills',
    'web-access',
    'scripts',
    'check-deps.sh',
  ),
  chromeDebugBaseUrl:
    firstDefined(process.env.CHROME_DEBUG_BASE_URL) || 'http://127.0.0.1',
  defaults: {
    geo: 'Worldwide',
    date: 'today 5-y',
  },
  timeouts: {
    navigation: 45000,
    pageLoad: 4000,
    elementWait: 10000,
    afterClick: 2000,
    contentPoll: 3000,
    setup: 130000,
  },
  limits: {
    minKeywords: 1,
    maxKeywords: 5,
    maxKeywordLength: 120,
    maxTopQueries: 25,
  },
};
