/**
 * X Integration - Configuration
 *
 * All environment-specific settings in one place.
 * Override via environment variables or modify defaults here.
 */

import path from 'path';

// Project root - can be overridden for different deployments
const PROJECT_ROOT = process.env.NANOCLAW_ROOT || process.cwd();

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim()) return value;
  }
  return undefined;
}

const browserProxyServer = firstDefined(
  process.env.ALL_PROXY,
  process.env.all_proxy,
  process.env.HTTPS_PROXY,
  process.env.https_proxy,
  process.env.HTTP_PROXY,
  process.env.http_proxy,
);

const browserProxyBypass = firstDefined(
  process.env.NO_PROXY,
  process.env.no_proxy,
);

const browserProxyUsername = firstDefined(
  process.env.PROXY_USERNAME,
);

const browserProxyPassword = firstDefined(
  process.env.PROXY_PASSWORD,
);

/**
 * Configuration object with all settings
 */
export const config = {
  // Chrome executable path
  // Default: standard macOS Chrome location
  // Override: CHROME_PATH environment variable
  chromePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

  // Browser profile directory for persistent login sessions
  browserDataDir: path.join(PROJECT_ROOT, 'data', 'x-browser-profile'),

  // Auth state marker file
  authPath: path.join(PROJECT_ROOT, 'data', 'x-auth.json'),

  // Browser viewport settings
  viewport: {
    width: 1280,
    height: 800,
  },

  // Timeouts (in milliseconds)
  timeouts: {
    navigation: 30000,
    elementWait: 5000,
    afterClick: 1000,
    afterFill: 1000,
    afterSubmit: 3000,
    pageLoad: 3000,
  },

  // X character limits
  limits: {
    tweetMaxLength: 280,
  },

  // Chrome launch arguments
  chromeArgs: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
  ],

  // Args to ignore when launching Chrome
  chromeIgnoreDefaultArgs: ['--enable-automation'],

  // Optional browser proxy settings shared with browser-use.
  browserProxy: browserProxyServer
    ? {
        server: browserProxyServer,
        bypass: browserProxyBypass,
        username: browserProxyUsername,
        password: browserProxyPassword,
      }
    : undefined,
};
