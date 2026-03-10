/**
 * Web.Cafe Integration - Configuration
 */

import path from 'path';

const ROOT = process.env.NANOCLAW_ROOT || process.cwd();

export const config = {
  // Chrome executable path
  chromePath:
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

  // Browser profile directory (persistent session)
  profileDir: path.join(ROOT, 'data', 'web-cafe-browser-profile'),

  // Auth state marker
  authFile: path.join(ROOT, 'data', 'web-cafe-auth.json'),

  // Base URL
  baseUrl: 'https://new.web.cafe',

  // Browser viewport
  viewport: { width: 1280, height: 800 },

  // Timeouts (milliseconds)
  timeouts: {
    navigation: 30000, // Page navigation
    elementWait: 5000, // Wait for element
    afterClick: 1000, // Delay after click
    afterFill: 1000, // Delay after form fill
    pageLoad: 3000, // Initial page load
  },
};
