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

const browserProxyServer = firstDefined(
  process.env.HTTPS_PROXY,
  process.env.https_proxy,
  process.env.HTTP_PROXY,
  process.env.http_proxy,
  process.env.ALL_PROXY,
  process.env.all_proxy,
);

const browserProxyBypass = firstDefined(
  process.env.NO_PROXY,
  process.env.no_proxy,
);
const browserProxyUsername = firstDefined(process.env.PROXY_USERNAME);
const browserProxyPassword = firstDefined(process.env.PROXY_PASSWORD);

export const config = {
  chromePath:
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  baseUrl: 'https://trends.google.com/explore',
  browserDataDir: path.join(
    PROJECT_ROOT,
    'data',
    'google-trends-browser-profile',
  ),
  viewport: {
    width: 1440,
    height: 960,
  },
  defaults: {
    geo: 'Worldwide',
    date: 'today 5-y',
  },
  timeouts: {
    navigation: 30000,
    pageLoad: 2500,
    elementWait: 6000,
    afterClick: 1200,
    contentPoll: 2000,
  },
  limits: {
    minKeywords: 1,
    maxKeywords: 5,
    maxKeywordLength: 120,
    maxTopQueries: 25,
  },
  chromeArgs: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
  ],
  chromeIgnoreDefaultArgs: ['--enable-automation'],
  browserProxy: browserProxyServer
    ? {
        server: browserProxyServer,
        bypass: browserProxyBypass,
        username: browserProxyUsername,
        password: browserProxyPassword,
      }
    : undefined,
};
