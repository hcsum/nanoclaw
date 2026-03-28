import path from 'path';

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
  baseUrl: 'https://new.web.cafe',
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
  timeouts: {
    navigation: 30000,
    pageLoad: 2500,
    elementWait: 5000,
    afterClick: 1000,
    afterFill: 300,
    afterSubmit: 2500,
    setup: 130000,
  },
  limits: {
    minPages: 1,
    maxPages: 8,
    maxQueryLength: 120,
  },
};
