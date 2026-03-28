#!/usr/bin/env npx tsx

import * as readline from 'readline';

import {
  closeBrowserSession,
  config,
  ensureLikelyLoggedIn,
  getBrowserSession,
  openPage,
  type BrowserSession,
} from '../lib/browser.js';

async function setup(): Promise<void> {
  console.log('=== Web.Cafe Current-Chrome Check ===\n');
  console.log(
    'This opens a tab in your current Chrome so you can verify Web.Cafe login.',
  );
  console.log(
    'The runtime tools now use your live Chrome session instead of a separate browser profile.\n',
  );

  let session: BrowserSession | null = null;
  session = await getBrowserSession();
  const page = await openPage(session, config.baseUrl);

  console.log('Please complete login in the browser window.');
  console.log(
    'After login is finished and the site is usable, come back here and press Enter.\n',
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('Press Enter when logged in... ', () => {
      rl.close();
      resolve();
    });
  });

  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(config.timeouts.pageLoad);

  try {
    await ensureLikelyLoggedIn(page);
    console.log('\nAuthenticated successfully.');
  } catch {
    console.log('\nLogin could not be verified automatically.');
    console.log(
      'If the runtime later reports auth problems, log in to Web.Cafe in your normal Chrome and rerun this check.',
    );
  }

  await closeBrowserSession(session);
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
